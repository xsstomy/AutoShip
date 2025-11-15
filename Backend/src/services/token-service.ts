import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { db, schema } from '../db'
import { eq, and, lt, gt, sql } from 'drizzle-orm'
import { auditService } from './audit-service'
import { securityService } from './security-service'

interface JWTPayload {
  jti: string // JWT ID
  type: string // 令牌类型
  sub?: string // 主体（用户ID等）
  iss?: string // 签发者
  aud?: string // 接收者
  iat: number // 签发时间
  exp: number // 过期时间
  nbf?: number // 生效时间
  data?: Record<string, any> // 额外数据
}

interface TokenOptions {
  associatedId?: string
  associatedType?: string
  purpose?: string
  permissions?: string[]
  expiresIn?: string | number
  maxUsage?: number
  metadata?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

/**
 * JWT令牌管理服务
 * 处理下载链接、管理员API令牌等的生成和验证
 */
export class TokenService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || securityService.generateSecureToken(64)
  private readonly JWT_ALGORITHM = 'HS256'
  private readonly DEFAULT_DOWNLOAD_EXPIRES_IN = '72h' // 72小时
  private readonly DEFAULT_DOWNLOAD_MAX_USAGE = 3
  private readonly DEFAULT_ADMIN_EXPIRES_IN = '24h' // 24小时

  /**
   * 生成下载链接JWT令牌
   */
  async generateDownloadToken(options: {
    deliveryId: number
    orderId: string
    downloadLimit?: number
    expiresIn?: string | number
    ipAddress?: string
    userAgent?: string
  }): Promise<{ token: string; tokenId: string; expiresAt: Date }> {
    const {
      deliveryId,
      orderId,
      downloadLimit = this.DEFAULT_DOWNLOAD_MAX_USAGE,
      expiresIn = this.DEFAULT_DOWNLOAD_EXPIRES_IN,
      ipAddress,
      userAgent
    } = options

    try {
      const tokenId = securityService.generateUUID()
      const now = Math.floor(Date.now() / 1000)
      const expiresAt = new Date()

      // 计算过期时间
      if (typeof expiresIn === 'string') {
        const match = expiresIn.match(/^(\d+)([smhd])$/)
        if (match) {
          const value = parseInt(match[1])
          const unit = match[2]
          let seconds = 0

          switch (unit) {
            case 's': seconds = value; break
            case 'm': seconds = value * 60; break
            case 'h': seconds = value * 3600; break
            case 'd': seconds = value * 86400; break
          }

          expiresAt.setTime(expiresAt.getTime() + seconds * 1000)
        }
      } else if (typeof expiresIn === 'number') {
        expiresAt.setTime(expiresAt.getTime() + expiresIn * 1000)
      }

      const payload: JWTPayload = {
        jti: tokenId,
        type: 'download',
        sub: orderId,
        iat: now,
        exp: Math.floor(expiresAt.getTime() / 1000),
        data: {
          deliveryId,
          downloadLimit,
          createdAt: new Date().toISOString()
        }
      }

      const token = jwt.sign(payload, this.JWT_SECRET, {
        algorithm: this.JWT_ALGORITHM,
        issuer: 'autoship',
        audience: 'download'
      })

      // 记录到数据库
      await db.insert(schema.securityTokens).values({
        tokenId,
        tokenType: 'download',
        tokenHash: this.hashToken(token),
        associatedType: 'order',
        purpose: 'download_access',
        permissions: JSON.stringify(['download:access']),
        metadata: JSON.stringify({
          associatedId: orderId,
          deliveryId,
          downloadLimit
        }),
        isActive: true,
        expiresAt: expiresAt.toISOString(),
        maxUsage: downloadLimit,
        ipAddress,
        userAgent,
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      })

      await auditService.logAuditEvent({
        action: 'download_token_generated',
        resourceType: 'security_token',
        resourceId: tokenId,
        success: true,
        ipAddress,
        userAgent,
        metadata: {
          associatedId: orderId,
          deliveryId,
          downloadLimit,
          expiresAt: expiresAt.toISOString()
        }
      })

      return { token, tokenId, expiresAt }
    } catch (error) {
      console.error('Error generating download token:', error)
      throw new Error('Failed to generate download token')
    }
  }

