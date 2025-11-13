import { Hono } from 'hono'
import { z } from 'zod'
import { adminUserRepository, adminSessionRepository, adminAuditLogRepository } from '../db'
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  generateSessionId,
  hashToken,
  validatePasswordStrength,
  getClientIP,
  isAccountLocked,
  getLockExpiryDate,
  sanitizeForLog,
  generateCSRFToken,
} from '../utils/auth'
import {
  AdminEventType,
  AdminEventCategory,
  AdminRole,
} from '../db/schema'

const app = new Hono()

// 登录请求验证模式
const loginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
})

// 密码重置请求验证模式
const resetPasswordSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
})

// 设置新密码验证模式
const setNewPasswordSchema = z.object({
  token: z.string().min(1, '重置令牌不能为空'),
  newPassword: z.string().min(1, '新密码不能为空'),
})

/**
 * 管理员登录
 */
app.post('/login', async (c) => {
  try {
    const body = await c.req.json()
    const { username, password } = loginSchema.parse(body)

    const clientIP = getClientIP(c.req)
    const userAgent = c.req.header('user-agent') || 'unknown'

    // 查找管理员用户
    const admin = await adminUserRepository.findByUsername(username)

    if (!admin) {
      // 记录失败尝试（即使用户不存在）
      await adminAuditLogRepository.create({
        adminId: null,
        eventType: AdminEventType.LOGIN_FAILED,
        eventCategory: AdminEventCategory.AUTH,
        severity: 'warning',
        ipAddress: clientIP,
        userAgent,
        requestPath: c.req.path,
        requestMethod: 'POST',
        success: false,
        errorMessage: 'Invalid username or password',
      })

      return c.json({
        success: false,
        error: '用户名或密码错误',
      }, 401)
    }

    // 检查账户是否被锁定
    if (admin.lockedUntil && isAccountLocked(admin.lockedUntil)) {
      await adminAuditLogRepository.create({
        adminId: admin.id,
        eventType: AdminEventType.ACCOUNT_LOCKED,
        eventCategory: AdminEventCategory.SECURITY,
        severity: 'warning',
        ipAddress: clientIP,
        userAgent,
        requestPath: c.req.path,
        requestMethod: 'POST',
        success: false,
        errorMessage: 'Account is locked',
      })

      return c.json({
        success: false,
        error: '账户已被锁定，请稍后再试',
        lockedUntil: admin.lockedUntil,
      }, 423)
    }

    // 检查账户是否激活
    if (!admin.isActive) {
      await adminAuditLogRepository.create({
        adminId: admin.id,
        eventType: AdminEventType.LOGIN_FAILED,
        eventCategory: AdminEventCategory.AUTH,
        severity: 'error',
        ipAddress: clientIP,
        userAgent,
        requestPath: c.req.path,
        requestMethod: 'POST',
        success: false,
        errorMessage: 'Account is inactive',
      })

      return c.json({
        success: false,
        error: '账户已被禁用',
      }, 403)
    }

    // 验证密码
    const isPasswordValid = await verifyPassword(password, admin.passwordHash)

    if (!isPasswordValid) {
      // 增加失败尝试次数
      const failedAttempts = admin.failedLoginAttempts + 1

      if (failedAttempts >= 5) {
        // 锁定账户
        const lockUntil = getLockExpiryDate()
        await adminUserRepository.lockAccount(admin.id, lockUntil)

        await adminAuditLogRepository.create({
          adminId: admin.id,
          eventType: AdminEventType.ACCOUNT_LOCKED,
          eventCategory: AdminEventCategory.SECURITY,
          severity: 'critical',
          ipAddress: clientIP,
          userAgent,
          requestPath: c.req.path,
          requestMethod: 'POST',
          success: false,
          errorMessage: `Account locked after ${failedAttempts} failed attempts`,
        })

        return c.json({
          success: false,
          error: '登录失败次数过多，账户已被锁定30分钟',
          lockedUntil,
        }, 423)
      } else {
        await adminUserRepository.incrementFailedAttempts(admin.id)

        await adminAuditLogRepository.create({
          adminId: admin.id,
          eventType: AdminEventType.LOGIN_FAILED,
          eventCategory: AdminEventCategory.AUTH,
          severity: 'warning',
          ipAddress: clientIP,
          userAgent,
          requestPath: c.req.path,
          requestMethod: 'POST',
          success: false,
          errorMessage: `Invalid password (attempt ${failedAttempts})`,
        })

        return c.json({
          success: false,
          error: '用户名或密码错误',
        }, 401)
      }
    }

    // 创建会话
    const sessionId = generateSessionId()
    const token = generateToken({
      adminId: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
      sessionId,
    })

    const tokenHash = hashToken(token)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 8) // 8小时后过期

    // 创建会话记录
    await adminSessionRepository.create({
      adminId: admin.id,
      sessionId,
      tokenHash,
      ipAddress: clientIP,
      userAgent,
      expiresAt: expiresAt.toISOString(),
    })

    // 更新最后登录信息
    await adminUserRepository.updateLastLogin(admin.id, clientIP)

    // 记录成功登录
    await adminAuditLogRepository.create({
      adminId: admin.id,
      sessionId,
      eventType: AdminEventType.LOGIN_SUCCESS,
      eventCategory: AdminEventCategory.AUTH,
      severity: 'info',
      ipAddress: clientIP,
      userAgent,
      requestPath: c.req.path,
      requestMethod: 'POST',
      success: true,
    })

    // 设置Cookie
    c.header('Set-Cookie', `admin_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=28800; Path=/`)

    return c.json({
      success: true,
      data: {
        admin: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          role: admin.role,
        },
        token,
        expiresAt: expiresAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Login error:', error)

    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: error.errors[0].message,
      }, 400)
    }

    return c.json({
      success: false,
      error: '登录失败，请稍后重试',
    }, 500)
  }
})

