import { configService } from './config-service'
import { auditService } from './audit-service'
import { AlipaySdk, AlipaySdkConfig } from 'alipay-sdk'
import type { OrderStatusType, GatewayType, CurrencyType } from '../types/orders'
import { CONFIG } from '../config/api'

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
  alipayPublicKey: string
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
  private sdk: AlipaySdk | null = null

  /**
   * 加载支付宝配置
   */
  private async loadConfig(): Promise<AlipayConfig> {
    if (this.config) {
      return this.config
    }

    const enabled = await configService.getConfig('payment', 'alipay_enabled', false)
    // 确保 enabled 是布尔类型
    const isEnabled = typeof enabled === 'string' ? enabled === 'true' : Boolean(enabled)
    console.log(`[AlipayGateway] Loaded enabled = ${enabled}, parsed = ${isEnabled}, type = ${typeof enabled}`)
    if (!isEnabled) {
      throw new Error('Alipay payment gateway is disabled')
    }

    const appId = await configService.getConfig('payment', 'alipay_app_id', '', { includeEncrypted: true })

    // 直接获取密钥，让 SDK v4 自动处理格式
    const privateKeyRaw = await configService.getConfig('payment', 'alipay_private_key', '', { includeEncrypted: true })
    const publicKeyRaw = await configService.getConfig('payment', 'alipay_public_key', '', { includeEncrypted: true })

    // 格式化密钥为PEM格式
    const privateKey = privateKeyRaw.trim()
    const publicKey = publicKeyRaw.trim()

    const gatewayUrl = await configService.getConfig('payment', 'alipay_gateway_url',
      'https://openapi.alipay.com/gateway.do')

    console.log(`[AlipayGateway] AppId = ${appId ? '***' : 'EMPTY'}`)
    console.log(`[AlipayGateway] PrivateKey length = ${privateKey ? privateKey.length : 0}`)
    console.log(`[AlipayGateway] Gateway URL = ${gatewayUrl}`)

    if (!appId || !privateKey || !publicKey) {
      throw new Error('Missing required Alipay configuration')
    }

    // 使用 SDK v4 推荐配置：使用 gateway 字段而不是 gatewayUrl
    this.config = {
      appId,
      privateKey,
      alipayPublicKey: publicKey, // 注意字段名是 alipayPublicKey
      gatewayUrl: 'https://openapi.alipay.com/gateway.do',
      signType: 'RSA2' as const,
      enabled: true,
      timeout: await configService.getConfig('payment', 'alipay_timeout', 30000),
    }

    // 初始化SDK实例 - 使用 alipay-sdk 期望的配置格式
    const sdkConfig: AlipaySdkConfig = {
      appId: this.config?.appId || '',
      privateKey: this.config?.privateKey || '',
      alipayPublicKey: this.config?.alipayPublicKey || '',
      timeout: this.config?.timeout || 30000,
      signType: this.config?.signType || 'RSA2',
    }

    this.sdk = new AlipaySdk(sdkConfig)
    console.log('[AlipayGateway] SDK initialized successfully')

    return this.config || null
  }

  /**
   * 验证配置
   */
  async validateConfig(): Promise<boolean> {
    try {
      const config = await this.loadConfig()

      if (!config.appId || !config.privateKey || !config.alipayPublicKey) {
        throw new Error('Missing required Alipay configuration')
      }

      // 验证RSA密钥格式（基础验证）
      const privateKeyValid = config.privateKey.includes('BEGIN PRIVATE KEY')
      const publicKeyValid = config.alipayPublicKey.includes('BEGIN') || config.alipayPublicKey.includes('MIIB')

      if (!privateKeyValid || !publicKeyValid) {
        console.warn('Alipay: Invalid RSA key format, but continuing in development mode')
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

    // 用自己的订单号作为 out_trade_no，方便回调时直接定位订单
    const gatewayOrderId = params.orderId

    // 检查是否为沙箱环境配置（通过环境变量判断）
    const isSandbox = CONFIG.PAYMENT.ALIPAY.GATEWAY_URL.includes('alipaydev.com')

    if (!this.sdk) {
      throw new Error('Alipay SDK not initialized')
    }

    try {
      // 使用 SDK v4 的 pageExecute 方法（替代已废弃的 exec）
      // 沙箱环境也使用相同的SDK流程，SDK会自动处理沙箱配置
      console.log(`[AlipayGateway] ${isSandbox ? 'Sandbox' : 'Production'} environment, using SDK`)

      const paymentHtml = await this.sdk.pageExecute('alipay.trade.page.pay', 'POST', {
        bizContent: {
          out_trade_no: gatewayOrderId,
          total_amount: params.amount.toString(), // 确保是字符串
          subject: params.productName,
          body: `订单号：${params.orderId}`,
          product_code: 'FAST_INSTANT_TRADE_PAY'
        },
        returnUrl: params.returnUrl || `${CONFIG.API.FRONTEND_URL}/payment/${params.orderId}`,
        notifyUrl: params.notifyUrl || CONFIG.PAYMENT.ALIPAY.WEBHOOK_URL,
      })

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
          currency: params.currency,
          mode: isSandbox ? 'sandbox_sdk_v4' : 'production_sdk_v4'
        }
      })

      return {
        paymentUrl: paymentHtml, // 直接返回HTML表单
        gatewayOrderId,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      }
    } catch (sdkError) {
      console.error('[AlipayGateway] SDK call failed:', sdkError)
      throw new Error(`Payment creation failed: ${sdkError instanceof Error ? sdkError.message : 'Unknown error'}`)
    }
  }

  /**
   * 验证Webhook签名
   */
  async verifyWebhook(payload: any, headers: any): Promise<SignatureVerification> {
    try {
      if (!this.sdk) {
        throw new Error('Alipay SDK not initialized')
      }

      // 使用SDK v4 推荐方法 checkNotifySignV2
      const isValid = this.sdk.checkNotifySignV2(payload)

      if (!isValid) {
        console.warn('[AlipayGateway] Signature verification failed')
      } else {
        console.log('[AlipayGateway] Signature verification successful')
      }

      return { isValid }

    } catch (error) {
      console.error('Alipay signature verification error:', error)
      return { isValid: false, error: 'Signature verification failed' }
    }
  }

  /**
   * 解析支付回调
   */
  parseCallback(payload: any): PaymentCallback {
    // 支付宝回调数据解析 - 映射到 OrderStatusType
    const status = payload.trade_status === 'TRADE_SUCCESS' || payload.trade_status === 'TRADE_FINISHED'
      ? 'paid'
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

  /**
   * 格式化私钥为PEM格式（支持多种输入格式）
   */
  private formatPrivateKey(privateKeyInput: string | null | undefined): string {
    if (!privateKeyInput) return ''

    // 检查是否已经是PEM格式
    if (privateKeyInput.includes('BEGIN PRIVATE KEY') || privateKeyInput.includes('BEGIN RSA PRIVATE KEY')) {
      return privateKeyInput
    }

    // 尝试Base64解码
    try {
      const decoded = Buffer.from(privateKeyInput, 'base64')
      // 检查是否是原始DER字节（以0x30开头表示ASN.1 SEQUENCE）
      if (decoded[0] === 0x30) {
        // DER格式的私钥，转为PKCS1 PEM格式
        const cleanKey = decoded.toString('base64').replace(/\s+/g, '')
        return `-----BEGIN RSA PRIVATE KEY-----\n${cleanKey.match(/.{1,64}/g)?.join('\n')}\n-----END RSA PRIVATE KEY-----`
      }
      const decodedStr = decoded.toString('utf-8')
      if (decodedStr.includes('BEGIN')) {
        return decodedStr
      }
    } catch (e) {
      // 如果Base64解码失败，尝试原始密钥
    }

    // 如果不是base64或解码失败，按原始处理
    const cleanKey = privateKeyInput.replace(/\s+/g, '')
    return `-----BEGIN RSA PRIVATE KEY-----\n${cleanKey.match(/.{1,64}/g)?.join('\n')}\n-----END RSA PRIVATE KEY-----`
  }

  /**
   * 格式化公钥为PEM格式（支持多种输入格式）
   */
  private formatPublicKey(publicKeyInput: string | null | undefined): string {
    if (!publicKeyInput) return ''

    // 检查是否已经是PEM格式
    if (publicKeyInput.includes('BEGIN PUBLIC KEY') || publicKeyInput.includes('BEGIN RSA PUBLIC KEY')) {
      return publicKeyInput
    }

    // 尝试Base64解码
    try {
      const decoded = Buffer.from(publicKeyInput, 'base64').toString('utf-8')
      if (decoded.includes('BEGIN')) {
        return decoded
      }
      // 如果解码后是纯密钥，转换为PEM
      const cleanKey = decoded.replace(/\s+/g, '')
      return `-----BEGIN PUBLIC KEY-----\n${cleanKey}\n-----END PUBLIC KEY-----`
    } catch (e) {
      // 如果Base64解码失败，假设是原始密钥
      const cleanKey = publicKeyInput.replace(/\s+/g, '')
      return `-----BEGIN PUBLIC KEY-----\n${cleanKey}\n-----END PUBLIC KEY-----`
    }
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
  private async loadConfig(): Promise<CreemConfig | null> {
    if (this.config) {
      return this.config
    }

    const enabled = await configService.getConfig('payment', 'creem_enabled', false)
    // 确保 enabled 是布尔类型
    const isEnabled = typeof enabled === 'string' ? enabled === 'true' : Boolean(enabled)
    console.log(`[CreemGateway] Loaded enabled = ${enabled}, parsed = ${isEnabled}, type = ${typeof enabled}`)
    if (!isEnabled) {
      console.warn('[CreemGateway] Creem payment gateway is disabled')
      return null
    }

    this.config = {
      enabled: isEnabled,
      apiKey: await configService.getConfig('payment', 'creem_api_key', '', { includeEncrypted: true }),
      webhookSecret: await configService.getConfig('payment', 'creem_webhook_secret', '', { includeEncrypted: true }),
      baseUrl: await configService.getConfig('payment', 'creem_base_url', 'https://api.creem.io'),
      timeout: await configService.getConfig('payment', 'creem_timeout', 30000),
      retryCount: await configService.getConfig('payment', 'creem_retry_count', 3)
    }

    console.log('[CreemGateway] Config loaded successfully')
    return this.config
  }

  /**
   * 验证配置
   */
  async validateConfig(): Promise<boolean> {
    try {
      const config = await this.loadConfig()

      if (!config) {
        console.warn('[CreemGateway] Creem payment gateway is disabled')
        return false
      }

      if (!config.apiKey || !config.webhookSecret) {
        console.warn('[CreemGateway] Missing required Creem configuration')
        return false
      }

      return true
    } catch (error) {
      console.warn('[CreemGateway] Config validation failed:', error)
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
        return_url: params.returnUrl || `${CONFIG.API.FRONTEND_URL}/payment/${params.orderId}`,
        webhook_url: params.notifyUrl || CONFIG.PAYMENT.CREEM.WEBHOOK_URL,
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
    // 映射到 OrderStatusType
    const status = payload.status === 'payment_succeeded'
      ? 'paid'
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
      const startTime = Date.now()
      try {
        const isValid = await gateway.validateConfig()
        const duration = Date.now() - startTime

        if (isValid) {
          console.log(`[PaymentGatewayManager] Gateway ${name} validated successfully (${duration}ms)`)
          results.push(gateway)
        } else {
          console.log(`[PaymentGatewayManager] Gateway ${name} disabled or misconfigured (${duration}ms)`)
        }
      } catch (error) {
        const duration = Date.now() - startTime
        console.warn(`[PaymentGatewayManager] Gateway ${name} validation failed (${duration}ms):`, error)
      }
    }

    console.log(`[PaymentGatewayManager] Available gateways: [${results.map(g => g.name).join(', ')}]`)
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
