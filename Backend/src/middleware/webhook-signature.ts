import { Context, Next } from 'hono'
import crypto from 'crypto'
import { db, schema } from '../db'
import { eq, and, lt } from 'drizzle-orm'
import { auditService } from '../services/audit-service'
import { securityService } from '../services/security-service'

/**
 * Webhook签名验证中间件
 * 支持支付宝RSA2和Creem HMAC签名验证
 */
export function webhookSignatureValidator() {
  return async (c: Context, next: Next) => {
    try {
      const gateway = c.req.path().includes('alipay') ? 'alipay' : 'creem'
      const payload = await c.req.text()
      const headers = Object.fromEntries(c.req.header())

      // 记录原始webhook数据
      await logWebhookPayload(gateway, payload, headers)

      // 根据不同的支付网关选择验证方式
      let isValidSignature = false
      let signatureMethod = 'unknown'

      if (gateway === 'alipay') {
        const result = await verifyAlipaySignature(payload, headers)
        isValidSignature = result.isValid
        signatureMethod = result.method
      } else if (gateway === 'creem') {
        const result = await verifyCreemSignature(payload, headers)
        isValidSignature = result.isValid
        signatureMethod = result.method
      }

      // 检查是否已经处理过（幂等性）
      const gatewayOrderId = extractGatewayOrderId(payload, gateway)
      if (gatewayOrderId) {
        const isProcessed = await checkWebhookProcessed(gateway, gatewayOrderId)
        if (isProcessed) {
          await auditService.logAuditEvent({
            action: 'webhook_duplicate',
            resourceType: 'payment_webhook',
            resourceId: gatewayOrderId,
            success: false,
            ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
            userAgent: c.req.header('user-agent'),
            errorMessage: 'Duplicate webhook received',
            metadata: { gateway, payload: payload.substring(0, 500) }
          })

          c.status(200)
          return c.json({ success: true, message: 'Already processed' })
        }
      }

      // 验证签名
      if (!isValidSignature) {
        await auditService.logAuditEvent({
          action: 'webhook_signature_invalid',
          resourceType: 'payment_webhook',
          resourceId: gatewayOrderId || 'unknown',
          success: false,
          ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
          userAgent: c.req.header('user-agent'),
          errorMessage: 'Invalid webhook signature',
          metadata: { gateway, signatureMethod, payload: payload.substring(0, 500) }
        })

        c.status(401)
        return c.json({
          success: false,
          error: 'Invalid signature',
          code: 'WEBHOOK_SIGNATURE_INVALID'
        })
      }

      // 验证时间戳（防止重放攻击）
      const timestamp = extractTimestamp(payload, gateway)
      if (timestamp) {
        const now = Date.now()
        const timeDiff = Math.abs(now - timestamp * 1000)
        const maxTimeDiff = 5 * 60 * 1000 // 5分钟

        if (timeDiff > maxTimeDiff) {
          await auditService.logAuditEvent({
            action: 'webhook_timestamp_invalid',
            resourceType: 'payment_webhook',
            resourceId: gatewayOrderId || 'unknown',
            success: false,
            ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
            userAgent: c.req.header('user-agent'),
            errorMessage: 'Webhook timestamp outside valid window',
            metadata: { gateway, timestamp, timeDiff }
          })

          c.status(401)
          return c.json({
            success: false,
            error: 'Timestamp expired',
            code: 'WEBHOOK_TIMESTAMP_EXPIRED'
          })
        }
      }

      // 更新payments_raw表中的签名验证状态
      await updateWebhookSignatureStatus(gateway, gatewayOrderId, true, signatureMethod)

      // 记录成功验证
      await auditService.logAuditEvent({
        action: 'webhook_signature_valid',
        resourceType: 'payment_webhook',
        resourceId: gatewayOrderId || 'unknown',
        success: true,
        ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
        userAgent: c.req.header('user-agent'),
        metadata: { gateway, signatureMethod }
      })

      // 将验证结果和解析后的数据添加到上下文
      c.set('webhookValidated', true)
      c.set('webhookGateway', gateway)
      c.set('webhookPayload', payload)

      await next()
    } catch (error) {
      console.error('Webhook signature validation error:', error)

      await auditService.logAuditEvent({
        action: 'webhook_validation_error',
        resourceType: 'payment_webhook',
        success: false,
        ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
        userAgent: c.req.header('user-agent'),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: { error: error.stack }
      })

      c.status(500)
      return c.json({
        success: false,
        error: 'Internal server error',
        code: 'WEBHOOK_VALIDATION_ERROR'
      })
    }
  }
}

/**
 * 验证支付宝RSA2签名
 */
