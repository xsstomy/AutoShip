import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { products, productPrices, orders } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { paymentService } from '../services/payment-service'
import { Gateway } from '../types/orders'

const app = new Hono()

// 订单创建请求的验证 schema
const createOrderSchema = z.object({
  productId: z.string().min(1, '商品ID不能为空'),
  productName: z.string().min(1, '商品名称不能为空'),
  price: z.number().positive('价格必须大于0'),
  currency: z.enum(['CNY', 'USD']).refine((val) => ['CNY', 'USD'].includes(val), {
    message: '不支持的货币类型'
  }),
  email: z.string().email('请输入有效的邮箱地址'),
  gateway: z.enum(['alipay', 'creem', 'paypal']).refine((val) => ['alipay', 'creem', 'paypal'].includes(val), {
    message: '不支持的支付网关'
  }),
})

/**
 * 创建订单API端点
 * POST /api/v1/checkout/create
 */
app.post('/create', zValidator('json', createOrderSchema), async (c) => {
  try {
    const data = c.req.valid('json')

    // 1. 验证商品是否存在且有效
    const product = await db
      .select()
      .from(products)
      .where(eq(products.id, parseInt(data.productId)))
      .limit(1)

    if (!product || product.length === 0) {
      return c.json({
        success: false,
        error: '商品不存在'
      }, 404)
    }

    const productData = product[0]
    if (!productData.isActive) {
      return c.json({
        success: false,
        error: '商品已下架'
      }, 400)
    }

    // 2. 验证商品价格是否匹配（可选的安全检查）
    const productPrice = await db
      .select()
      .from(productPrices)
      .where(and(
        eq(productPrices.productId, parseInt(data.productId)),
        eq(productPrices.currency, data.currency)
      ))
      .limit(1)

    // 如果找到了对应的价格记录，进行价格验证
    if (productPrice.length > 0) {
      const expectedPrice = productPrice[0].price
      // 允许小的价格差异（考虑汇率波动或前端计算误差）
      const priceDiff = Math.abs(expectedPrice - data.price)
      const maxDiff = expectedPrice * 0.05 // 允许5%的差异

      if (priceDiff > maxDiff) {
        return c.json({
          success: false,
          error: '商品价格不匹配，请刷新页面重试'
        }, 400)
      }
    }

    // 3. 生成订单ID（UUID v4）
    const orderId = crypto.randomUUID()

    // 4. 创建订单记录
    const newOrder = {
      id: orderId,
      productId: parseInt(data.productId),
      email: data.email.toLowerCase(),
      gateway: data.gateway,
      amount: data.price,
      currency: data.currency,
      status: 'pending' as const,
    }

    await db.insert(orders).values(newOrder)

    // 5. 返回订单信息
    const orderResponse = {
      id: orderId,
      productId: data.productId,
      email: data.email,
      gateway: data.gateway,
      amount: data.price,
      currency: data.currency,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // 6. 生成支付链接
    try {
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
      const paymentLink = await paymentService.createPayment(orderId, {
        returnUrl: `${baseUrl}/payment/return?orderId=${orderId}`,
        notifyUrl: `${process.env.BASE_URL}/webhooks/${data.gateway}`
      })

      return c.json({
        success: true,
        data: {
          order: orderResponse,
          paymentUrl: paymentLink.paymentUrl,
          expiresAt: paymentLink.expiresAt,
        }
      })
    } catch (error) {
      console.error('Failed to create payment:', error)
      return c.json({
        success: false,
        error: {
          code: 'PAYMENT_CREATION_FAILED',
          message: error instanceof Error ? error.message : '创建支付失败，请稍后重试',
        }
      }, 500)
    }

  } catch (error) {
    console.error('创建订单失败:', error)

    // 处理数据库唯一约束错误
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return c.json({
        success: false,
        error: '订单创建失败，请稍后重试'
      }, 500)
    }

    return c.json({
      success: false,
      error: '服务器内部错误，请稍后重试'
    }, 500)
  }
})

/**
 * 验证商品是否可购买
 * GET /api/v1/products/:id/validate
 */
app.get('/products/:id/validate', async (c) => {
  try {
    const productId = c.req.param('id')

    // 验证商品ID格式
    const parsedId = parseInt(productId)
    if (isNaN(parsedId)) {
      return c.json({
        success: false,
        error: '商品ID格式不正确'
      }, 400)
    }

    // 查询商品信息
    const product = await db
      .select({
        id: products.id,
        name: products.name,
        isActive: products.isActive,
        price: productPrices.price,
        currency: productPrices.currency,
      })
      .from(products)
      .leftJoin(productPrices, eq(products.id, productPrices.productId))
      .where(and(
        eq(products.id, parsedId),
        eq(products.isActive, true)
      ))
      .limit(1)

    if (!product || product.length === 0) {
      return c.json({
        success: true,
        data: {
          valid: false,
          error: '商品不存在或已下架'
        }
      })
    }

    return c.json({
      success: true,
      data: {
        valid: true,
        product: product[0]
      }
    })

  } catch (error) {
    console.error('验证商品失败:', error)
    return c.json({
      success: false,
      error: '服务器内部错误'
    }, 500)
  }
})

/**
 * 查询支付状态
 * GET /api/v1/payments/:orderId/status
 */
app.get('/payments/:orderId/status', async (c) => {
  try {
    const orderId = c.req.param('orderId')

    const status = await paymentService.getPaymentStatus(orderId)

    return c.json({
      success: true,
      data: status
    })

  } catch (error) {
    console.error('获取支付状态失败:', error)
    return c.json({
      success: false,
      error: {
        code: 'STATUS_QUERY_FAILED',
        message: error instanceof Error ? error.message : '查询支付状态失败'
      }
    }, 500)
  }
})

/**
 * 重新创建支付链接
 * POST /api/v1/payments/:orderId/retry
 */
app.post('/payments/:orderId/retry', async (c) => {
  try {
    const orderId = c.req.param('orderId')

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'

    const paymentLink = await paymentService.createPayment(orderId, {
      returnUrl: `${baseUrl}/payment/return?orderId=${orderId}`,
      notifyUrl: `${process.env.BASE_URL}/webhooks`
    })

    return c.json({
      success: true,
      data: {
        orderId,
        paymentUrl: paymentLink.paymentUrl,
        expiresAt: paymentLink.expiresAt
      }
    })

  } catch (error) {
    console.error('重新创建支付失败:', error)
    return c.json({
      success: false,
      error: {
        code: 'PAYMENT_RETRY_FAILED',
        message: error instanceof Error ? error.message : '重新创建支付失败'
      }
    }, 500)
  }
})

/**
 * 获取可用的支付网关列表
 * GET /api/v1/payments/gateways
 */
app.get('/payments/gateways', async (c) => {
  try {
    const gateways = await paymentService.getAvailableGateways()

    return c.json({
      success: true,
      data: {
        gateways: gateways.map(gateway => ({
          id: gateway,
          name: gateway === 'alipay' ? '支付宝' : 'Creem'
        }))
      }
    })

  } catch (error) {
    console.error('获取支付网关列表失败:', error)
    return c.json({
      success: false,
      error: {
        code: 'GATEWAYS_QUERY_FAILED',
        message: '获取支付网关列表失败'
      }
    }, 500)
  }
})

export default app