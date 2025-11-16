/**
 * API 配置
 * 统一管理所有 API 相关的配置
 */

// 先抽出基础环境变量，方便复用
const PORT = Number(process.env.PORT) || 3100
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// 基础配置
export const API_CONFIG = {
  PORT,
  BASE_URL,
  FRONTEND_URL,
  // ✅ 用 BASE_URL 组装健康检查地址，生产环境也能对外使用
  HEALTH_CHECK_URL: `${BASE_URL}/api/health`,
} as const

// 支付网关配置
export const PAYMENT_CONFIG = {
  ALIPAY: {
    ENABLED: process.env.PAYMENT_ALIPAY_ENABLED === 'true',
    APP_ID: process.env.PAYMENT_ALIPAY_APP_ID || '',
    GATEWAY_URL:
      process.env.PAYMENT_ALIPAY_GATEWAY_URL ||
      'https://openapi.alipay.com/gateway.do',
    VERSION: process.env.PAYMENT_ALIPAY_VERSION || '1.0',
    TIMEOUT: Number(process.env.PAYMENT_ALIPAY_TIMEOUT) || 30000,
    RETRY_COUNT: Number(process.env.PAYMENT_ALIPAY_RETRY_COUNT) || 3,
    WEBHOOK_URL: `${BASE_URL}/webhooks/alipay`,
    RETURN_URL: `${FRONTEND_URL}/payment/return`,
  },
  CREEM: {
    ENABLED: process.env.PAYMENT_CREEM_ENABLED === 'true',
    API_KEY: process.env.PAYMENT_CREEM_API_KEY || '',
    WEBHOOK_SECRET: process.env.PAYMENT_CREEM_WEBHOOK_SECRET || '',
    BASE_URL: process.env.PAYMENT_CREEM_BASE_URL || 'https://api.creem.io',
    TIMEOUT: Number(process.env.PAYMENT_CREEM_TIMEOUT) || 30000,
    RETRY_COUNT: Number(process.env.PAYMENT_CREEM_RETRY_COUNT) || 3,
    WEBHOOK_URL: `${BASE_URL}/webhooks/creem`,
  },
  COMMON: {
    WEBHOOK_TIMEOUT: Number(process.env.PAYMENT_WEBHOOK_TIMEOUT) || 30,
    AMOUNT_TOLERANCE: Number(process.env.PAYMENT_AMOUNT_TOLERANCE) || 0.01,
  },
} as const

// Webhook配置
export const WEBHOOK_CONFIG = {
  PROCESSING_TIMEOUT: Number(process.env.WEBHOOK_PROCESSING_TIMEOUT) || 30000,
  MAX_RETRIES: Number(process.env.WEBHOOK_MAX_RETRIES) || 3,
  IDEMPOTENCY_WINDOW: Number(process.env.WEBHOOK_IDEMPOTENCY_WINDOW) || 86400,
  RATE_LIMIT: Number(process.env.WEBHOOK_RATE_LIMIT) || 10,
} as const

// 导出通用配置对象
export const CONFIG = {
  API: API_CONFIG,
  PAYMENT: PAYMENT_CONFIG,
  WEBHOOK: WEBHOOK_CONFIG,
} as const

// ⭐ 启动时打印一份“安全配置概览”（不包含任何密钥）
if (process.env.NODE_ENV !== 'test') {
  console.log('🧩 Runtime config loaded:')
  console.log('   🌱 NODE_ENV:', process.env.NODE_ENV || 'undefined')
  console.log('   🛰️ API_BASE_URL:', API_CONFIG.BASE_URL)
  console.log('   🌐 FRONTEND_URL:', API_CONFIG.FRONTEND_URL)
  console.log('   ❤️ HEALTH_CHECK_URL:', API_CONFIG.HEALTH_CHECK_URL)
  console.log('   💰 Alipay enabled:', PAYMENT_CONFIG.ALIPAY.ENABLED)
  console.log('   💰 Alipay gateway:', PAYMENT_CONFIG.ALIPAY.GATEWAY_URL)
  console.log('   💳 Creem enabled:', PAYMENT_CONFIG.CREEM.ENABLED)
  console.log('   💳 Creem base URL:', PAYMENT_CONFIG.CREEM.BASE_URL)
}
