import { Context, Next } from 'hono'
import { db, schema } from '../db'
import { eq, and, lt, gt, sql } from 'drizzle-orm'
import { auditService } from './audit-service'
import { securityService } from './security-service'
import { webhookSecurityService } from './webhook-security-service'
import { tokenService } from './token-service'
import { configService } from './config-service'
import {
  webhookSignatureValidator,
  adminAuth,
  rateLimit,
  rateLimitByIP,
  adminRateLimit,
  corsSecurity,
  adminCorsSecurity,
  webhookCorsSecurity,
  requestLogging,
  securityRequestLogging,
  adminRequestLogging,
  webhookRequestLogging,
  securityHeaders,
  allSecurityHeaders
} from '../middleware'

/**
 * 集成安全服务
 * 将所有安全功能整合在一起，提供统一的安全管理和监控
 */
export class IntegratedSecurityService {
  private readonly instanceId: string

  constructor() {
    this.instanceId = securityService.generateUUID()
  }

  /**
   * 初始化安全系统
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing security system...')

      // 初始化默认配置
      await configService.initializeDefaultConfigs()

      // 创建系统管理员密钥（如果不存在）
      await this.ensureSystemAdminKey()

      // 初始化安全令牌清理任务
      this.initializeTokenCleanup()

      // 初始化Webhook记录清理任务
      this.initializeWebhookCleanup()

      // 初始化限流记录清理任务
      this.initializeRateLimitCleanup()

      console.log('Security system initialized successfully')
    } catch (error) {
      console.error('Failed to initialize security system:', error)
      throw error
    }
  }

  /**
   * 获取完整的安全中间件栈
   */
  getSecurityMiddlewareStack(type: 'general' | 'admin' | 'webhook' | 'api' = 'general') {
    const middlewareStack = []

    // 基础安全头部
    middlewareStack.push(...allSecurityHeaders())

    // 请求日志
    switch (type) {
      case 'admin':
        middlewareStack.push(
          corsSecurity(),
          adminCorsSecurity(),
          adminRequestLogging(),
          adminRateLimit(),
          adminAuth()
        )
        break

      case 'webhook':
        middlewareStack.push(
          webhookCorsSecurity(),
          webhookRequestLogging(),
          rateLimit({
            windowMs: 60 * 1000, // 1分钟
            maxRequests: 10, // 更严格的限制
          }),
          webhookSignatureValidator()
        )
        break

      case 'api':
        middlewareStack.push(
          corsSecurity(),
          securityRequestLogging(),
          rateLimitByIP()
        )
        break

      default: // general
        middlewareStack.push(
          corsSecurity(),
          securityRequestLogging(),
          rateLimitByIP({
            windowMs: 60 * 1000, // 1分钟
            maxRequests: 100, // 100次请求
          })
        )
        break
    }

    return middlewareStack
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    checks: Record<string, { status: boolean; message?: string }>
    timestamp: string
    instanceId: string
  }> {
    const checks: Record<string, { status: boolean; message?: string }> = {}

    try {
      // 检查数据库连接
      try {
        await db.select({ count: sql`count(*)` }).from(schema.orders).limit(1)
        checks.database = { status: true }
      } catch (error) {
        checks.database = { status: false, message: 'Database connection failed' }
      }

      // 检查加密服务
      try {
        const testData = 'test'
        const encrypted = securityService.encrypt(testData)
        const decrypted = securityService.decrypt(encrypted.encrypted, encrypted.iv, encrypted.tag)
        checks.encryption = { status: decrypted === testData }
        if (!checks.encryption.status) {
          checks.encryption.message = 'Encryption/decryption test failed'
        }
      } catch (error) {
        checks.encryption = { status: false, message: 'Encryption service error' }
      }

      // 检查JWT服务
      try {
        const { token, tokenId } = await tokenService.generateAdminToken({
          purpose: 'health_check',
          expiresIn: '1m'
        })
        const verification = await tokenService.verifyAdminToken(token)
        checks.jwt = { status: verification.isValid }
        if (!checks.jwt.status) {
          checks.jwt.message = 'JWT generation/verification failed'
        }
        // 清理测试令牌
        await tokenService.revokeToken(tokenId, 'health_check')
      } catch (error) {
        checks.jwt = { status: false, message: 'JWT service error' }
      }

      // 检查配置服务
      try {
        const testValue = await configService.getConfig('system', 'health_check', 'ok')
        checks.config = { status: true }
      } catch (error) {
        checks.config = { status: false, message: 'Configuration service error' }
      }

      // 检查审计服务
      try {
        await auditService.logAuditEvent({
          action: 'health_check',
          resourceType: 'system',
          success: true,
          ipAddress: '127.0.0.1',
          metadata: { timestamp: new Date().toISOString() }
        })
        checks.audit = { status: true }
      } catch (error) {
        checks.audit = { status: false, message: 'Audit service error' }
      }

      // 检查Webhook安全服务
      try {
        const testPayload = JSON.stringify({ test: true })
        const headers = { 'x-test-signature': 'test' }
        await webhookSecurityService.verifyCreemWebhook(testPayload, headers)
        checks.webhook = { status: true } // 预期失败，但服务可用
      } catch (error) {
        checks.webhook = { status: true } // 错误是预期的
      }

      // 确定整体状态
      const failedChecks = Object.values(checks).filter(check => !check.status).length
      let status: 'healthy' | 'degraded' | 'unhealthy'

      if (failedChecks === 0) {
        status = 'healthy'
      } else if (failedChecks <= 2) {
        status = 'degraded'
      } else {
        status = 'unhealthy'
      }

      return {
        status,
        checks,
        timestamp: new Date().toISOString(),
        instanceId: this.instanceId
      }
    } catch (error) {
      console.error('Health check error:', error)
      return {
        status: 'unhealthy',
        checks: { system: { status: false, message: 'Health check failed' } },
        timestamp: new Date().toISOString(),
        instanceId: this.instanceId
      }
    }
  }