/**
 * 管理员登出
 */
app.post('/logout', async (c) => {
  try {
    const token = c.req.header('cookie')?.match(/admin_token=([^;]+)/)?.[1]

    if (token) {
      const payload = verifyToken(token)

      if (payload) {
        // 停用会话
        await adminSessionRepository.deactivateSession(payload.sessionId)

        // 记录登出事件
        await adminAuditLogRepository.create({
          adminId: payload.adminId,
          sessionId: payload.sessionId,
          eventType: AdminEventType.LOGOUT,
          eventCategory: AdminEventCategory.AUTH,
          severity: 'info',
          ipAddress: getClientIP(c.req),
          userAgent: c.req.header('user-agent') || 'unknown',
          requestPath: c.req.path,
          requestMethod: 'POST',
          success: true,
        })
      }
    }

    // 清除Cookie
    c.header('Set-Cookie', 'admin_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/')

    return c.json({
      success: true,
      message: '登出成功',
    })
  } catch (error) {
    console.error('Logout error:', error)
    return c.json({
      success: false,
      error: '登出失败',
    }, 500)
  }
})

/**
 * 获取当前管理员信息
 */
app.get('/profile', async (c) => {
  try {
    const token = c.req.header('cookie')?.match(/admin_token=([^;]+)/)?.[1]

    if (!token) {
      return c.json({
        success: false,
        error: '未登录',
      }, 401)
    }

    const payload = verifyToken(token)

    if (!payload) {
      return c.json({
        success: false,
        error: '令牌无效或已过期',
      }, 401)
    }

    // 验证会话是否仍然有效
    const session = await adminSessionRepository.findBySessionId(payload.sessionId)

    if (!session || !session.isActive) {
      return c.json({
        success: false,
        error: '会话已失效',
      }, 401)
    }

    // 更新最后活动时间
    await adminSessionRepository.updateLastActivity(payload.sessionId)

    // 获取管理员信息
    const admin = await adminUserRepository.findById(payload.adminId)

    if (!admin || !admin.isActive) {
      return c.json({
        success: false,
        error: '账户不存在或已被禁用',
      }, 403)
    }

    return c.json({
      success: true,
      data: {
        admin: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          role: admin.role,
        },
        session: {
          sessionId: session.sessionId,
          expiresAt: session.expiresAt,
        },
      },
    })
  } catch (error) {
    console.error('Profile error:', error)
    return c.json({
      success: false,
      error: '获取信息失败',
    }, 500)
  }
})

/**
 * 刷新令牌
 */
