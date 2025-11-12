import { Context, Next } from 'hono'
import { db, schema } from '../db'
import { eq, and, lt } from 'drizzle-orm'
import { auditService } from '../services/audit-service'
import { securityService } from '../services/security-service'

/**
 * 管理员API认证中间件
 * 验证管理员API密钥和权限
 */
export function adminAuth(options: {
  required?: boolean
  permissions?: string[]
} = {}) {
  const { required = true, permissions = [] } = options

  return async (c: Context, next: Next) => {
    try {
      const authHeader = c.req.header('authorization')
      const adminKey = c.req.header('x-admin-key') || c.req.header('admin-key')
      const apiKey = c.req.query('api_key')

      // 获取API密钥（从多个可能的来源）
      const key = adminKey || apiKey || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null)

      if (!key) {
        if (required) {
          await auditService.logAuditEvent({
            action: 'admin_auth_missing',
            resourceType: 'admin_api',
            success: false,
            ipAddress: getClientIP(c),
            userAgent: c.req.header('user-agent'),
            errorMessage: 'Missing admin API key',
            metadata: { path: c.req.path, method: c.req.method }
          })

          c.status(401)
          return c.json({
            success: false,
            error: 'Authentication required',
            code: 'ADMIN_AUTH_MISSING'
          })
        } else {
          // 非必需认证，继续处理
          await next()
          return
        }
      }

      // 验证API密钥
      const authResult = await verifyAdminKey(key)

      if (!authResult.isValid) {
        await auditService.logAuditEvent({
          action: 'admin_auth_invalid',
          resourceType: 'admin_api',
          resourceId: key.substring(0, 8) + '...', // 记录部分密钥用于跟踪
          success: false,
          ipAddress: getClientIP(c),
          userAgent: c.req.header('user-agent'),
          errorMessage: authResult.reason || 'Invalid admin API key',
          metadata: { path: c.req.path, method: c.req.method }
        })

        c.status(401)
        return c.json({
          success: false,
          error: 'Invalid authentication',
          code: 'ADMIN_AUTH_INVALID'
        })
      }

      // 检查API密钥是否被撤销
      if (authResult.revoked) {
        await auditService.logAuditEvent({
          action: 'admin_auth_revoked',
          resourceType: 'admin_api',
          resourceId: authResult.keyId,
          success: false,
          ipAddress: getClientIP(c),
          userAgent: c.req.header('user-agent'),
          errorMessage: 'Admin API key has been revoked',
          metadata: { path: c.req.path, method: c.req.method }
        })

        c.status(401)
        return c.json({
          success: false,
          error: 'Authentication revoked',
          code: 'ADMIN_AUTH_REVOKED'
        })
      }

      // 检查权限（如果需要）
      if (permissions.length > 0) {
        const hasPermission = await checkPermissions(authResult.keyId, permissions)

        if (!hasPermission) {
          await auditService.logAuditEvent({
            action: 'admin_auth_permission_denied',
            resourceType: 'admin_api',
            resourceId: authResult.keyId,
            success: false,
            ipAddress: getClientIP(c),
            userAgent: c.req.header('user-agent'),
            errorMessage: 'Insufficient permissions',
            metadata: { requiredPermissions: permissions, path: c.req.path, method: c.req.method }
          })

          c.status(403)
          return c.json({
            success: false,
            error: 'Insufficient permissions',
            code: 'ADMIN_AUTH_PERMISSION_DENIED'
          })
        }
      }

      // 更新密钥使用情况
      await updateKeyUsage(authResult.keyId, getClientIP(c), c.req.header('user-agent'))

      // 记录成功的认证
      await auditService.logAuditEvent({
        action: 'admin_auth_success',
        resourceType: 'admin_api',
        resourceId: authResult.keyId,
        success: true,
        ipAddress: getClientIP(c),
        userAgent: c.req.header('user-agent'),
        metadata: { path: c.req.path, method: c.req.method }
      })

      // 将认证信息添加到上下文
      c.set('adminAuth', {
        keyId: authResult.keyId,
        keyType: authResult.keyType,
        permissions: authResult.permissions,
        associatedId: authResult.associatedId
      })

      await next()
    } catch (error) {
      console.error('Admin authentication error:', error)

      await auditService.logAuditEvent({
        action: 'admin_auth_error',
        resourceType: 'admin_api',
        success: false,
        ipAddress: getClientIP(c),
        userAgent: c.req.header('user-agent'),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: { error: error.stack }
      })

      c.status(500)
      return c.json({
        success: false,
        error: 'Authentication error',
        code: 'ADMIN_AUTH_ERROR'
      })
    }
  }
}

/**
 * 验证管理员API密钥
 */