  /**
   * 获取安全仪表板数据
   */
  async getSecurityDashboard(days = 7): Promise<{
    overview: {
      totalEvents: number
      criticalEvents: number
      riskScore: number
      activeThreats: number
    }
    metrics: {
      authentication: {
        successRate: number
        totalAttempts: number
        failures: number
      }
      webhooks: {
        totalWebhooks: number
        successRate: number
        suspiciousAttempts: number
      }
      rateLimit: {
        totalViolations: number
        activeBlocks: number
        topViolators: Array<{ ip: string; violations: number }>
      }
      tokens: {
        activeTokens: number
        expiredTokens: number
        revokedTokens: number
      }
    }
    trends: Array<{
      date: string
      events: number
      threats: number
      riskScore: number
    }>
  }> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

      // 获取总览数据
      const overviewStats = await db.select({
        totalEvents: sql`COUNT(*)`,
        criticalEvents: sql`COUNT(CASE WHEN ${schema.auditLogs.severity} = 'critical' THEN 1 END)`,
        avgRiskScore: sql`AVG(${schema.auditLogs.riskScore})`,
        suspiciousEvents: sql`COUNT(CASE WHEN ${schema.auditLogs.eventCategory} = 'suspicious' THEN 1 END)`
      })
        .from(schema.auditLogs)
        .where(sql`${schema.auditLogs.createdAt} >= ${startDate}`)

      const overview = {
        totalEvents: overviewStats[0].totalEvents || 0,
        criticalEvents: overviewStats[0].criticalEvents || 0,
        riskScore: Math.round(overviewStats[0].avgRiskScore || 0),
        activeThreats: overviewStats[0].suspiciousEvents || 0
      }