app.post('/refresh', async (c) => {
  try {
    const token = c.req.header('cookie')?.match(/admin_token=([^;]+)/)?.[1]

    if (!token) {
      return c.json({
        success: false,
        error: '未登录',
      }, 401)
    }

    const payload = verifyToken(token)

    if (!payload) {
      return c.json({
        success: false,
        error: '令牌无效或已过期',
      }, 401)
    }

    // 验证会话
    const session = await adminSessionRepository.findBySessionId(payload.sessionId)

    if (!session || !session.isActive) {
      return c.json({
        success: false,
        error: '会话已失效',
      }, 401)
    }

    // 生成新令牌
    const newToken = generateToken({
      adminId: payload.adminId,
      username: payload.username,
      email: payload.email,
      role: payload.role,
      sessionId: payload.sessionId,
    })

    const newTokenHash = hashToken(newToken)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 8)

    // 更新会话
    await adminSessionRepository.update(session.id, {
      tokenHash: newTokenHash,
      expiresAt: expiresAt.toISOString(),
      lastActivityAt: new Date().toISOString(),
    })

    // 设置新Cookie
    c.header('Set-Cookie', `admin_token=${newToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=28800; Path=/`)

    return c.json({
      success: true,
      data: {
        token: newToken,
        expiresAt: expiresAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Refresh error:', error)
    return c.json({
      success: false,
      error: '刷新令牌失败',
    }, 500)
  }
})

/**
 * 修改密码
 */
app.post('/change-password', async (c) => {
  try {
    const token = c.req.header('cookie')?.match(/admin_token=([^;]+)/)?.[1]

    if (!token) {
      return c.json({
        success: false,
        error: '未登录',
      }, 401)
    }

    const payload = verifyToken(token)

    if (!payload) {
      return c.json({
        success: false,
        error: '令牌无效或已过期',
      }, 401)
    }

    const body = await c.req.json()
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string().min(1, '当前密码不能为空'),
      newPassword: z.string().min(1, '新密码不能为空'),
    }).parse(body)

    // 验证新密码强度
    const validation = validatePasswordStrength(newPassword, payload.username)

    if (!validation.isValid) {
      return c.json({
        success: false,
        error: '密码强度不够',
        details: validation.errors,
      }, 400)
    }

    // 获取管理员信息
    const admin = await adminUserRepository.findById(payload.adminId)

    if (!admin) {
      return c.json({
        success: false,
        error: '管理员不存在',
      }, 404)
    }

    // 验证当前密码
    const isCurrentPasswordValid = await verifyPassword(currentPassword, admin.passwordHash)

    if (!isCurrentPasswordValid) {
      await adminAuditLogRepository.create({
        adminId: admin.id,
        eventType: AdminEventType.PASSWORD_CHANGE,
        eventCategory: AdminEventCategory.AUTH,
        severity: 'warning',
        ipAddress: getClientIP(c.req),
        userAgent: c.req.header('user-agent') || 'unknown',
        requestPath: c.req.path,
        requestMethod: 'POST',
        success: false,
        errorMessage: 'Invalid current password',
      })

      return c.json({
        success: false,
        error: '当前密码错误',
      }, 401)
    }

    // 哈希新密码
    const newPasswordHash = await hashPassword(newPassword)

    // 更新密码
    await adminUserRepository.updatePassword(admin.id, newPasswordHash)

    // 停用所有会话，强制重新登录
    await adminSessionRepository.deactivateAllAdminSessions(admin.id)

    // 记录密码修改
    await adminAuditLogRepository.create({
      adminId: admin.id,
      eventType: AdminEventType.PASSWORD_CHANGE,
      eventCategory: AdminEventCategory.SECURITY,
      severity: 'info',
      ipAddress: getClientIP(c.req),
      userAgent: c.req.header('user-agent') || 'unknown',
      requestPath: c.req.path,
      requestMethod: 'POST',
      success: true,
    })

    // 清除Cookie
    c.header('Set-Cookie', 'admin_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/')

    return c.json({
      success: true,
      message: '密码修改成功，请重新登录',
    })
  } catch (error) {
    console.error('Change password error:', error)

    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: error.errors[0].message,
      }, 400)
    }

    return c.json({
      success: false,
      error: '修改密码失败',
    }, 500)
  }
})

export default app