  /**
   * 验证下载链接JWT令牌
   */
  async verifyDownloadToken(
    token: string,
    clientIP?: string,
    userAgent?: string
  ): Promise<{
    isValid: boolean
    tokenId?: string
    deliveryId?: number
    orderId?: string
    remainingDownloads?: number
    isExpired?: boolean
    error?: string
  }> {
    try {
      // 验证JWT令牌
      let decoded: JWTPayload
      try {
        decoded = jwt.verify(token, this.JWT_SECRET, {
          algorithms: [this.JWT_ALGORITHM],
          issuer: 'autoship',
          audience: 'download'
        }) as JWTPayload
      } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
          return { isValid: false, isExpired: true, error: 'Token expired' }
        } else if (error instanceof jwt.JsonWebTokenError) {
          return { isValid: false, error: 'Invalid token' }
        } else {
          return { isValid: false, error: 'Token verification failed' }
        }
      }

      // 检查令牌类型
      if (decoded.type !== 'download') {
        return { isValid: false, error: 'Invalid token type' }
      }

      // 从数据库查询令牌状态
      const tokenRecord = await db.select()
        .from(schema.securityTokens)
        .where(eq(schema.securityTokens.tokenId, decoded.jti))
        .limit(1)

      if (tokenRecord.length === 0) {
        return { isValid: false, error: 'Token not found in database' }
      }

      const tokenData = tokenRecord[0]

      // 检查令牌状态
      if (!tokenData.isActive) {
        return { isValid: false, error: 'Token is inactive' }
      }

      // 检查是否已撤销
      if (tokenData.revokedAt) {
        return { isValid: false, error: 'Token has been revoked' }
      }

      // 检查使用次数限制
      if (tokenData.maxUsage && (tokenData.usageCount || 0) >= tokenData.maxUsage) {
        return { isValid: false, error: 'Download limit exceeded' }
      }

      // 检查过期时间
      if (tokenData.expiresAt && new Date(tokenData.expiresAt) < new Date()) {
        return { isValid: false, isExpired: true, error: 'Token expired' }
      }

      // 更新使用情况
      await this.updateTokenUsage(decoded.jti, clientIP, userAgent)

      // 提取数据
      const deliveryId = decoded.data?.deliveryId
      const orderId = decoded.sub
      const remainingDownloads = tokenData.maxUsage ?
        Math.max(0, tokenData.maxUsage - ((tokenData.usageCount || 0) + 1)) :
        undefined

      // 记录成功验证
      await auditService.logAuditEvent({
        action: 'download_token_verified',
        resourceType: 'security_token',
        resourceId: decoded.jti,
        success: true,
        ipAddress: clientIP,
        userAgent,
        metadata: {
          associatedId: orderId,
          deliveryId,
          remainingDownloads
        }
      })

