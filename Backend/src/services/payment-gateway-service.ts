import { configService } from './config-service'
import { auditService } from './audit-service'
import type { OrderStatusType, GatewayType, CurrencyType } from '../types/orders'

// ==============================================
// 支付网关接口定义
// ==============================================

/**
 * 支付网关配置
 */
export interface GatewayConfig {
  enabled: boolean
  timeout?: number
  retryCount?: number
}

/**
 * 支付宝配置
 */
export interface AlipayConfig extends GatewayConfig {
  appId: string
  privateKey: string
  publicKey: string
  gatewayUrl: string
  signType: 'RSA2'
  version?: string
}

/**
 * Creem配置
 */
export interface CreemConfig extends GatewayConfig {
  apiKey: string
  webhookSecret: string
  baseUrl: string
}

/**
 * 创建支付参数
 */
export interface CreatePaymentParams {
  orderId: string
  amount: number
  currency: CurrencyType
  productName: string
  customerEmail: string
  returnUrl?: string
  notifyUrl?: string
}

/**
 * 支付链接响应
 */
export interface PaymentLink {
  paymentUrl: string
  gatewayOrderId: string
  expiresAt?: string
}

/**
 * 支付状态（与订单状态保持一致）
 */
export type PaymentStatus = OrderStatusType

/**
 * 支付回调数据
 */
export interface PaymentCallback {
  orderId: string
  gatewayOrderId: string
  transactionId?: string
  status: PaymentStatus
  amount: number
  currency: CurrencyType
  rawData: any
}

/**
 * 签名验证结果
 */
export interface SignatureVerification {
  isValid: boolean
  error?: string
}

/**
 * 支付网关接口
 */
export interface IPaymentGateway {
  name: string
  createPayment(params: CreatePaymentParams): Promise<PaymentLink>
  verifyWebhook(payload: any, headers: any): Promise<SignatureVerification>
  parseCallback(payload: any): PaymentCallback
  validateConfig(): Promise<boolean>
}

// ==============================================
// 支付宝网关实现
// ==============================================

/**
 * 支付宝网关
 */
export class AlipayGateway implements IPaymentGateway {
  name = 'alipay'
  private config: AlipayConfig | null = null

  /**
   * 加载支付宝配置
   */
  private async loadConfig(): Promise<AlipayConfig> {
    if (this.config) {
      return this.config
    }

    const enabled = await configService.getConfig('payment', 'alipay_enabled', false)
    if (!enabled) {
      throw new Error('Alipay payment gateway is disabled')
    }

    this.config = {
      enabled,
      appId: await configService.getConfig('payment', 'alipay_app_id', '', { includeEncrypted: true }),
      privateKey: await configService.getConfig('payment', 'alipay_private_key', '', { includeEncrypted: true }),
      publicKey: await configService.getConfig('payment', 'alipay_public_key', '', { includeEncrypted: true }),
      gatewayUrl: await configService.getConfig('payment', 'alipay_gateway_url',
        'https://openapi.alipay.com/gateway.do'),
      signType: 'RSA2',
      version: await configService.getConfig('payment', 'alipay_version', '1.0'),
      timeout: await configService.getConfig('payment', 'alipay_timeout', 30000),
      retryCount: await configService.getConfig('payment', 'alipay_retry_count', 3)
    }

    return this.config
  }

  /**
   * 验证配置
   */
  async validateConfig(): Promise<boolean> {
    try {
      const config = await this.loadConfig()

      if (!config.appId || !config.privateKey || !config.publicKey) {
        throw new Error('Missing required Alipay configuration')
      }

      // 验证RSA密钥格式
      if (!this.validateRSAKey(config.privateKey) || !this.validateRSAKey(config.publicKey)) {
        throw new Error('Invalid RSA key format')
      }

      return true
    } catch (error) {
      console.error('Alipay config validation failed:', error)
      return false
    }
  }