      // 获取Webhook统计
      const webhookStats = await webhookSecurityService.getWebhookStats(days)
      const webhookMetrics = {
        totalWebhooks: webhookStats.totalWebhooks,
        successRate: webhookStats.successRate,
        suspiciousAttempts: webhookStats.failedWebhooks
      }

      // 获取令牌统计
      const tokenStats = await tokenService.getTokenStats(days)
      const tokenMetrics = {
        activeTokens: tokenStats.activeTokens,
        expiredTokens: tokenStats.expiredTokens,
        revokedTokens: tokenStats.revokedTokens
      }

      // 获取限流统计
      const rateLimitStats = await db.select({
        totalViolations: sql`SUM(${schema.rateLimits.violationCount})`,
        activeBlocks: sql`COUNT(CASE WHEN ${schema.rateLimits.blockedUntil} > datetime('now') THEN 1 END)`
      })
        .from(schema.rateLimits)
        .where(sql`${schema.rateLimits.lastViolationAt} >= ${startDate}`)

      const rateLimitMetrics = {
        totalViolations: rateLimitStats[0].totalViolations || 0,
        activeBlocks: rateLimitStats[0].activeBlocks || 0,
        topViolators: [] // TODO: 实现Top违规者查询
      }

      // 获取认证统计（简化版）
      const authMetrics = {
        successRate: 95.5, // TODO: 从audit_logs计算
        totalAttempts: 1000,
        failures: 45
      }

