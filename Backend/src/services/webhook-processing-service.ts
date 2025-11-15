import { db, schema } from '../db'
import { and, eq, gt, sql } from 'drizzle-orm'
import { auditService } from './audit-service'
import { webhookSecurityService } from './webhook-security-service'
import { orderStateService } from './order-state-service'
import { configService } from './config-service'
import type { GatewayType } from '../types/orders'

// 配置常量
const WEBHOOK_PROCESSING_TIMEOUT = parseInt(process.env.WEBHOOK_PROCESSING_TIMEOUT || '30000', 10) // 30秒
const WEBHOOK_MAX_RETRIES = parseInt(process.env.WEBHOOK_MAX_RETRIES || '3', 10) // 3次重试
const WEBHOOK_IDEMPOTENCY_WINDOW = parseInt(process.env.WEBHOOK_IDEMPOTENCY_WINDOW || '86400', 10) // 24小时（秒）

/**
 * Webhook处理结果
 */
export interface WebhookProcessingResult {
  success: boolean
  message: string
  orderId?: string
  processed: boolean
  retryCount?: number
}

/**
 * Webhook处理记录
 */
export interface WebhookRecord {
  id: string
  gateway: string
  gatewayOrderId?: string
  signatureValid: boolean
  signatureMethod: string
  payload: string
  processed: boolean
  processingAttempts: number
  errorMessage?: string
  processedAt?: string
  createdAt: string
}

/**
 * Webhook处理统计信息
 */
export interface WebhookStats {
  totalWebhooks: number
  successfulWebhooks: number
  failedWebhooks: number
  successRate: number
  byGateway: Record<string, number>
  bySignatureMethod: Record<string, number>
}

/**
 * Webhook处理核心服务
 * 负责安全、可靠地处理支付网关回调
 */
export class WebhookProcessingService {
  /**
   * 处理支付宝Webhook
   */
  async processAlipayWebhook(
    payload: Record<string, any>,
    headers: Record<string, string>,
    clientIP?: string
  ): Promise<WebhookProcessingResult> {
    return this.processWebhook('alipay', payload, headers, clientIP)
  }

  /**
   * 处理Creem Webhook
   */
  async processCreemWebhook(
    payload: Record<string, any>,
    headers: Record<string, string>,
    clientIP?: string
  ): Promise<WebhookProcessingResult> {
    return this.processWebhook('creem', payload, headers, clientIP)
  }