  /**
   * 创建支付
   */
  async createPayment(params: CreatePaymentParams): Promise<PaymentLink> {
    const config = await this.loadConfig()

    try {
      const gatewayOrderId = `ALIPAY_${params.orderId}_${Date.now()}`

      // 构建支付参数
      const bizContent = {
        out_trade_no: gatewayOrderId,
        total_amount: params.amount.toFixed(2),
        subject: params.productName,
        body: `订单号：${params.orderId}`,
        product_code: 'FAST_INSTANT_TRADE_PAY'
      }

      // 格式化时间：yyyy-MM-dd HH:mm:ss
      const formatDate = (date: Date): string => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        const seconds = String(date.getSeconds()).padStart(2, '0')
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
      }

      const params_map = {
        app_id: config.appId,
        method: 'alipay.trade.page.pay',
        charset: 'utf-8',
        sign_type: config.signType,
        timestamp: formatDate(new Date()),
        version: config.version,
        notify_url: params.notifyUrl || `${process.env.BASE_URL}/webhooks/alipay`,
        return_url: params.returnUrl || `${process.env.FRONTEND_URL}/payment/return`,
        biz_content: JSON.stringify(bizContent)
      }

      // 生成签名
      const sign = this.generateSign(params_map, config.privateKey)

      // 构建支付URL
      const paymentUrl = `${config.gatewayUrl}?${this.buildQueryString({ ...params_map, sign })}`

      await auditService.logAuditEvent({
        action: 'payment_created',
        resourceType: 'payment',
        resourceId: params.orderId,
        success: true,
        userEmail: params.customerEmail,
        metadata: {
          gateway: 'alipay',
          gatewayOrderId,
          amount: params.amount,
          currency: params.currency
        }
      })

      return {
        paymentUrl,
        gatewayOrderId,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30分钟过期
      }

    } catch (error) {
      await auditService.logAuditEvent({
        action: 'payment_creation_failed',
        resourceType: 'payment',
        resourceId: params.orderId,
        success: false,
        userEmail: params.customerEmail,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      })

      throw error
    }
  }

  /**
   * 验证Webhook签名
   */
  async verifyWebhook(payload: any, headers: any): Promise<SignatureVerification> {
    try {
      const config = await this.loadConfig()

      if (!headers['x-alipay-signature'] && !headers['sign']) {
        return { isValid: false, error: 'Missing signature header' }
      }

      const signature = headers['x-alipay-signature'] || headers['sign']

      if (!this.verifySign(payload, config.publicKey, signature)) {
        return { isValid: false, error: 'Invalid signature' }
      }

      return { isValid: true }

    } catch (error) {
      console.error('Alipay signature verification error:', error)
      return { isValid: false, error: 'Signature verification failed' }
    }
  }

  /**
   * 解析支付回调
   */
  parseCallback(payload: any): PaymentCallback {
    // 支付宝回调数据解析
    const status = payload.trade_status === 'TRADE_SUCCESS' || payload.trade_status === 'TRADE_FINISHED'
      ? 'success'
      : payload.trade_status === 'TRADE_CLOSED'
      ? 'failed'
      : 'pending'

    return {
      orderId: payload.out_trade_no,
      gatewayOrderId: payload.trade_no,
      transactionId: payload.trade_no,
      status,
      amount: parseFloat(payload.total_amount),
      currency: 'CNY', // 支付宝默认人民币
      rawData: payload
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 验证RSA密钥格式
   */
  private validateRSAKey(key: string): boolean {
    if (!key) return false

    // 简单格式验证（应该包含BEGIN/END标记）
    return key.includes('BEGIN') && key.includes('END')
  }

  /**
   * 生成RSA2签名
   */
  private generateSign(params: Record<string, string>, privateKey: string): string {
    // TODO: 实现RSA2签名
    // 这里需要使用crypto模块和RSA-SHA256算法
    // 在实际实现中，需要考虑PKCS#1或PKCS#8格式的密钥

    const signString = this.buildQueryString(params)
    // 临时返回占位符
    throw new Error('RSA2 signature generation not implemented yet')

    // 实际实现将包括：
    // 1. 排序参数
    // 2. 构建签名字符串
    // 3. 使用RSA-SHA256算法签名
    // 4. Base64编码
  }

  /**
   * 验证签名
   */
  private verifySign(payload: any, publicKey: string, signature: string): boolean {
    // TODO: 实现签名验证
    // 实际实现将包括：
    // 1. 排序参数
    // 2. 构建签名字符串
    // 3. 使用RSA-SHA256算法验证
    // 4. Base64解码

    throw new Error('Signature verification not implemented yet')
  }

  /**
   * 构建查询字符串
   */
  private buildQueryString(params: Record<string, any>): string {
    return Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null && value !== '')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&')
  }
}

