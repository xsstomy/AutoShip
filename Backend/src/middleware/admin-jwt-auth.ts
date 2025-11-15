import { Context, Next } from 'hono'
import { parse } from 'cookie'
import { verifyToken } from '../utils/auth'
import { adminUserRepository, adminSessionRepository } from '../db'
import { errors } from '../utils/response'

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

    // 如果Authorization header中没有token，尝试从cookie获取（更安全的解析方式）
    if (!token) {
      const cookieHeader = c.req.header('cookie')
      if (cookieHeader) {
        const cookies = parse(cookieHeader)
        token = cookies.admin_token
      }
    }

    if (!token) {
      return errors.UNAUTHORIZED(c)
    }

    // 验证令牌
    const payload = verifyToken(token)

    if (!payload) {
      return errors.INVALID_TOKEN(c)
    }

    // 验证会话
    const session = await adminSessionRepository.findBySessionId(payload.sessionId)

    if (!session || !session.isActive) {
      return errors.SESSION_INVALID(c)
    }

    // 检查会话是否过期
    const now = new Date()
    const expiresAt = new Date(session.expiresAt)

    if (now > expiresAt) {
      // 停用过期的会话
      await adminSessionRepository.deactivateSession(payload.sessionId)

      return errors.SESSION_EXPIRED(c)
    }

    // 获取管理员信息
    const admin = await adminUserRepository.findById(payload.adminId)

    if (!admin || !admin.isActive) {
      return errors.ACCOUNT_DISABLED(c)
    }

    // 更新最后活动时间
    await adminSessionRepository.updateLastActivity(payload.sessionId)

    // 将管理员信息附加到上下文
    c.set('admin', (admin as any) as AdminUser)

    c.set('sessionId', payload.sessionId)

    await next()
  } catch (error) {
    console.error('Admin auth middleware error:', error)
    return errors.INTERNAL_ERROR(c, '认证失败')
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
      return errors.UNAUTHORIZED(c, '未认证')
    }

    if (!allowedRoles.includes(admin.role)) {
      return errors.INSUFFICIENT_PERMISSIONS(c)
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

    // 如果Authorization header中没有token，尝试从cookie获取（更安全的解析方式）
    if (!token) {
      const cookieHeader = c.req.header('cookie')
      if (cookieHeader) {
        const cookies = parse(cookieHeader)
        token = cookies.admin_token
      }
    }

    if (token) {
      const payload = verifyToken(token)

      if (payload) {
        const session = await adminSessionRepository.findBySessionId(payload.sessionId)

        if (session && session.isActive) {
          const admin = await adminUserRepository.findById(payload.adminId)

          if (admin && admin.isActive) {
            c.set('admin', (admin as any) as AdminUser)

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
