import { Context, Next } from 'hono'
import { verifyToken } from '../utils/auth'
import { adminUserRepository, adminSessionRepository } from '../db'

export interface AdminUser {
  id: number
  username: string
  email: string
  role: string
}

/**
 * 管理员JWT认证中间件
 * 验证JWT令牌并附加管理员信息到上下文
 */
export async function adminAuth(c: Context, next: Next) {
  try {
    // 首先尝试从Authorization header获取token
    let token = c.req.header('Authorization')?.replace(/^Bearer\s+/, '')

    // 如果Authorization header中没有token，尝试从cookie获取
    if (!token) {
      token = c.req.header('cookie')?.match(/admin_token=([^;]+)/)?.[1]
    }

    if (!token) {
      return c.json({
        success: false,
        error: '未登录，请先登录',
        code: 'UNAUTHORIZED',
      }, 401)
    }

    // 验证令牌
    const payload = verifyToken(token)

    if (!payload) {
      return c.json({
        success: false,
        error: '令牌无效或已过期',
        code: 'INVALID_TOKEN',
      }, 401)
    }

    // 验证会话
    const session = await adminSessionRepository.findBySessionId(payload.sessionId)

    if (!session || !session.isActive) {
      return c.json({
        success: false,
        error: '会话已失效，请重新登录',
        code: 'SESSION_INVALID',
      }, 401)
    }

    // 检查会话是否过期
    const now = new Date()
    const expiresAt = new Date(session.expiresAt)

    if (now > expiresAt) {
      // 停用过期的会话
      await adminSessionRepository.deactivateSession(payload.sessionId)

      return c.json({
        success: false,
        error: '会话已过期，请重新登录',
        code: 'SESSION_EXPIRED',
      }, 401)
    }

    // 获取管理员信息
    const admin = await adminUserRepository.findById(payload.adminId)

    if (!admin || !admin.isActive) {
      return c.json({
        success: false,
        error: '账户不存在或已被禁用',
        code: 'ACCOUNT_DISABLED',
      }, 403)
    }

    // 更新最后活动时间
    await adminSessionRepository.updateLastActivity(payload.sessionId)

    // 将管理员信息附加到上下文
    c.set('admin', {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
    } as AdminUser)

    c.set('sessionId', payload.sessionId)

    await next()
  } catch (error) {
    console.error('Admin auth middleware error:', error)
    return c.json({
      success: false,
      error: '认证失败',
      code: 'AUTH_ERROR',
    }, 500)
  }
}

/**
 * 管理员权限检查中间件
 * 检查管理员是否有特定角色
 */
export function requireRole(roles: string | string[]) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles]

  return async (c: Context, next: Next) => {
    const admin = c.get('admin') as AdminUser | undefined

    if (!admin) {
      return c.json({
        success: false,
        error: '未认证',
        code: 'UNAUTHENTICATED',
      }, 401)
    }

    if (!allowedRoles.includes(admin.role)) {
      return c.json({
        success: false,
        error: '没有权限执行此操作',
        code: 'INSUFFICIENT_PERMISSIONS',
      }, 403)
    }

    await next()
  }
}

/**
 * 超级管理员检查中间件
 */
export async function requireSuperAdmin(c: Context, next: Next) {
  return requireRole('super_admin')(c, next)
}

/**
 * 可选认证中间件
 * 如果提供了令牌则验证，但不强制要求登录
 */
export async function optionalAdminAuth(c: Context, next: Next) {
  try {
    // 首先尝试从Authorization header获取token
    let token = c.req.header('Authorization')?.replace(/^Bearer\s+/, '')

    // 如果Authorization header中没有token，尝试从cookie获取
    if (!token) {
      token = c.req.header('cookie')?.match(/admin_token=([^;]+)/)?.[1]
    }

    if (token) {
      const payload = verifyToken(token)

      if (payload) {
        const session = await adminSessionRepository.findBySessionId(payload.sessionId)

        if (session && session.isActive) {
          const admin = await adminUserRepository.findById(payload.adminId)

          if (admin && admin.isActive) {
            c.set('admin', {
              id: admin.id,
              username: admin.username,
              email: admin.email,
              role: admin.role,
            } as AdminUser)

            c.set('sessionId', payload.sessionId)
          }
        }
      }
    }

    await next()
  } catch (error) {
    console.error('Optional admin auth middleware error:', error)
    // 可选认证失败不阻止请求继续
    await next()
  }
}

/**
 * 管理员活动日志中间件
 * 自动记录管理员操作
 */
export async function adminActivityLogger(c: Context, next: Next) {
  const admin = c.get('admin') as AdminUser | undefined

  if (admin) {
    // 在响应后记录活动
    await next()

    // 这里可以添加异步日志记录逻辑
    // 例如：记录操作类型、参数等
  } else {
    await next()
  }
}