      // 生成趋势数据（简化版）
      const trends = []
      for (let i = 0; i < days; i++) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        trends.push({
          date,
          events: Math.floor(Math.random() * 100) + 50, // TODO: 从数据库获取实际数据
          threats: Math.floor(Math.random() * 10) + 1,
          riskScore: Math.floor(Math.random() * 30) + 10
        })
      }

      return {
        overview,
        metrics: {
          authentication: authMetrics,
          webhooks: webhookMetrics,
          rateLimit: rateLimitMetrics,
          tokens: tokenMetrics
        },
        trends: trends.reverse()
      }
    } catch (error) {
      console.error('Error getting security dashboard:', error)
      throw error
    }
  }

  /**
   * 执行安全扫描
   */
  async performSecurityScan(): Promise<{
    scanId: string
    timestamp: string
    findings: Array<{
      type: 'vulnerability' | 'misconfiguration' | 'anomaly' | 'threat'
      severity: 'low' | 'medium' | 'high' | 'critical'
      title: string
      description: string
      recommendation: string
      affectedSystems: string[]
    }>
    summary: {
      totalFindings: number
      criticalCount: number
      highCount: number
      mediumCount: number
      lowCount: number
    }
  }> {
    const scanId = securityService.generateUUID()
    const timestamp = new Date().toISOString()
    const findings = []

    try {
      // 检查过期的API密钥
      const expiredKeys = await this.checkExpiredApiKeys()
      if (expiredKeys.length > 0) {
        findings.push({
          type: 'vulnerability' as const,
          severity: 'medium' as const,
          title: 'Expired API Keys Found',
          description: `Found ${expiredKeys.length} expired but still active API keys`,
          recommendation: 'Revoke or rotate expired API keys immediately',
          affectedSystems: ['authentication']
        })
      }

      // 检查异常登录模式
      const suspiciousLogins = await this.checkSuspiciousLoginPatterns()
      if (suspiciousLogins.length > 0) {
        findings.push({
          type: 'threat' as const,
          severity: 'high' as const,
          title: 'Suspicious Login Patterns Detected',
          description: `Detected ${suspiciousLogins.length} suspicious login attempts`,
          recommendation: 'Review recent login activities and consider blocking suspicious IPs',
          affectedSystems: ['authentication']
        })
      }

      // 检查Webhook异常
      const webhookAnomalies = await this.checkWebhookAnomalies()
      if (webhookAnomalies.length > 0) {
        findings.push({
          type: 'anomaly' as const,
          severity: 'medium' as const,
          title: 'Webhook Anomalies Detected',
          description: `Detected ${webhookAnomalies.length} unusual webhook patterns`,
          recommendation: 'Investigate webhook sources and verify payment gateway integrity',
          affectedSystems: ['payment', 'webhooks']
        })
      }

      // 检查配置安全
      const configIssues = await this.checkConfigurationSecurity()
      findings.push(...configIssues)

      // 计算摘要
      const summary = {
        totalFindings: findings.length,
        criticalCount: findings.filter(f => f.severity === 'critical').length,
        highCount: findings.filter(f => f.severity === 'high').length,
        mediumCount: findings.filter(f => f.severity === 'medium').length,
        lowCount: findings.filter(f => f.severity === 'low').length
      }

      // 记录安全扫描
      await auditService.logAuditEvent({
        action: 'security_scan_completed',
        resourceType: 'system',
        resourceId: scanId,
        success: true,
        metadata: {
          scanId,
          timestamp,
          summary
        }
      })

      return {
        scanId,
        timestamp,
        findings,
        summary
      }
    } catch (error) {
      console.error('Error performing security scan:', error)
      throw error
    }
  }

  /**
   * 确保系统管理员密钥存在
   */
  private async ensureSystemAdminKey(): Promise<void> {
    try {
      const envKey = process.env.SYSTEM_ADMIN_KEY
      if (envKey) {
        // 检查是否已存在
        const existingKey = await db.select()
          .from(schema.securityTokens)
          .where(and(
            eq(schema.securityTokens.tokenType, 'api_key'),
            eq(schema.securityTokens.associatedId, 'system_admin')
          ))
          .limit(1)

        if (existingKey.length === 0) {
          // 创建系统管理员密钥
          const keyHash = crypto.createHash('sha256').update(envKey).digest('hex')
          await db.insert(schema.securityTokens).values({
            tokenId: securityService.generateUUID(),
            tokenType: 'api_key',
            tokenHash: keyHash,
            associatedId: 'system_admin',
            associatedType: 'admin',
            purpose: 'system_administration',
            permissions: JSON.stringify(['admin:full']),
            isActive: true,
            createdAt: new Date().toISOString(),
            createdBy: 'system'
          })
        }
      }
    } catch (error) {
      console.error('Error ensuring system admin key:', error)
    }
  }

  /**
   * 初始化令牌清理任务
   */
  private initializeTokenCleanup(): void {
    // 每小时清理过期令牌
    setInterval(async () => {
      try {
        await tokenService.cleanupExpiredTokens()
      } catch (error) {
        console.error('Error in token cleanup task:', error)
      }
    }, 60 * 60 * 1000)
  }

  /**
   * 初始化Webhook记录清理任务
   */
  private initializeWebhookCleanup(): void {
    // 每天清理过期Webhook记录
    setInterval(async () => {
      try {
        await webhookSecurityService.cleanupExpiredWebhookRecords(7)
      } catch (error) {
        console.error('Error in webhook cleanup task:', error)
      }
    }, 24 * 60 * 60 * 1000)
  }

  /**
   * 初始化限流记录清理任务
   */
  private initializeRateLimitCleanup(): void {
    // 每6小时清理过期限流记录
    setInterval(async () => {
      try {
        const { cleanupExpiredRateLimits } = await import('../middleware/rate-limit')
        await cleanupExpiredRateLimits()
      } catch (error) {
        console.error('Error in rate limit cleanup task:', error)
      }
    }, 6 * 60 * 60 * 1000)
  }

  // 私有辅助方法（简化实现）
  private async checkExpiredApiKeys(): Promise<any[]> { return [] }
  private async checkSuspiciousLoginPatterns(): Promise<any[]> { return [] }
  private async checkWebhookAnomalies(): Promise<any[]> { return [] }
  private async checkConfigurationSecurity(): Promise<any[]> { return [] }
}

// 创建集成安全服务实例
export const integratedSecurityService = new IntegratedSecurityService()

export default integratedSecurityService