// ==============================================
// Creem网关实现
// ==============================================

/**
 * Creem网关
 */
export class CreemGateway implements IPaymentGateway {
  name = 'creem'
  private config: CreemConfig | null = null

  /**
   * 加载Creem配置
   */
  private async loadConfig(): Promise<CreemConfig> {
    if (this.config) {
      return this.config
    }

    const enabled = await configService.getConfig('payment', 'creem_enabled', false)
    if (!enabled) {
      throw new Error('Creem payment gateway is disabled')
    }

    this.config = {
      enabled,
      apiKey: await configService.getConfig('payment', 'creem_api_key', '', { includeEncrypted: true }),
      webhookSecret: await configService.getConfig('payment', 'creem_webhook_secret', '', { includeEncrypted: true }),
      baseUrl: await configService.getConfig('payment', 'creem_base_url', 'https://api.creem.io'),
      timeout: await configService.getConfig('payment', 'creem_timeout', 30000),
      retryCount: await configService.getConfig('payment', 'creem_retry_count', 3)
    }

    return this.config
  }

  /**
   * 验证配置
   */
  async validateConfig(): Promise<boolean> {
    try {
      const config = await this.loadConfig()

      if (!config.apiKey || !config.webhookSecret) {
        throw new Error('Missing required Creem configuration')
      }

      return true
    } catch (error) {
      console.error('Creem config validation failed:', error)
      return false
    }
  }

  /**
   * 创建支付
   */
  async createPayment(params: CreatePaymentParams): Promise<PaymentLink> {
    const config = await this.loadConfig()

    try {
      const gatewayOrderId = `CREEM_${params.orderId}_${Date.now()}`

      // 构建支付请求
      const requestBody = {
        order_id: gatewayOrderId,
        amount: params.amount,
        currency: params.currency,
        description: params.productName,
        customer_email: params.customerEmail,
        return_url: params.returnUrl || `${process.env.FRONTEND_URL}/payment/return`,
        webhook_url: params.notifyUrl || `${process.env.BASE_URL}/webhooks/creem`,
        metadata: {
          order_id: params.orderId
        }
      }

      // TODO: 调用Creem API创建支付
      // 这里将发送HTTP请求到Creem支付API

      await auditService.logAuditEvent({
        action: 'payment_created',
        resourceType: 'payment',
        resourceId: params.orderId,
        success: true,
        userEmail: params.customerEmail,
        metadata: {
          gateway: 'creem',
          gatewayOrderId,
          amount: params.amount,
          currency: params.currency
        }
      })

      // 临时返回模拟数据
      return {
        paymentUrl: `https://creem.io/pay/${gatewayOrderId}`,
        gatewayOrderId,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      }

    } catch (error) {
      await auditService.logAuditEvent({
        action: 'payment_creation_failed',
        resourceType: 'payment',
        resourceId: params.orderId,
        success: false,
        userEmail: params.customerEmail,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      })

      throw error
    }
  }

