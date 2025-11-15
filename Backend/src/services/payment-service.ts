import { db, schema } from '../db'
import { and, eq } from 'drizzle-orm'
import { configService } from './config-service'
import { auditService } from './audit-service'
import { paymentGatewayManager, type CreatePaymentParams, type PaymentLink, type PaymentCallback } from './payment-gateway-service'
import { OrderStatus, Gateway, type OrderStatusType, type GatewayType, type CurrencyType, type Order, type GatewayInfo } from '../types/orders'

/**
 * 支付服务
 * 负责支付业务逻辑的封装和协调
 */
export class PaymentService {
  private initialized = false

  /**
   * 初始化支付服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // 初始化支付网关管理器
      await paymentGatewayManager.initialize()

      this.initialized = true
      console.log('Payment service initialized successfully')
    } catch (error) {
      console.error('Failed to initialize payment service:', error)
      throw error
    }
  }

  /**
   * 创建支付
   * 为订单创建支付链接
   */
  async createPayment(
    orderId: string,
    options: {
      gateway?: GatewayType
      returnUrl?: string
      notifyUrl?: string
    } = {}
  ): Promise<PaymentLink> {
    await this.ensureInitialized()

    try {
      // 1. 查询订单信息
      const order = await this.getOrderById(orderId)
      if (!order) {
        throw new Error(`Order ${orderId} not found`)
      }

      // 2. 验证订单状态
      if (order.status !== OrderStatus.PENDING) {
        throw new Error(`Order ${orderId} is not in pending status`)
      }

      // 3. 确定支付网关
      const gatewayName = options.gateway || order.gateway

      // 4. 创建支付
      const productName = await this.getProductName(order.productId)

      const paymentParams: CreatePaymentParams = {
        orderId,
        amount: order.amount,
        currency: order.currency,
        productName,
        customerEmail: order.email,
        returnUrl: options.returnUrl,
        notifyUrl: options.notifyUrl
      }

      const paymentLink = await paymentGatewayManager.createPayment(gatewayName, paymentParams)

      // 5. 更新订单的网关订单ID
      await db.update(schema.orders)
        .set({
          gatewayOrderId: paymentLink.gatewayOrderId,
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.orders.id, orderId))

      // 6. 记录审计日志
      await auditService.logAuditEvent({
        action: 'payment_initiated',
        resourceType: 'payment',
        resourceId: orderId,
        success: true,
        userEmail: order.email,
        metadata: {
          gateway: gatewayName,
          gatewayOrderId: paymentLink.gatewayOrderId,
          amount: order.amount,
          currency: order.currency
        }
      })

      return paymentLink

    } catch (error) {
      // 记录失败日志
      await auditService.logAuditEvent({
        action: 'payment_initiation_failed',
        resourceType: 'payment',
        resourceId: orderId,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      })

      throw error
    }
  }

  /**
   * 查询支付状态
   * 从订单表获取当前支付状态
   */
  async getPaymentStatus(orderId: string): Promise<{
    orderId: string
    status: OrderStatusType
    amount: number
    currency: string
    gateway: GatewayType
    gatewayOrderId?: string
    paidAt?: string
    createdAt: string
  }> {
    await this.ensureInitialized()

    try {
      const order = await this.getOrderById(orderId)
      if (!order) {
        throw new Error(`Order ${orderId} not found`)
      }

      return {
        orderId: order.id,
        status: order.status,
        amount: order.amount,
        currency: order.currency,
        gateway: order.gateway,
        gatewayOrderId: order.gatewayOrderId || undefined,
        paidAt: order.paidAt || undefined,
        createdAt: order.createdAt
      }

    } catch (error) {
      console.error(`Failed to get payment status for order ${orderId}:`, error)
      throw error
    }
  }