      return {
        isValid: true,
        tokenId: decoded.jti,
        deliveryId,
        orderId,
        remainingDownloads
      }
    } catch (error) {
      console.error('Error verifying download token:', error)
      return { isValid: false, error: 'Token verification failed' }
    }
  }

  /**
   * 生成管理员API令牌
   */
  async generateAdminToken(options: TokenOptions & {
    permissions?: string[]
    expiresIn?: string | number
  } = {}): Promise<{ token: string; tokenId: string; expiresAt: Date }> {
    const {
      associatedId = 'admin',
      associatedType = 'admin',
      purpose = 'admin_api_access',
      permissions = ['admin:read'],
      expiresIn = this.DEFAULT_ADMIN_EXPIRES_IN,
      ipAddress,
      userAgent,
      metadata
    } = options

    try {
      const tokenId = securityService.generateUUID()
      const now = Math.floor(Date.now() / 1000)
      const expiresAt = new Date()

      // 计算过期时间
      if (typeof expiresIn === 'string') {
        const duration = this.parseDuration(expiresIn)
        expiresAt.setTime(expiresAt.getTime() + duration * 1000)
      } else if (typeof expiresIn === 'number') {
        expiresAt.setTime(expiresAt.getTime() + expiresIn * 1000)
      }

      const payload: JWTPayload = {
        jti: tokenId,
        type: 'admin',
        sub: associatedId,
        iss: 'autoship',
        aud: 'admin_api',
        iat: now,
        exp: Math.floor(expiresAt.getTime() / 1000),
        data: {
          permissions,
          purpose
        }
      }

      const token = jwt.sign(payload, this.JWT_SECRET, {
        algorithm: this.JWT_ALGORITHM
      })

      // 记录到数据库
      await db.insert(schema.securityTokens).values({
        tokenId,
        tokenType: 'admin',
        tokenHash: this.hashToken(token),
        associatedType,
        purpose,
        permissions: JSON.stringify(permissions),
        metadata: JSON.stringify({
          associatedId,
          ...(metadata || {})
        }),
        isActive: true,
        expiresAt: expiresAt.toISOString(),
        ipAddress,
        userAgent,
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      })

      await auditService.logAuditEvent({
        action: 'admin_token_generated',
        resourceType: 'security_token',
        resourceId: tokenId,
        success: true,
        ipAddress,
        userAgent,
        metadata: {
          associatedId,
          permissions,
          purpose,
          expiresAt: expiresAt.toISOString()
        }
      })

      return { token, tokenId, expiresAt }
    } catch (error) {
      console.error('Error generating admin token:', error)
      throw new Error('Failed to generate admin token')
    }
  }

  /**
   * 验证管理员API令牌
   */
  async verifyAdminToken(
    token: string,
    clientIP?: string,
    userAgent?: string
  ): Promise<{
    isValid: boolean
    tokenId?: string
    associatedId?: string
    permissions?: string[]
    error?: string
  }> {
    try {
      // 验证JWT令牌
      let decoded: JWTPayload
      try {
        decoded = jwt.verify(token, this.JWT_SECRET, {
          algorithms: [this.JWT_ALGORITHM],
          issuer: 'autoship',
          audience: 'admin_api'
        }) as JWTPayload
      } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
          return { isValid: false, error: 'Token expired' }
        } else if (error instanceof jwt.JsonWebTokenError) {
          return { isValid: false, error: 'Invalid token' }
        } else {
          return { isValid: false, error: 'Token verification failed' }
        }
      }

      // 检查令牌类型
      if (decoded.type !== 'admin') {
        return { isValid: false, error: 'Invalid token type' }
      }

      // 从数据库查询令牌状态
      const tokenRecord = await db.select()
        .from(schema.securityTokens)
        .where(eq(schema.securityTokens.tokenId, decoded.jti))
        .limit(1)

      if (tokenRecord.length === 0) {
        return { isValid: false, error: 'Token not found in database' }
      }

      const tokenData = tokenRecord[0]

      // 检查令牌状态
      if (!tokenData.isActive) {
        return { isValid: false, error: 'Token is inactive' }
      }

      // 检查是否已撤销
      if (tokenData.revokedAt) {
        return { isValid: false, error: 'Token has been revoked' }
      }

      // 检查过期时间
      if (tokenData.expiresAt && new Date(tokenData.expiresAt) < new Date()) {
        return { isValid: false, error: 'Token expired' }
      }

      // 解析权限
      const permissions = tokenData.permissions ? JSON.parse(tokenData.permissions) : []

      // 更新使用情况
      await this.updateTokenUsage(decoded.jti, clientIP, userAgent)

      // 记录成功验证
      await auditService.logAuditEvent({
        action: 'admin_token_verified',
        resourceType: 'security_token',
        resourceId: decoded.jti,
        success: true,
        ipAddress: clientIP,
        userAgent,
        metadata: {
          associatedId: decoded.sub,
          permissions
        }
      })

      return {
        isValid: true,
        tokenId: decoded.jti,
        associatedId: decoded.sub,
        permissions
      }
    } catch (error) {
      console.error('Error verifying admin token:', error)
      return { isValid: false, error: 'Token verification failed' }
    }
  }

  /**
   * 撤销令牌
   */
  async revokeToken(tokenId: string, revokedBy: string, reason?: string): Promise<boolean> {
    try {
      const result = await db.update(schema.securityTokens)
        .set({
          isActive: false,
          revokedAt: new Date().toISOString(),
          revokedBy,
          // updatedAt field not available in schema
        })
        .where(eq(schema.securityTokens.tokenId, tokenId))

      const success = result.changes > 0

      if (success) {
        await auditService.logAuditEvent({
          action: 'token_revoked',
          resourceType: 'security_token',
          resourceId: tokenId,
          success: true,
          userEmail: revokedBy,
          metadata: { reason, revokedAt: new Date().toISOString() }
        })
      }

      return success
    } catch (error) {
      console.error('Error revoking token:', error)
      return false
    }
  }

  /**
   * 更新令牌使用情况
   */
  private async updateTokenUsage(tokenId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    try {
      await db.update(schema.securityTokens)
        .set({
          lastUsedAt: new Date().toISOString(),
          usageCount: sql`${schema.securityTokens.usageCount} + 1`,
          ipAddress: ipAddress || schema.securityTokens.ipAddress,
          userAgent: userAgent || schema.securityTokens.userAgent,
          // updatedAt field not available in schema
        })
        .where(eq(schema.securityTokens.tokenId, tokenId))
    } catch (error) {
      console.error('Error updating token usage:', error)
      // 不应该阻断主流程
    }
  }

  /**
   * 清理过期的令牌
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const now = new Date().toISOString()

      const result = await db.update(schema.securityTokens)
        .set({
          isActive: false,
          revokedAt: now
        })
        .where(and(
          eq(schema.securityTokens.isActive, true),
          sql`${schema.securityTokens.expiresAt} < ${now}`
        ))

      console.log(`Deactivated ${result.changes} expired tokens`)
      return result.changes
    } catch (error) {
      console.error('Error cleaning up expired tokens:', error)
      return 0
    }
  }

  /**
   * 获取令牌统计信息
   */
  async getTokenStats(days = 7): Promise<{
    totalTokens: number
    activeTokens: number
    expiredTokens: number
    revokedTokens: number
    byType: Record<string, number>
    byPurpose: Record<string, number>
  }> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

      const stats = await db.select({
        total: sql`COUNT(*)`,
        active: sql`COUNT(CASE WHEN ${schema.securityTokens.isActive} = true THEN 1 END)`,
        expired: sql`COUNT(CASE WHEN ${schema.securityTokens.expiresAt} < datetime('now') THEN 1 END)`,
        revoked: sql`COUNT(CASE WHEN ${schema.securityTokens.revokedAt} IS NOT NULL THEN 1 END)`
      })
        .from(schema.securityTokens)
        .where(sql`${schema.securityTokens.createdAt} >= ${startDate}`)

      const total = stats[0].total
      const active = stats[0].active
      const expired = stats[0].expired
      const revoked = stats[0].revoked

      // 按类型分组统计
      const typeStats = await db.select({
        type: schema.securityTokens.tokenType,
        count: sql`COUNT(*)`
      })
        .from(schema.securityTokens)
        .where(sql`${schema.securityTokens.createdAt} >= ${startDate}`)
        .groupBy(schema.securityTokens.tokenType)

      // 按用途分组统计
      const purposeStats = await db.select({
        purpose: schema.securityTokens.purpose,
        count: sql`COUNT(*)`
      })
        .from(schema.securityTokens)
        .where(sql`${schema.securityTokens.createdAt} >= ${startDate}`)
        .groupBy(schema.securityTokens.purpose)

      const byType: Record<string, number> = {}
      const byPurpose: Record<string, number> = {}

      typeStats.forEach(stat => {
        byType[stat.type || 'unknown'] = Number(stat.count)
      })

      purposeStats.forEach(stat => {
        byPurpose[stat.purpose || 'unknown'] = Number(stat.count)
      })

      return {
        totalTokens: Number(total),
        activeTokens: Number(active),
        expiredTokens: Number(expired),
        revokedTokens: Number(revoked),
        byType,
        byPurpose
      }
    } catch (error) {
      console.error('Error getting token stats:', error)
      return {
        totalTokens: 0,
        activeTokens: 0,
        expiredTokens: 0,
        revokedTokens: 0,
        byType: {},
        byPurpose: {}
      }
    }
  }

  /**
   * 解析时间间隔字符串
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/)
    if (!match) {
      throw new Error('Invalid duration format')
    }

    const value = parseInt(match[1])
    const unit = match[2]

    switch (unit) {
      case 's': return value
      case 'm': return value * 60
      case 'h': return value * 3600
      case 'd': return value * 86400
      default:
        throw new Error('Invalid duration unit')
    }
  }

  /**
   * 生成令牌哈希
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex')
  }

  /**
   * 刷新令牌
   */
  async refreshToken(tokenId: string, newExpiresIn?: string | number): Promise<{
    success: boolean
    newToken?: string
    newTokenId?: string
    expiresAt?: Date
    error?: string
  }> {
    try {
      // 获取原令牌信息
      const tokenRecord = await db.select()
        .from(schema.securityTokens)
        .where(eq(schema.securityTokens.tokenId, tokenId))
        .limit(1)

      if (tokenRecord.length === 0) {
        return { success: false, error: 'Token not found' }
      }

      const oldToken = tokenRecord[0]

      // 检查令牌状态
      if (!oldToken.isActive || oldToken.revokedAt) {
        return { success: false, error: 'Token cannot be refreshed' }
      }

      // 撤销旧令牌
      await this.revokeToken(tokenId, 'system', 'Token refreshed')

      // 生成新令牌
      if (oldToken.tokenType === 'admin') {
        const permissions = oldToken.permissions ? JSON.parse(oldToken.permissions) : []
        const result = await this.generateAdminToken({
          associatedId: oldToken.associatedId || undefined,
          associatedType: oldToken.associatedType || undefined,
          purpose: oldToken.purpose || undefined,
          permissions,
          expiresIn: newExpiresIn
        })

        return {
          success: true,
          newToken: result.token,
          newTokenId: result.tokenId,
          expiresAt: result.expiresAt
        }
      } else {
        return { success: false, error: 'Token refresh not supported for this type' }
      }
    } catch (error) {
      console.error('Error refreshing token:', error)
      return { success: false, error: 'Token refresh failed' }
    }
  }
}

// 创建令牌服务实例
export const tokenService = new TokenService()

export default tokenService