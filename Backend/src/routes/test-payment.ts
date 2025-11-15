import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { products, productPrices, orders } from '../db/schema'
import { eq } from 'drizzle-orm'
import { transactionService } from '../services/transaction-service'
import { successResponse, errors } from '../utils/response'
import { OrderStatus, Gateway, Currency } from '../db/schema'

const app = new Hono()

// 订单创建请求的验证 schema
const testPaymentSchema = z.object({
  productId: z.number().positive('商品ID必须大于0'),
  email: z.string().email('请输入有效的邮箱地址'),
})

/**
 * 测试支付成功接口 - 跳过支付宝支付页面，直接触发支付成功和自动发货
 *
 * 使用方法：
 * POST /api/test/payment-success
 * {
 *   "productId": 1,
 *   "email": "test@example.com"
 * }
 */
app.post('/payment-success', zValidator('json', testPaymentSchema), async (c) => {
  const { productId, email } = c.req.valid('json')

  try {
    // 1. 验证商品存在
    const product = await db.select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1)

    if (product.length === 0) {
      return errors.PRODUCT_NOT_FOUND(c)
    }

    if (!product[0].isActive) {
      return errors.PRODUCT_INACTIVE(c)
    }

    console.log(`🧪 [Test Payment] 开始测试支付流程 - 商品: ${product[0].name}, 邮箱: ${email}`)

    // 2. 生成测试订单ID
    const orderId = `TEST_ORDER_${Date.now()}_${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`

    // 3. 查找商品价格
    const productPrice = await db.select()
      .from(productPrices)
      .where(eq(productPrices.productId, productId))
      .limit(1)

    if (productPrice.length === 0) {
      return errors.INTERNAL_ERROR(c, '商品价格未设置')
    }

    const price = productPrice[0]

    // 4. 创建订单（pending 状态）
    console.log(`🧪 [Test Payment] 创建订单，商品: ${product[0].name}, 价格: ${price.price} ${price.currency}`)
    const newOrder = await db.insert(orders)
      .values({
        id: orderId,
        productId: productId,
        email: email,
        gateway: Gateway.ALIPAY,
        amount: price.price,
        currency: price.currency,
        status: OrderStatus.PENDING,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning()

    if (newOrder.length === 0) {
      return errors.INTERNAL_ERROR(c, '订单创建失败')
    }

    console.log(`🧪 [Test Payment] 订单创建成功: ${orderId}`)

    // 5. 模拟支付网关数据
    const mockGatewayData = {
      gateway: 'alipay',
      gatewayOrderId: `ALIPAY_${orderId}`,
      trade_no: `TEST_TRADE_${Date.now()}`,
      gmt_payment: new Date().toISOString(),
      total_amount: price.price.toString(),
      buyer_email: email,
    }

    // 6. 调用支付成功处理（这会触发自动发货）
    console.log(`🧪 [Test Payment] 处理支付成功，订单ID: ${orderId}`)
    const result = await transactionService.processPaymentSuccess(orderId, mockGatewayData)

    console.log(`🧪 [Test Payment] 支付处理完成:`, {
      orderCreated: !!result.order,
      deliveryCreated: !!result.delivery,
      inventoryAllocated: !!result.allocatedInventory,
      deliveryContent: result.delivery?.content?.substring(0, 50) + '...',
    })

    // 5. 返回成功响应（前端可以用这个数据跳转到发货成功页面）
    return successResponse(c, {
      message: '测试支付成功，已自动发货',
      orderId: orderId,
      order: result.order,
      delivery: result.delivery,
      allocatedInventory: result.allocatedInventory,
      nextSteps: {
        // 提示前端可以跳转到发货成功页面
        redirectTo: `/payment/success?orderId=${orderId}`,
        // 或者显示发货内容
        showDelivery: true,
      }
    })

  } catch (error) {
    console.error('🧪 [Test Payment] 错误:', error)

    // 根据错误类型返回不同的错误信息
    if (error.message?.includes('Insufficient inventory')) {
      return errors.INTERNAL_ERROR(c, '库存不足，无法完成发货')
    }

    if (error.message?.includes('Order not found')) {
      return errors.INTERNAL_ERROR(c, '订单创建失败')
    }

    if (error.message?.includes('Order is not pending')) {
      return errors.INTERNAL_ERROR(c, '订单状态异常')
    }

    return errors.INTERNAL_ERROR(c, `测试支付失败: ${error.message}`)
  }
})

/**
 * 获取测试订单状态
 */
app.get('/order-status/:orderId', async (c) => {
  const { orderId } = c.req.param()

  try {
    // 这里可以查询订单状态，但为了简化，我们只返回订单ID
    return successResponse(c, {
      orderId: orderId,
      status: 'paid', // 测试接口总是返回已支付状态
      message: '测试订单已支付并自动发货'
    })
  } catch (error) {
    console.error('🧪 [Test Order Status] 错误:', error)
    return errors.INTERNAL_ERROR(c, '获取订单状态失败')
  }
})

/**
 * 重置测试数据（仅开发环境使用）
 */
app.post('/reset-data', async (c) => {
  // 这里可以添加清理测试数据的逻辑
  // 为了安全，现在只返回成功消息
  return successResponse(c, {
    message: '测试数据重置功能待实现',
    note: '请手动清理测试订单和库存数据'
  })
})

export default app