async function verifyAlipaySignature(payload: string, headers: Record<string, string>): Promise<{ isValid: boolean; method: string }> {
  try {
    const alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY
    if (!alipayPublicKey) {
      console.error('Alipay public key not configured')
      return { isValid: false, method: 'rsa2_missing_key' }
    }

    // 从header中获取签名
    const signature = headers['alipay-signature'] || headers['signature']
    if (!signature) {
      return { isValid: false, method: 'rsa2_missing_signature' }
    }

    // 从payload中提取待签名字符串
    const params = new URLSearchParams(payload)
    const signData = Object.keys(params)
      .sort()
      .filter(key => key !== 'sign' && key !== 'sign_type')
      .map(key => `${key}=${params.get(key)}`)
      .join('&')

    // 验证RSA2签名
    const verifier = crypto.createVerify('RSA-SHA256')
    verifier.update(signData, 'utf8')
    const isValid = verifier.verify(alipayPublicKey, signature, 'base64')

    return { isValid, method: 'rsa2_sha256' }
  } catch (error) {
    console.error('Alipay signature verification error:', error)
    return { isValid: false, method: 'rsa2_error' }
  }
}

/**
 * 验证Creem HMAC签名
 */
async function verifyCreemSignature(payload: string, headers: Record<string, string>): Promise<{ isValid: boolean; method: string }> {
  try {
    const creemSecret = process.env.CREEM_WEBHOOK_SECRET
    if (!creemSecret) {
      console.error('Creem webhook secret not configured')
      return { isValid: false, method: 'hmac_missing_secret' }
    }

    const signature = headers['x-creem-signature'] || headers['creem-signature'] || headers['signature']
    if (!signature) {
      return { isValid: false, method: 'hmac_missing_signature' }
    }

    // 验证HMAC签名
    const expectedSignature = crypto
      .createHmac('sha256', creemSecret)
      .update(payload, 'utf8')
      .digest('hex')

    const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))

    return { isValid, method: 'hmac_sha256' }
  } catch (error) {
    console.error('Creem signature verification error:', error)
    return { isValid: false, method: 'hmac_error' }
  }
}

/**
 * 记录原始webhook数据
 */
async function logWebhookPayload(gateway: string, payload: string, headers: Record<string, string>) {
  try {
    await db.insert(schema.paymentsRaw).values({
      gateway,
      payload,
      signatureValid: false, // 将在验证后更新
      processingAttempts: 0,
      createdAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Failed to log webhook payload:', error)
    // 不应该阻断主流程
  }
}

/**
 * 检查webhook是否已处理（幂等性检查）
 */
async function checkWebhookProcessed(gateway: string, gatewayOrderId: string): Promise<boolean> {
  try {
    const existingRecord = await db.select()
      .from(schema.paymentsRaw)
      .where(and(
        eq(schema.paymentsRaw.gateway, gateway),
        eq(schema.paymentsRaw.gatewayOrderId, gatewayOrderId),
        eq(schema.paymentsRaw.processed, true)
      ))
      .limit(1)

    return existingRecord.length > 0
  } catch (error) {
    console.error('Failed to check webhook processed status:', error)
    return false
  }
}

/**
 * 从payload中提取订单ID
 */
function extractGatewayOrderId(payload: string, gateway: string): string | null {
  try {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload

    if (gateway === 'alipay') {
      return data.trade_no || data.out_trade_no
    } else if (gateway === 'creem') {
      return data.payment_id || data.order_id || data.id
    }

    return null
  } catch (error) {
    return null
  }
}

/**
 * 从payload中提取时间戳
 */
function extractTimestamp(payload: string, gateway: string): number | null {
  try {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload

    if (gateway === 'alipay') {
      return data.timestamp ? parseInt(data.timestamp) : null
    } else if (gateway === 'creem') {
      return data.timestamp || data.created_at ? new Date(data.timestamp || data.created_at).getTime() / 1000 : null
    }

    return null
  } catch (error) {
    return null
  }
}

/**
 * 更新webhook签名验证状态
 */
async function updateWebhookSignatureStatus(gateway: string, gatewayOrderId: string, isValid: boolean, method: string) {
  try {
    await db.update(schema.paymentsRaw)
      .set({
        signatureValid: isValid,
        signatureMethod: method,
        processed: false, // 等待业务处理完成后才标记为已处理
        updatedAt: new Date().toISOString()
      })
      .where(and(
        eq(schema.paymentsRaw.gateway, gateway),
        eq(schema.paymentsRaw.gatewayOrderId, gatewayOrderId),
        eq(schema.paymentsRaw.processed, false)
      ))
  } catch (error) {
    console.error('Failed to update webhook signature status:', error)
    // 不应该阻断主流程
  }
}

/**
 * 清理过期的webhook记录
 */
export async function cleanupExpiredWebhooks() {
  try {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24小时前

    const result = await db.delete(schema.paymentsRaw)
      .where(and(
        eq(schema.paymentsRaw.processed, true),
        lt(schema.paymentsRaw.createdAt, cutoffTime.toISOString())
      ))

    console.log(`Cleaned up ${result.changes} expired webhook records`)
    return result.changes
  } catch (error) {
    console.error('Failed to cleanup expired webhooks:', error)
    return 0
  }
}

export default webhookSignatureValidator