  /**
   * 通用Webhook处理流程
   */
  async processWebhook(
    gateway: GatewayType,
    payload: Record<string, any>,
    headers: Record<string, string>,
    clientIP?: string
  ): Promise<WebhookProcessingResult> {
    const startTime = Date.now()
    let recordId: string | null = null

    try {
      console.log(`[Webhook] Processing ${gateway} webhook for order ${payload.out_trade_no || payload.order_id || 'unknown'}`)

      // 1. 验证Webhook签名和安全性
      const verification = await this.verifyWebhook(gateway, payload, headers)
      if (!verification.isValid) {
        const errorMsg = verification.error || 'Invalid signature'
        console.error(`[Webhook] ${gateway} signature verification failed:`, errorMsg)

        // 记录失败尝试
        recordId = await webhookSecurityService.recordWebhookAttempt({
          gateway,
          gatewayOrderId: verification.gatewayOrderId,
          payload: JSON.stringify(payload),
          headers,
          signatureValid: false,
          signatureMethod: verification.method,
          processingResult: 'failed',
          errorMessage: errorMsg
        })

        return {
          success: false,
          message: errorMsg,
          processed: false
        }
      }

      // 2. 检查幂等性
      const idempotencyCheck = await this.checkIdempotency(gateway, verification.gatewayOrderId!)
      if (idempotencyCheck.isProcessed) {
        console.log(`[Webhook] ${gateway} webhook already processed (idempotency hit)`, {
          orderId: idempotencyCheck.orderId,
          status: idempotencyCheck.orderStatus
        })

        // 记录幂等性命中
        await webhookSecurityService.recordWebhookAttempt({
          gateway,
          gatewayOrderId: verification.gatewayOrderId,
          payload: JSON.stringify(payload),
          headers,
          signatureValid: true,
          signatureMethod: verification.method,
          processingResult: 'duplicate'
        })

        return {
          success: true,
          message: 'Webhook already processed',
          orderId: idempotencyCheck.orderId,
          processed: true
        }
      }

      // 3. 验证金额一致性
      const amountValidation = await this.verifyAmount(verification.gatewayOrderId!, verification.amount!)
      if (!amountValidation.isValid) {
        const errorMsg = `Amount mismatch: expected ${amountValidation.expectedAmount}, got ${verification.amount}`
        console.error(`[Webhook] ${gateway} amount validation failed:`, errorMsg)

        await webhookSecurityService.recordWebhookAttempt({
          gateway,
          gatewayOrderId: verification.gatewayOrderId,
          payload: JSON.stringify(payload),
          headers,
          signatureValid: true,
          signatureMethod: verification.method,
          processingResult: 'failed',
          errorMessage: errorMsg
        })

        return {
          success: false,
          message: errorMsg,
          processed: false
        }
      }

      // 4. 记录Webhook尝试
      recordId = await webhookSecurityService.recordWebhookAttempt({
        gateway,
        gatewayOrderId: verification.gatewayOrderId,
        payload: JSON.stringify(payload),
        headers,
        signatureValid: true,
        signatureMethod: verification.method,
        processingResult: 'success'
      })

      // 5. 执行重试机制处理业务逻辑
      const result = await this.processWithRetry(gateway, verification, payload)

      // 6. 更新处理状态
      if (recordId) {
        await webhookSecurityService.updateWebhookStatus(recordId, {
          processed: true,
          processedAt: new Date().toISOString(),
          processingAttempts: 1
        })
      }

      // 7. 记录成功日志
      const duration = Date.now() - startTime
      console.log(`[Webhook] ${gateway} webhook processed successfully in ${duration}ms`, {
        orderId: result.orderId,
        gatewayOrderId: verification.gatewayOrderId
      })

      await auditService.logAuditEvent({
        action: 'webhook_processed',
        resourceType: 'webhook',
        resourceId: result.orderId || verification.gatewayOrderId || 'unknown',
        success: true,
        metadata: {
          gateway,
          gatewayOrderId: verification.gatewayOrderId,
          orderId: result.orderId,
          duration,
          signatureMethod: verification.method
        }
      })

      return {
        success: true,
        message: 'Webhook processed successfully',
        orderId: result.orderId,
        processed: true
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[Webhook] ${gateway} processing error:`, error)

      // 更新记录为失败
      if (recordId) {
        await webhookSecurityService.updateWebhookStatus(recordId, {
          processed: false,
          processingAttempts: 1,
          errorMessage: errorMsg
        })
      }

      // 记录错误日志
      await auditService.logAuditEvent({
        action: 'webhook_processing_error',
        resourceType: 'webhook',
        resourceId: payload.out_trade_no || payload.order_id || 'unknown',
        success: false,
        errorMessage: errorMsg,
        metadata: {
          gateway,
          signatureMethod: 'unknown'
        }
      })

      return {
        success: false,
        message: errorMsg,
        processed: false
      }
    }
  }

  /**
   * 验证Webhook签名
   */
  private async verifyWebhook(
    gateway: GatewayType,
    payload: Record<string, any>,
    headers: Record<string, string>
  ): Promise<{
    isValid: boolean
    method: string
    error?: string
    gatewayOrderId?: string
    amount?: number
  }> {
    const payloadString = JSON.stringify(payload)

    if (gateway === 'alipay') {
      return await webhookSecurityService.verifyAlipayWebhook(payloadString, headers)
    } else if (gateway === 'creem') {
      return await webhookSecurityService.verifyCreemWebhook(payloadString, headers)
    }

    return {
      isValid: false,
      method: 'unknown',
      error: `Unsupported gateway: ${gateway}`
    }
  }

  /**
   * 检查Webhook幂等性
   */
  private async checkIdempotency(gateway: string, gatewayOrderId?: string): Promise<{
    isProcessed: boolean
    orderId?: string
    orderStatus?: string
  }> {
    if (!gatewayOrderId) {
      return { isProcessed: false }
    }

    // 检查payments_raw表
    const oneHourAgo = new Date(Date.now() - WEBHOOK_IDEMPOTENCY_WINDOW * 1000).toISOString()

    const rawRecord = await db.select()
      .from(schema.paymentsRaw)
      .where(and(
        eq(schema.paymentsRaw.gateway, gateway),
        eq(schema.paymentsRaw.gatewayOrderId, gatewayOrderId),
        eq(schema.paymentsRaw.processed, true),
        gt(schema.paymentsRaw.createdAt, oneHourAgo)
      ))
      .limit(1)

    if (rawRecord.length > 0) {
      return {
        isProcessed: true,
        orderId: rawRecord[0].id.toString()
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
        orderId: orderRecord[0].id,
        orderStatus: orderRecord[0].status
      }
    }

    return { isProcessed: false }
  }

  /**
   * 验证金额一致性
   */
  private async verifyAmount(gatewayOrderId: string, webhookAmount: number): Promise<{
    isValid: boolean
    expectedAmount?: number
    orderId?: string
  }> {
    return await webhookSecurityService.verifyOrderAmount(gatewayOrderId, webhookAmount)
  }

  /**
   * 带重试机制的业务逻辑处理
   */
  private async processWithRetry(
    gateway: GatewayType,
    verification: any,
    payload: Record<string, any>
  ): Promise<{ orderId: string }> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= WEBHOOK_MAX_RETRIES; attempt++) {
      try {
        // 提取订单ID
        const orderId = payload.out_trade_no || payload.order_id
        if (!orderId) {
          throw new Error('Order ID not found in payload')
        }

        // 解析支付状态
        const paymentStatus = this.parsePaymentStatus(gateway, payload)
        if (!paymentStatus) {
          throw new Error(`Unknown payment status from ${gateway}`)
        }

        // 使用订单状态服务更新状态
        const result = await orderStateService.updateOrderStatusFromWebhook(
          orderId,
          gateway,
          verification.gatewayOrderId,
          paymentStatus,
          {
            transactionId: payload.trade_no || payload.transaction_id,
            paidAt: new Date().toISOString(),
            gatewayData: JSON.stringify(payload)
          }
        )

        return { orderId: result.orderId }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')

        if (attempt < WEBHOOK_MAX_RETRIES) {
          // 指数退避
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
          console.log(`[Webhook] Retry attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError || new Error('Max retries exceeded')
  }

  /**
   * 解析支付状态
   */
  private parsePaymentStatus(gateway: GatewayType, payload: Record<string, any>): string | null {
    if (gateway === 'alipay') {
      const status = payload.trade_status
      switch (status) {
        case 'TRADE_SUCCESS':
        case 'TRADE_FINISHED':
          return 'paid'
        case 'TRADE_CLOSED':
          return 'cancelled'
        case 'WAIT_BUYER_PAY':
          return 'pending'
        default:
          return null
      }
    } else if (gateway === 'creem') {
      const status = payload.status
      switch (status) {
        case 'payment_succeeded':
          return 'paid'
        case 'payment_cancelled':
          return 'cancelled'
        case 'payment_pending':
          return 'pending'
        default:
          return null
      }
    }

    return null
  }

  /**
   * 获取Webhook统计信息
   */
  async getWebhookStats(days = 7): Promise<WebhookStats> {
    return await webhookSecurityService.getWebhookStats(days)
  }

  /**
   * 获取Webhook处理日志
   */
  async getWebhookLogs(options: {
    gateway?: string
    startDate?: string
    endDate?: string
    status?: string
    orderId?: string
    page?: number
    pageSize?: number
  }): Promise<{
    records: WebhookRecord[]
    total: number
  }> {
    const page = options.page || 1
    const pageSize = options.pageSize || 50
    const offset = (page - 1) * pageSize

    const conditions = []

    if (options.gateway) {
      conditions.push(eq(schema.paymentsRaw.gateway, options.gateway))
    }

    if (options.startDate) {
      conditions.push(gt(schema.paymentsRaw.createdAt, options.startDate))
    }

    if (options.endDate) {
      conditions.push(sql`${schema.paymentsRaw.createdAt} <= ${options.endDate}`)
    }

    if (options.status === 'success') {
      conditions.push(eq(schema.paymentsRaw.processed, true))
    } else if (options.status === 'failed') {
      conditions.push(eq(schema.paymentsRaw.processed, false))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const records = await db.select()
      .from(schema.paymentsRaw)
      .where(whereClause)
      .orderBy(sql`${schema.paymentsRaw.createdAt} DESC`)
      .limit(pageSize)
      .offset(offset)

    // 获取总数
    const countResult = await db.select({
      count: sql`COUNT(*)`
    })
      .from(schema.paymentsRaw)
      .where(whereClause)

    return {
      records: records.map(r => ({
        id: r.id.toString(),
        gateway: r.gateway,
        gatewayOrderId: r.gatewayOrderId || undefined,
        signatureValid: r.signatureValid || false,
        signatureMethod: r.signatureMethod || 'unknown',
        payload: r.payload,
        processed: r.processed || false,
        processingAttempts: r.processingAttempts || 0,
        errorMessage: r.errorMessage || undefined,
        processedAt: r.processedAt || undefined,
        createdAt: r.createdAt || ''
      })),
      total: Number(countResult[0].count)
    }
  }

  /**
   * 手动重新处理Webhook记录
   */
  async reprocessWebhook(recordId: string): Promise<WebhookProcessingResult> {
    try {
      // 获取Webhook记录
      const [record] = await db.select()
        .from(schema.paymentsRaw)
        .where(eq(schema.paymentsRaw.id, parseInt(recordId)))
        .limit(1)

      if (!record) {
        return {
          success: false,
          message: 'Webhook record not found',
          processed: false
        }
      }

      // 解析payload
      let payload: Record<string, any>
      try {
        payload = JSON.parse(record.payload)
      } catch {
        return {
          success: false,
          message: 'Invalid payload format',
          processed: false
        }
      }

      console.log(`[Webhook] Reprocessing webhook record ${recordId}`)

      // 重新处理
      const result = await this.processWebhook(
        record.gateway as GatewayType,
        payload,
        {}, // headers not stored
        undefined
      )

      // 记录重新处理操作
      await auditService.logAuditEvent({
        action: 'webhook_reprocessed',
        resourceType: 'webhook',
        resourceId: recordId,
        success: result.success,
        metadata: {
          originalGateway: record.gateway,
          gatewayOrderId: record.gatewayOrderId
        }
      })

      return result

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[Webhook] Reprocessing failed for record ${recordId}:`, error)

      return {
        success: false,
        message: errorMsg,
        processed: false
      }
    }
  }

  /**
   * 清理过期的Webhook记录
   */
  async cleanupExpiredRecords(daysToKeep = 30): Promise<number> {
    return await webhookSecurityService.cleanupExpiredWebhookRecords(daysToKeep)
  }
}

// 创建并导出Webhook处理服务实例
export const webhookProcessingService = new WebhookProcessingService()

export default webhookProcessingService