  /**
   * 验证Webhook
   */
  async verifyWebhook(payload: any, headers: any): Promise<SignatureVerification> {
    try {
      const config = await this.loadConfig()

      const webhookSecret = headers['x-creem-signature'] || headers['signature']

      if (!webhookSecret) {
        return { isValid: false, error: 'Missing webhook signature' }
      }

      // TODO: 验证Webhook签名
      // 使用HMAC或SHA256验证

      return { isValid: true }

    } catch (error) {
      console.error('Creem webhook verification error:', error)
      return { isValid: false, error: 'Webhook verification failed' }
    }
  }

  /**
   * 解析支付回调
   */
  parseCallback(payload: any): PaymentCallback {
    const status = payload.status === 'payment_succeeded'
      ? 'success'
      : payload.status === 'failed' || payload.status === 'cancelled'
      ? 'failed'
      : 'pending'

    return {
      orderId: payload.order_id,
      gatewayOrderId: payload.transaction_id || payload.order_id,
      transactionId: payload.transaction_id,
      status,
      amount: parseFloat(payload.amount),
      currency: payload.currency || 'USD',
      rawData: payload
    }
  }
}

// ==============================================
// 支付网关管理器
// ==============================================

/**
 * 支付网关管理器
 */
export class PaymentGatewayManager {
  private gateways = new Map<string, IPaymentGateway>()
  private initialized = false

  /**
   * 注册网关
   */
  registerGateway(gateway: IPaymentGateway): void {
    this.gateways.set(gateway.name, gateway)
  }

  /**
   * 初始化所有网关
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    // 注册默认网关
    this.registerGateway(new AlipayGateway())
    this.registerGateway(new CreemGateway())

    // 验证所有已启用的网关配置
    await Promise.all(
      Array.from(this.gateways.entries()).map(async ([name, gateway]) => {
        try {
          const isValid = await gateway.validateConfig()
          if (!isValid) {
            console.warn(`Gateway ${name} configuration is invalid, skipping`)
          }
        } catch (error) {
          console.error(`Failed to validate ${name} gateway:`, error)
        }
      })
    )

    this.initialized = true
  }

  /**
   * 获取网关
   */
  getGateway(name: string): IPaymentGateway | undefined {
    return this.gateways.get(name)
  }

  /**
   * 获取所有启用的网关
   */
  async getEnabledGateways(): Promise<IPaymentGateway[]> {
    if (!this.initialized) {
      await this.initialize()
    }

    const results: IPaymentGateway[] = []

    for (const [name, gateway] of this.gateways) {
      try {
        const isValid = await gateway.validateConfig()
        if (isValid) {
          results.push(gateway)
        }
      } catch (error) {
        console.warn(`Gateway ${name} not available:`, error)
      }
    }

    return results
  }

  /**
   * 创建支付
   */
  async createPayment(
    gatewayName: string,
    params: CreatePaymentParams
  ): Promise<PaymentLink> {
    const gateway = this.getGateway(gatewayName)
    if (!gateway) {
      throw new Error(`Gateway ${gatewayName} not found`)
    }

    return await gateway.createPayment(params)
  }

  /**
   * 验证Webhook
   */
  async verifyWebhook(
    gatewayName: string,
    payload: any,
    headers: any
  ): Promise<SignatureVerification> {
    const gateway = this.getGateway(gatewayName)
    if (!gateway) {
      return { isValid: false, error: `Gateway ${gatewayName} not found` }
    }

    return await gateway.verifyWebhook(payload, headers)
  }

  /**
   * 解析回调
   */
  parseCallback(gatewayName: string, payload: any): PaymentCallback | null {
    const gateway = this.getGateway(gatewayName)
    if (!gateway) {
      throw new Error(`Gateway ${gatewayName} not found`)
    }

    return gateway.parseCallback(payload)
  }
}

// 创建全局网关管理器实例
export const paymentGatewayManager = new PaymentGatewayManager()

export default paymentGatewayManager
