import crypto from 'crypto'
import { db, schema } from '../db'
import { eq, and, lt, gt, sql } from 'drizzle-orm'
import { auditService } from './audit-service'
import { securityService } from './security-service'

/**
 * Webhook安全服务
 * 专门处理支付网关的安全验证和处理
 */
export class WebhookSecurityService {
  private readonly alipayPublicKey: string
  private readonly creemSecret: string
  private readonly maxTimeDiff = 5 * 60 * 1000 // 5分钟

  constructor() {
    this.alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY || ''
    this.creemSecret = process.env.CREEM_WEBHOOK_SECRET || ''
  }

  /**
   * 验证支付宝Webhook签名
   */
  async verifyAlipayWebhook(payload: string, headers: Record<string, string>): Promise<{
    isValid: boolean
    method: string
    error?: string
    gatewayOrderId?: string
    amount?: number
    timestamp?: number
  }> {
    try {
      if (!this.alipayPublicKey) {
        return {
          isValid: false,
          method: 'rsa2_missing_key',
          error: 'Alipay public key not configured'
        }
      }

      // 解析payload
      let params: Record<string, any>
      try {
        if (payload.includes('{')) {
          // JSON格式
          params = typeof payload === 'string' ? JSON.parse(payload) : payload
        } else {
          // 表单格式
          params = this.parseFormPayload(payload)
        }
      } catch (error) {
        return {
          isValid: false,
          method: 'rsa2_parse_error',
          error: 'Failed to parse Alipay payload'
        }
      }

      const signature = headers['alipay-signature'] || headers['signature']
      if (!signature) {
        return {
          isValid: false,
          method: 'rsa2_missing_signature',
          error: 'Missing Alipay signature'
        }
      }

      // 验证时间戳
      const timestamp = params.timestamp ? parseInt(params.timestamp) : null
      if (timestamp) {
        const now = Date.now()
        const timeDiff = Math.abs(now - timestamp * 1000)
        if (timeDiff > this.maxTimeDiff) {
          return {
            isValid: false,
            method: 'rsa2_timestamp_invalid',
            error: 'Alipay timestamp expired',
            timestamp,
            gatewayOrderId: params.trade_no || params.out_trade_no
          }
        }
      }

      // 验证签名
      const signData = this.buildAlipaySignData(params)
      const isValid = this.verifyRSASignature(signData, signature, this.alipayPublicKey)

      // 提取关键信息
      const gatewayOrderId = params.trade_no || params.out_trade_no
      let amount: number | undefined
      if (params.total_amount) {
        amount = parseFloat(params.total_amount)
      } else if (params.amount) {
        amount = parseFloat(params.amount)
      }

      return {
        isValid,
        method: 'rsa2_sha256',
        gatewayOrderId,
        amount: amount || undefined,
        timestamp: timestamp || undefined
      }
    } catch (error) {
      console.error('Alipay webhook verification error:', error)
      return {
        isValid: false,
        method: 'rsa2_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 验证Creem Webhook签名
   */
  async verifyCreemWebhook(payload: string, headers: Record<string, string>): Promise<{
    isValid: boolean
    method: string
    error?: string
    gatewayOrderId?: string
    amount?: number
    timestamp?: number
  }> {
    try {
      if (!this.creemSecret) {
        return {
          isValid: false,
          method: 'hmac_missing_secret',
          error: 'Creem webhook secret not configured'
        }
      }

      const signature = headers['x-creem-signature'] ||
                       headers['creem-signature'] ||
                       headers['signature']

      if (!signature) {
        return {
          isValid: false,
          method: 'hmac_missing_signature',
          error: 'Missing Creem signature'
        }
      }

      // 验证HMAC签名
      const expectedSignature = crypto
        .createHmac('sha256', this.creemSecret)
        .update(payload, 'utf8')
        .digest('hex')

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      )

      // 解析payload获取关键信息
      let params: Record<string, any>
      try {
        params = typeof payload === 'string' ? JSON.parse(payload) : payload
      } catch (error) {
        return {
          isValid: false,
          method: 'hmac_parse_error',
          error: 'Failed to parse Creem payload'
        }
      }

      const timestamp = params.timestamp || params.created_at
      if (timestamp) {
        const timestampMs = typeof timestamp === 'string' ?
          new Date(timestamp).getTime() :
          timestamp * 1000

        const now = Date.now()
        const timeDiff = Math.abs(now - timestampMs)
        if (timeDiff > this.maxTimeDiff) {
          return {
            isValid: false,
            method: 'hmac_timestamp_invalid',
            error: 'Creem timestamp expired',
            timestamp: Math.floor(timestampMs / 1000),
            gatewayOrderId: params.payment_id || params.order_id || params.id
          }
        }
      }

      // 提取关键信息
      const gatewayOrderId = params.payment_id || params.order_id || params.id
      let amount: number | undefined
      if (params.amount) {
        amount = parseFloat(params.amount)
      } else if (params.total) {
        amount = parseFloat(params.total)
      }

      return {
        isValid,
        method: 'hmac_sha256',
        gatewayOrderId,
        amount,
        timestamp: timestamp ? Math.floor(new Date(timestamp).getTime() / 1000) : undefined,
        error: isValid ? undefined : 'HMAC signature verification failed'
      }
    } catch (error) {
      console.error('Creem webhook verification error:', error)
      return {
        isValid: false,
        method: 'hmac_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 检查Webhook幂等性
   */
  async checkWebhookIdempotency(gateway: string, gatewayOrderId: string): Promise<{
    isProcessed: boolean
    orderStatus?: string
    processedAt?: string
  }> {
    try {
      // 检查payments_raw表
      const rawRecord = await db.select()
        .from(schema.paymentsRaw)
        .where(and(
          eq(schema.paymentsRaw.gateway, gateway),
          eq(schema.paymentsRaw.gatewayOrderId, gatewayOrderId),
          eq(schema.paymentsRaw.processed, true)
        ))
        .limit(1)

      if (rawRecord.length > 0) {
        return {
          isProcessed: true,
          processedAt: rawRecord[0].processedAt || undefined
        }
      }

      // 检查orders表
      const orderRecord = await db.select()
        .from(schema.orders)
        .where(and(
          eq(schema.orders.gateway, gateway),
          eq(schema.orders.gatewayOrderId, gatewayOrderId)
        ))
        .limit(1)

      if (orderRecord.length > 0) {
        return {
          isProcessed: true,
          orderStatus: orderRecord[0].status
        }
      }

      return { isProcessed: false }
    } catch (error) {
      console.error('Error checking webhook idempotency:', error)
      return { isProcessed: false }
    }
  }

  /**
   * 验证金额一致性
   */
  async verifyOrderAmount(gatewayOrderId: string, webhookAmount: number): Promise<{
    isValid: boolean
    expectedAmount?: number
    orderId?: string
  }> {
    try {
      const orderRecord = await db.select()
        .from(schema.orders)
        .where(eq(schema.orders.gatewayOrderId, gatewayOrderId))
        .limit(1)

      if (orderRecord.length === 0) {
        return { isValid: false }
      }

      const order = orderRecord[0]
      const expectedAmount = order.amount

      // 允许微小的金额差异（由于汇率转换等）
      const tolerance = 0.01
      const amountDiff = Math.abs(expectedAmount - webhookAmount)

      return {
        isValid: amountDiff <= tolerance,
        expectedAmount,
        orderId: order.id
      }
    } catch (error) {
      console.error('Error verifying order amount:', error)
      return { isValid: false }
    }
  }

  /**
   * 记录Webhook处理尝试
   */
  async recordWebhookAttempt(data: {
    gateway: string
    gatewayOrderId?: string
    payload: string
    headers: Record<string, string>
    signatureValid: boolean
    signatureMethod: string
    processingResult: 'success' | 'failed' | 'duplicate'
    errorMessage?: string
  }): Promise<string> {
    try {
      const recordId = await db.insert(schema.paymentsRaw).values({
        gateway: data.gateway,
        gatewayOrderId: data.gatewayOrderId,
        signatureValid: data.signatureValid,
        signatureMethod: data.signatureMethod,
        payload: data.payload,
        processed: data.processingResult === 'success',
        processingAttempts: 1,
        errorMessage: data.errorMessage,
        createdAt: new Date().toISOString()
      }).returning({ id: schema.paymentsRaw.id })

      return recordId[0].id.toString()
    } catch (error) {
      console.error('Error recording webhook attempt:', error)
      throw error
    }
  }

  /**
   * 更新Webhook处理状态
   */
  async updateWebhookStatus(
    recordId: string,
    updates: {
      processed?: boolean
      processingAttempts?: number
      errorMessage?: string
      processedAt?: string
    }
  ): Promise<void> {
    try {
      await db.update(schema.paymentsRaw)
        .set({
          ...updates
        })
        .where(eq(schema.paymentsRaw.id, parseInt(recordId)))
    } catch (error) {
      console.error('Error updating webhook status:', error)
      throw error
    }
  }

  /**
   * 检测可疑的Webhook模式
   */
  async detectSuspiciousWebhookPatterns(gateway: string, clientIP: string): Promise<{
    isSuspicious: boolean
    riskScore: number
    reasons: string[]
  }> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const reasons: string[] = []
      let riskScore = 0

      // 检查同IP的Webhook频率
      const recentWebhooks = await db.select()
        .from(schema.paymentsRaw)
        .where(and(
          eq(schema.paymentsRaw.gateway, gateway),
          sql`${schema.paymentsRaw.createdAt} >= ${oneHourAgo}`
        ))

      // 如果同一IP在1小时内有大量webhook，增加风险
      if (recentWebhooks.length > 100) {
        reasons.push('High webhook frequency from single IP')
        riskScore += 30
      }

      // 检查失败率
      const failedWebhooks = recentWebhooks.filter(w => !w.signatureValid)
      const failureRate = recentWebhooks.length > 0 ? failedWebhooks.length / recentWebhooks.length : 0

      if (failureRate > 0.5) {
        reasons.push('High webhook signature failure rate')
        riskScore += 40
      }

      // 检查重复的网关订单ID
      const duplicateOrders = this.findDuplicateGatewayOrders(recentWebhooks)
      if (duplicateOrders.length > 0) {
        reasons.push('Duplicate gateway order IDs detected')
        riskScore += 25
      }

      // 检查来自已知恶意IP的请求
      const isKnownMaliciousIP = await this.isKnownMaliciousIP(clientIP)
      if (isKnownMaliciousIP) {
        reasons.push('Request from known malicious IP')
        riskScore += 50
      }

      const isSuspicious = riskScore >= 40

      if (isSuspicious) {
        await auditService.logAuditEvent({
          action: 'webhook_suspicious_pattern',
          resourceType: 'webhook_security',
          success: false,
          ipAddress: clientIP,
          errorMessage: 'Suspicious webhook pattern detected',
          metadata: {
            gateway,
            riskScore,
            reasons,
            recentWebhookCount: recentWebhooks.length,
            failureRate
          }
        })
      }

      return {
        isSuspicious,
        riskScore,
        reasons
      }
    } catch (error) {
      console.error('Error detecting suspicious webhook patterns:', error)
      return { isSuspicious: false, riskScore: 0, reasons: [] }
    }
  }

  /**
   * 构建支付宝签名字符串
   */
  private buildAlipaySignData(params: Record<string, any>): string {
    // 过滤空值和签名相关字段
    const filteredParams = Object.keys(params)
      .filter(key => params[key] && key !== 'sign' && key !== 'sign_type')
      .sort() // 按字母顺序排序
      .map(key => `${key}=${params[key]}`)
      .join('&')

    return filteredParams
  }

  /**
   * 验证RSA签名
   */
  private verifyRSASignature(data: string, signature: string, publicKey: string): boolean {
    try {
      const verifier = crypto.createVerify('RSA-SHA256')
      verifier.update(data, 'utf8')
      return verifier.verify(publicKey, signature, 'base64')
    } catch (error) {
      console.error('RSA signature verification error:', error)
      return false
    }
  }

  /**
   * 解析表单格式payload
   */
  private parseFormPayload(payload: string): Record<string, any> {
    const params: Record<string, any> = {}
    const pairs = payload.split('&')

    for (const pair of pairs) {
      const [key, value] = pair.split('=')
      if (key && value) {
        params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '))
      }
    }

    return params
  }

  /**
   * 查找重复的网关订单ID
   */
  private findDuplicateGatewayOrders(webhooks: any[]): string[] {
    const orderCounts = new Map<string, number>()
    const duplicates: string[] = []

    for (const webhook of webhooks) {
      if (webhook.gatewayOrderId) {
        const count = orderCounts.get(webhook.gatewayOrderId) || 0
        orderCounts.set(webhook.gatewayOrderId, count + 1)

        if (count > 0) {
          duplicates.push(webhook.gatewayOrderId)
        }
      }
    }

    return duplicates
  }

  /**
   * 检查是否为已知恶意IP
   */
  private async isKnownMaliciousIP(ip: string): Promise<boolean> {
    // 这里可以实现IP黑名单检查
    // 可以查询数据库或调用外部服务
    // 目前简化实现
    return false
  }

  /**
   * 清理过期的Webhook记录
   */
  async cleanupExpiredWebhookRecords(daysToKeep = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString()

      const result = await db.delete(schema.paymentsRaw)
        .where(and(
          eq(schema.paymentsRaw.processed, true),
          lt(schema.paymentsRaw.createdAt, cutoffDate)
        ))

      console.log(`Cleaned up ${result.changes} expired webhook records`)
      return result.changes
    } catch (error) {
      console.error('Error cleaning up webhook records:', error)
      return 0
    }
  }

  /**
   * 获取Webhook统计信息
   */
  async getWebhookStats(days = 7): Promise<{
    totalWebhooks: number
    successfulWebhooks: number
    failedWebhooks: number
    successRate: number
    byGateway: Record<string, number>
    bySignatureMethod: Record<string, number>
  }> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

      const stats = await db.select({
        total: sql`COUNT(*)`,
        successful: sql`COUNT(CASE WHEN ${schema.paymentsRaw.signatureValid} = true THEN 1 END)`,
        failed: sql`COUNT(CASE WHEN ${schema.paymentsRaw.signatureValid} = false THEN 1 END)`
      })
        .from(schema.paymentsRaw)
        .where(sql`${schema.paymentsRaw.createdAt} >= ${startDate}`)

      const total = stats[0].total
      const successful = stats[0].successful
      const failed = stats[0].failed

      // 按网关分组统计
      const gatewayStats = await db.select({
        gateway: schema.paymentsRaw.gateway,
        count: sql`COUNT(*)`
      })
        .from(schema.paymentsRaw)
        .where(sql`${schema.paymentsRaw.createdAt} >= ${startDate}`)
        .groupBy(schema.paymentsRaw.gateway)

      // 按签名方法分组统计
      const signatureMethodStats = await db.select({
        method: schema.paymentsRaw.signatureMethod,
        count: sql`COUNT(*)`
      })
        .from(schema.paymentsRaw)
        .where(sql`${schema.paymentsRaw.createdAt} >= ${startDate}`)
        .groupBy(schema.paymentsRaw.signatureMethod)

      const byGateway: Record<string, number> = {}
      const bySignatureMethod: Record<string, number> = {}

      gatewayStats.forEach((stat: any) => {
        byGateway[stat.gateway] = stat.count
      })

      signatureMethodStats.forEach((stat: any) => {
        bySignatureMethod[stat.method || 'unknown'] = stat.count
      })

      return {
        totalWebhooks: total as number,
        successfulWebhooks: successful as number,
        failedWebhooks: failed as number,
        successRate: (total as number) > 0 ? ((successful as number) / (total as number) * 100) : 0,
        byGateway,
        bySignatureMethod
      }
    } catch (error) {
      console.error('Error getting webhook stats:', error)
      return {
        totalWebhooks: 0,
        successfulWebhooks: 0,
        failedWebhooks: 0,
        successRate: 0,
        byGateway: {},
        bySignatureMethod: {}
      }
    }
  }
}

// 创建Webhook安全服务实例
export const webhookSecurityService = new WebhookSecurityService()

export default webhookSecurityService