  /**
   * 处理支付回调
   * 处理来自支付网关的Webhook回调
   */
  async handleCallback(
    gatewayName: GatewayType,
    payload: any,
    headers: any
  ): Promise<{ success: boolean; message: string; orderId?: string }> {
    await this.ensureInitialized()

    try {
      // 1. 验证Webhook签名
      const verification = await paymentGatewayManager.verifyWebhook(gatewayName, payload, headers)
      if (!verification.isValid) {
        await auditService.logAuditEvent({
          action: 'webhook_signature_verification_failed',
          resourceType: 'webhook',
          resourceId: payload.out_trade_no || payload.order_id || 'unknown',
          success: false,
          errorMessage: verification.error || 'Invalid signature',
          metadata: {
            gateway: gatewayName,
            headers
          }
        })

        return {
          success: false,
          message: verification.error || 'Invalid signature'
        }
      }

      // 2. 解析回调数据
      const callback = paymentGatewayManager.parseCallback(gatewayName, payload)
      if (!callback) {
        throw new Error(`Failed to parse callback from ${gatewayName}`)
      }

      // 3. 记录原始回调数据
      await this.recordRawPayment(gatewayName, callback, true, null)

      // 4. 验证订单信息
      const order = await this.validateOrderForCallback(callback)
      if (!order) {
        return {
          success: false,
          message: 'Order validation failed'
        }
      }

      // 5. 检查重复处理（幂等性）
      const alreadyProcessed = await this.isAlreadyProcessed(gatewayName, callback.gatewayOrderId)
      if (alreadyProcessed) {
        await auditService.logAuditEvent({
          action: 'payment_callback_duplicate',
          resourceType: 'payment',
          resourceId: order.id,
          success: true,
          metadata: {
            gateway: gatewayName,
            gatewayOrderId: callback.gatewayOrderId,
            status: callback.status
          }
        })

        return {
          success: true,
          message: 'Payment already processed',
          orderId: order.id
        }
      }

      // 6. 更新订单状态
      await this.updateOrderStatus(order.id, callback.status, {
        gatewayOrderId: callback.gatewayOrderId,
        gatewayData: JSON.stringify(callback.rawData)
      })

      // 7. 记录审计日志
      await auditService.logAuditEvent({
        action: 'payment_callback_processed',
        resourceType: 'payment',
        resourceId: order.id,
        success: true,
        metadata: {
          gateway: gatewayName,
          gatewayOrderId: callback.gatewayOrderId,
          transactionId: callback.transactionId,
          status: callback.status,
          amount: callback.amount,
          currency: callback.currency
        }
      })

      return {
        success: true,
        message: 'Payment processed successfully',
        orderId: order.id
      }

    } catch (error) {
      // 记录错误日志
      const orderId = payload?.out_trade_no || payload?.order_id || 'unknown'

      await auditService.logAuditEvent({
        action: 'payment_callback_error',
        resourceType: 'payment',
        resourceId: orderId,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          gateway: gatewayName,
          payload: JSON.stringify(payload).substring(0, 500) // 限制长度
        }
      })

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 获取可用的支付网关列表
   */
  async getAvailableGateways(): Promise<GatewayInfo[]> {
    await this.ensureInitialized()

    const enabledGateways = await paymentGatewayManager.getEnabledGateways()

    // 建立货币-网关映射关系
    const currencyGatewayMap: Record<GatewayType, CurrencyType> = {
      alipay: 'CNY',
      creem: 'USD'
    }

    // 转换为详细信息格式
    const gatewayInfoList: GatewayInfo[] = enabledGateways.map(gateway => {
      const gatewayName = gateway.name as GatewayType
      const recommendedCurrency = currencyGatewayMap[gatewayName]

      return {
        id: gatewayName,
        name: gatewayName,
        displayName: gatewayName === 'alipay' ? '支付宝' : 'Creem',
        supportedCurrencies: [recommendedCurrency],
        recommendedCurrency,
        isEnabled: true
      }
    })

    // 记录日志
    console.log(`[PaymentService] 返回 ${gatewayInfoList.length} 个可用支付网关:`, gatewayInfoList.map(g => g.id).join(', '))

    return gatewayInfoList
  }

  /**
   * 验证支付网关配置
   */
  async validateGatewayConfig(gatewayName: GatewayType): Promise<boolean> {
    await this.ensureInitialized()

    const gateway = paymentGatewayManager.getGateway(gatewayName)
    if (!gateway) {
      return false
    }

    try {
      return await gateway.validateConfig()
    } catch (error) {
      console.error(`Gateway ${gatewayName} validation failed:`, error)
      return false
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 确保服务已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  /**
   * 根据ID查询订单
   */
  private async getOrderById(orderId: string): Promise<Order | null> {
    const result = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .limit(1)

    return result[0] ? {
      ...result[0],
      gateway: result[0].gateway as GatewayType,
      currency: result[0].currency as any,
      status: result[0].status as any
    } : null
  }

  /**
   * 获取商品名称
   */
  private async getProductName(productId: number): Promise<string> {
    const result = await db
      .select({ name: schema.products.name })
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1)

    return result[0]?.name || '数字商品'
  }

  /**
   * 验证订单是否与回调匹配
   */
  private async validateOrderForCallback(callback: PaymentCallback): Promise<Order | null> {
    try {
      const order = await this.getOrderById(callback.orderId)
      if (!order) {
        return null
      }

      // 验证金额（允许微小差异）
      const amountDiff = Math.abs(order.amount - callback.amount)
      const maxDiff = Math.max(0.01, order.amount * 0.01) // 1%或0.01

      if (amountDiff > maxDiff) {
        throw new Error(`Amount mismatch: expected ${order.amount}, got ${callback.amount}`)
      }

      // 验证货币
      if (order.currency !== callback.currency) {
        throw new Error(`Currency mismatch: expected ${order.currency}, got ${callback.currency}`)
      }

      return order

    } catch (error) {
      console.error('Order validation failed:', error)
      return null
    }
  }

  /**
   * 检查是否已处理过（幂等性检查）
   */
  private async isAlreadyProcessed(gatewayName: string, gatewayOrderId: string): Promise<boolean> {
    if (!gatewayOrderId) return false

    const result = await db
      .select()
      .from(schema.orders)
      .where(and(
        eq(schema.orders.gatewayOrderId, gatewayOrderId),
        eq(schema.orders.status, OrderStatus.PAID)
      ))
      .limit(1)

    return result.length > 0
  }

  /**
   * 更新订单状态
   */
  private async updateOrderStatus(
    orderId: string,
    status: OrderStatusType,
    options: {
      gatewayOrderId?: string
      gatewayData?: string
    } = {}
  ): Promise<void> {
    const updateData: any = {
      status,
      updatedAt: new Date().toISOString()
    }

    // 如果支付成功，记录支付时间
    if (status === OrderStatus.PAID) {
      updateData.paidAt = new Date().toISOString()
    }

    // 更新可选字段
    if (options.gatewayOrderId) {
      updateData.gatewayOrderId = options.gatewayOrderId
    }
    if (options.gatewayData) {
      updateData.gatewayData = options.gatewayData
    }

    await db
      .update(schema.orders)
      .set(updateData)
      .where(eq(schema.orders.id, orderId))
  }

  /**
   * 记录原始支付数据
   */
  private async recordRawPayment(
    gateway: string,
    callback: PaymentCallback,
    signatureValid: boolean,
    errorMessage: string | null
  ): Promise<void> {
    try {
      await db.insert(schema.paymentsRaw).values({
        gateway,
        gatewayOrderId: callback.gatewayOrderId,
        signatureValid,
        signatureMethod: gateway === 'alipay' ? 'RSA2' : 'HMAC',
        payload: JSON.stringify(callback.rawData),
        processed: true,
        processingAttempts: 1,
        errorMessage: errorMessage,
        processedAt: new Date().toISOString()
      })
    } catch (error) {
      // 记录原始数据失败不应该中断流程
      console.error('Failed to record raw payment:', error)
    }
  }
}

// 创建并导出支付服务实例
export const paymentService = new PaymentService()

export default paymentService
