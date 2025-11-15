/**
 * API 配置
 * 统一管理所有 API 相关的配置
 */

// 基础配置
export const API_CONFIG = {
  PORT: Number(process.env.PORT) || 3100,
  BASE_URL: process.env.BASE_URL || 'http://localhost:3100',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  HEALTH_CHECK_URL: `http://localhost:${Number(process.env.PORT) || 3100}/api/health`,
} as const

// 支付网关配置
export const PAYMENT_CONFIG = {
  ALIPAY: {
    ENABLED: process.env.PAYMENT_ALIPAY_ENABLED === 'true',
    APP_ID: process.env.PAYMENT_ALIPAY_APP_ID || '',
    GATEWAY_URL: process.env.PAYMENT_ALIPAY_GATEWAY_URL || 'https://openapi.alipay.com/gateway.do',
    VERSION: process.env.PAYMENT_ALIPAY_VERSION || '1.0',
    TIMEOUT: Number(process.env.PAYMENT_ALIPAY_TIMEOUT) || 30000,
    RETRY_COUNT: Number(process.env.PAYMENT_ALIPAY_RETRY_COUNT) || 3,
    WEBHOOK_URL: `${API_CONFIG.BASE_URL}/webhooks/alipay`,
    RETURN_URL: `${API_CONFIG.FRONTEND_URL}/payment/return`,
  },
  CREEM: {
    ENABLED: process.env.PAYMENT_CREEM_ENABLED === 'true',
    API_KEY: process.env.PAYMENT_CREEM_API_KEY || '',
    WEBHOOK_SECRET: process.env.PAYMENT_CREEM_WEBHOOK_SECRET || '',
    BASE_URL: process.env.PAYMENT_CREEM_BASE_URL || 'https://api.creem.io',
    TIMEOUT: Number(process.env.PAYMENT_CREEM_TIMEOUT) || 30000,
    RETRY_COUNT: Number(process.env.PAYMENT_CREEM_RETRY_COUNT) || 3,
    WEBHOOK_URL: `${API_CONFIG.BASE_URL}/webhooks/creem`,
  },
  COMMON: {
    WEBHOOK_TIMEOUT: Number(process.env.PAYMENT_WEBHOOK_TIMEOUT) || 30,
    AMOUNT_TOLERANCE: Number(process.env.PAYMENT_AMOUNT_TOLERANCE) || 0.01,
  }
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
