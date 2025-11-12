import { Hono } from 'hono'
import { webhookProcessingService } from '../services/webhook-processing-service'
import { Gateway } from '../types/orders'
import {
  webhookSignatureValidator,
  webhookCorsSecurity,
  webhookRequestLogging,
  rateLimit,
  suspiciousPatternDetection,
  webhookResponseFormatter
} from '../middleware'

const app = new Hono()

// 全局Webhook安全中间件
app.use('*', webhookCorsSecurity())
app.use('*', webhookRequestLogging())
app.use('*', suspiciousPatternDetection({
  maxRequestsPerMinute: 10,
  maxFailedRequests: 5,
  blockDuration: 5 * 60 * 1000 // 5分钟
}))
app.use('*', rateLimit({
  windowMs: 60 * 1000, // 1分钟
  maxRequests: 10 // 每分钟最多10个请求
}))
app.use('*', webhookSignatureValidator())

/**
 * 支付宝支付回调
 * POST /webhooks/alipay
 *
 * 支付宝异步通知格式：
 * - POST请求
 * - 参数在请求体中（application/x-www-form-urlencoded）
 * - 包含签名字段
 */
app.post('/alipay', async (c) => {
  try {
    // 解析请求体
    const contentType = c.req.header('content-type') || ''

    if (contentType.includes('application/json')) {
      // JSON格式
      const payload = await c.req.json()
      console.log('Received Alipay webhook (JSON):', JSON.stringify(payload, null, 2))

      // 使用新的Webhook处理服务
      const clientIP = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
      const result = await webhookProcessingService.processAlipayWebhook(
        payload,
        Object.fromEntries(c.req.headers()),
        clientIP
      )

      // 返回响应
      if (result.success) {
        // 支付宝要求返回'success'字符串表示成功接收
        return c.text('success', 200)
      } else {
        console.error('Alipay webhook processing failed:', result.message)
        return c.text('failure', 400)
      }
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      // 表单格式（支付宝默认）
      const formData = await c.req.formData()
      const payload: Record<string, string> = {}

      // 转换FormData为普通对象
      for (const [key, value] of formData.entries()) {
        payload[key] = value.toString()
      }

      console.log('Received Alipay webhook (form):', JSON.stringify(payload, null, 2))

      // 使用新的Webhook处理服务
      const clientIP = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
      const result = await webhookProcessingService.processAlipayWebhook(
        payload,
        Object.fromEntries(c.req.headers()),
        clientIP
      )

      // 返回响应
      if (result.success) {
        return c.text('success', 200)
      } else {
        console.error('Alipay webhook processing failed:', result.message)
        return c.text('failure', 400)
      }
    } else {
      console.error('Unsupported content type:', contentType)
      return c.text('failure', 400)
    }

  } catch (error) {
    console.error('Alipay webhook error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // 支付宝回调失败时返回failure
    return c.text('failure', 500)
  }
})

/**
 * Creem支付回调
 * POST /webhooks/creem
 *
 * Creem异步通知格式：
 * - POST请求
 * - 参数在请求体中（application/json）
 * - 包含签名字段
 */
app.post('/creem', async (c) => {
  try {
    // Creem通常使用JSON格式
    const payload = await c.req.json()

    console.log('Received Creem webhook:', JSON.stringify(payload, null, 2))

    // 使用新的Webhook处理服务
    const clientIP = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    const result = await webhookProcessingService.processCreemWebhook(
      payload,
      Object.fromEntries(c.req.headers()),
      clientIP
    )

    // 返回响应
    if (result.success) {
      // Creem通常返回JSON格式的响应
      return c.json({
        status: 'success',
        message: 'Webhook processed successfully',
        orderId: result.orderId
      }, 200)
    } else {
      console.error('Creem webhook processing failed:', result.message)
      return c.json({
        status: 'failure',
        message: result.message
      }, 400)
    }

  } catch (error) {
    console.error('Creem webhook error:', error)

    // Creem回调失败时返回错误JSON
    return c.json({
      status: 'failure',
      message: 'Internal server error'
    }, 500)
  }
})

/**
 * Webhook健康检查
 * GET /webhooks/health
 *
 * 用于监控Webhook端点是否正常工作
 */
app.get('/health', async (c) => {
  try {
    // 检查Webhook处理服务是否正常
    const gateways = ['alipay', 'creem']

    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      gateways,
      service: 'webhooks'
    }, 200)
  } catch (error) {
    console.error('Webhook health check failed:', error)

    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      service: 'webhooks'
    }, 503)
  }
})

/**
 * Webhook测试端点（仅开发环境使用）
 * POST /webhooks/test/:gateway
 *
 * 用于模拟支付回调，便于测试
 */
app.post('/test/:gateway', async (c) => {
  // 仅在开发环境启用
  const env = process.env.NODE_ENV || 'development'
  if (env !== 'development') {
    return c.json({
      success: false,
      error: 'Test endpoint only available in development mode'
    }, 403)
  }

  try {
    const gateway = c.req.param('gateway') as Gateway

    // 验证网关类型
    if (!['alipay', 'creem'].includes(gateway)) {
      return c.json({
        success: false,
        error: 'Invalid gateway type'
      }, 400)
    }

    // 生成测试数据
    const testOrderId = c.req.query('orderId') || `TEST_${Date.now()}`
    const testAmount = parseFloat(c.req.query('amount') || '99.00')
    const testCurrency = (c.req.query('currency') || 'CNY') as any

    let testPayload: any

    if (gateway === 'alipay') {
      // 支付宝测试数据
      testPayload = {
        out_trade_no: testOrderId,
        trade_no: `ALIPAY_TEST_${Date.now()}`,
        trade_status: 'TRADE_SUCCESS',
        total_amount: testAmount.toFixed(2),
        currency: testCurrency,
        notify_time: new Date().toISOString(),
        notify_id: `TEST_NOTIFY_${Date.now()}`,
        // 注意：实际测试时需要有效的签名
        sign: 'test_signature',
        sign_type: 'RSA2'
      }
    } else {
      // Creem测试数据
      testPayload = {
        order_id: testOrderId,
        transaction_id: `CREEM_TEST_${Date.now()}`,
        status: 'payment_succeeded',
        amount: testAmount,
        currency: testCurrency,
        created_at: new Date().toISOString()
      }
    }

    console.log('Processing test webhook:', { gateway, testPayload })

    // 处理测试回调
    const clientIP = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'test'
    const result = gateway === 'alipay'
      ? await webhookProcessingService.processAlipayWebhook(testPayload, {
          'x-test': 'true',
          'content-type': 'application/json'
        }, clientIP)
      : await webhookProcessingService.processCreemWebhook(testPayload, {
          'x-test': 'true',
          'content-type': 'application/json'
        }, clientIP)

    return c.json({
      success: result.success,
      message: result.message,
      orderId: result.orderId,
      test: true,
      payload: testPayload
    }, result.success ? 200 : 400)

  } catch (error) {
    console.error('Test webhook failed:', error)

    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      test: true
    }, 500)
  }
})

/**
 * 记录Webhook访问日志
 * 中间件函数
 */
app.use('*', async (c, next) => {
  const start = Date.now()

  // 记录请求开始
  console.log(`[Webhook] ${c.req.method} ${c.req.url} - ${c.req.header('user-agent') || 'Unknown'}`)

  await next()

  // 记录响应时间
  const duration = Date.now() - start
  console.log(`[Webhook] ${c.req.method} ${c.req.url} - ${c.res.status} - ${duration}ms`)
})

export default app