async function verifyAdminKey(key: string): Promise<{
  isValid: boolean
  keyId?: string
  keyType?: string
  permissions?: string[]
  associatedId?: string
  revoked?: boolean
  reason?: string
}> {
  try {
    // 首先从数据库中查找安全令牌
    const tokenRecord = await db.select()
      .from(schema.securityTokens)
      .where(and(
        eq(schema.securityTokens.tokenType, 'api_key'),
        eq(schema.securityTokens.tokenHash, hashToken(key))
      ))
      .limit(1)

    if (tokenRecord.length === 0) {
      // 检查环境变量中的管理员密钥（用于系统初始化）
      const envAdminKey = process.env.ADMIN_API_KEY
      if (envAdminKey && key === envAdminKey) {
        return {
          isValid: true,
          keyId: 'env_admin_key',
          keyType: 'environment',
          permissions: ['admin:full'],
          associatedId: 'system'
        }
      }

      return {
        isValid: false,
        reason: 'Token not found'
      }
    }

    const token = tokenRecord[0]

    // 检查令牌是否有效
    if (!token.isActive) {
      return {
        isValid: false,
        keyId: token.tokenId,
        reason: 'Token is inactive'
      }
    }

    // 检查是否已过期
    if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
      return {
        isValid: false,
        keyId: token.tokenId,
        reason: 'Token expired'
      }
    }

    // 检查是否已撤销
    if (token.revokedAt) {
      return {
        isValid: false,
        keyId: token.tokenId,
        revoked: true,
        reason: 'Token revoked'
      }
    }

    // 检查使用次数限制
    if (token.maxUsage && token.usageCount >= token.maxUsage) {
      return {
        isValid: false,
        keyId: token.tokenId,
        reason: 'Usage limit exceeded'
      }
    }

    // 解析权限
    const permissions = token.permissions ? JSON.parse(token.permissions) : []

    return {
      isValid: true,
      keyId: token.tokenId,
      keyType: token.tokenType,
      permissions,
      associatedId: token.associatedId,
      revoked: false
    }
  } catch (error) {
    console.error('Error verifying admin key:', error)
    return {
      isValid: false,
      reason: 'Verification error'
    }
  }
}

/**
 * 检查权限
 */
async function checkPermissions(keyId: string, requiredPermissions: string[]): Promise<boolean> {
  try {
    const tokenRecord = await db.select()
      .from(schema.securityTokens)
      .where(eq(schema.securityTokens.tokenId, keyId))
      .limit(1)

    if (tokenRecord.length === 0) {
      return false
    }

    const token = tokenRecord[0]
    const permissions = token.permissions ? JSON.parse(token.permissions) : []

    // 检查是否有完全权限
    if (permissions.includes('admin:full')) {
      return true
    }

    // 检查是否有所需的所有权限
    return requiredPermissions.every(permission => permissions.includes(permission))
  } catch (error) {
    console.error('Error checking permissions:', error)
    return false
  }
}

/**
 * 更新密钥使用情况
 */
async function updateKeyUsage(keyId: string, ipAddress: string, userAgent: string) {
  try {
    await db.update(schema.securityTokens)
      .set({
        lastUsedAt: new Date().toISOString(),
        usageCount: sql`${schema.securityTokens.usageCount} + 1`
      })
      .where(eq(schema.securityTokens.tokenId, keyId))
  } catch (error) {
    console.error('Error updating key usage:', error)
    // 不应该阻断主流程
  }
}

/**
 * 生成API密钥
 */
export async function generateApiKey(options: {
  associatedId?: string
  associatedType?: string
  permissions?: string[]
  expiresAt?: Date
  maxUsage?: number
  purpose?: string
} = {}): Promise<{ keyId: string; apiKey: string }> {
  try {
    const {
      associatedId = 'system',
      associatedType = 'admin',
      permissions = ['admin:read'],
      expiresAt,
      maxUsage,
      purpose = 'Admin API access'
    } = options

    const apiKey = securityService.generateSecureToken(32)
    const keyId = securityService.generateUUID()
    const tokenHash = hashToken(apiKey)

    await db.insert(schema.securityTokens).values({
      tokenId: keyId,
      tokenType: 'api_key',
      tokenHash,
      associatedId,
      associatedType,
      purpose,
      permissions: JSON.stringify(permissions),
      isActive: true,
      expiresAt: expiresAt?.toISOString(),
      maxUsage,
      ipAddress: 'system',
      createdAt: new Date().toISOString(),
      createdBy: 'system'
    })

    return { keyId, apiKey }
  } catch (error) {
    console.error('Error generating API key:', error)
    throw error
  }
}

/**
 * 撤销API密钥
 */
export async function revokeApiKey(keyId: string, revokedBy: string): Promise<boolean> {
  try {
    const result = await db.update(schema.securityTokens)
      .set({
        isActive: false,
        revokedAt: new Date().toISOString(),
        revokedBy
      })
      .where(eq(schema.securityTokens.tokenId, keyId))

    await auditService.logAuditEvent({
      action: 'api_key_revoked',
      resourceType: 'security_token',
      resourceId: keyId,
      success: true,
      userEmail: revokedBy,
      metadata: { revokedAt: new Date().toISOString() }
    })

    return result.changes > 0
  } catch (error) {
    console.error('Error revoking API key:', error)
    return false
  }
}

/**
 * 清理过期的API密钥
 */
export async function cleanupExpiredKeys() {
  try {
    const cutoffTime = new Date().toISOString()

    const result = await db.update(schema.securityTokens)
      .set({
        isActive: false,
        updatedAt: cutoffTime
      })
      .where(and(
        eq(schema.securityTokens.tokenType, 'api_key'),
        eq(schema.securityTokens.isActive, true),
        sql`${schema.securityTokens.expiresAt} < ${cutoffTime}`
      ))

    console.log(`Deactivated ${result.changes} expired API keys`)
    return result.changes
  } catch (error) {
    console.error('Failed to cleanup expired API keys:', error)
    return 0
  }
}

/**
 * 生成令牌哈希
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * 获取客户端IP地址
 */
function getClientIP(c: Context): string {
  return c.req.header('x-forwarded-for') ||
         c.req.header('x-real-ip') ||
         c.req.header('cf-connecting-ip') ||
         'unknown'
}

// 为了让TypeScript编译器满意，需要导入sql函数
import { sql } from 'drizzle-orm'

export default adminAuth