import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { orderService } from '../services/order-service'
import {
  createOrderSchema,
  orderQuerySchema,
  updateOrderStatusSchema,
  CreateOrderRequestType,
  OrderQueryParamsType,
  UpdateOrderStatusRequestType,
  ApiResponse,
  PaginatedResponse,
  ORDER_ERROR_CODES,
  ORDER_STATUS_TRANSITIONS
} from '../types/orders'
import { withTransaction } from '../db'

const app = new Hono()

// 订单ID生成函数 (ORDER + YYYYMMDDHHmmss + 4位随机数)
function generateOrderId(): string {
  const now = new Date()
  const timestamp = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') +
    now.getSeconds().toString().padStart(2, '0')

  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `ORDER${timestamp}${random}`
}


/**
 * 创建订单API端点
 * POST /api/v1/orders/create
 */
app.post('/create', zValidator('json', createOrderSchema), async (c) => {
  try {
    const data = c.req.valid('json')

    // 生成业务订单ID
    const orderId = generateOrderId()

    // 准备订单数据
    const orderData = {
      ...data,
      id: orderId,
      amount: data.price,
      status: 'pending' as const,
      email: data.email.toLowerCase(),
    }

    // 使用事务创建订单
    const order = await withTransaction(async () => {
      return await orderService.createOrder(orderData)
    })

    // 返回标准响应格式
    return c.json({
      success: true,
      data: {
        id: order.id,
        email: order.email,
        productName: data.productName,
        price: order.amount.toString(),
        currency: order.currency,
        status: order.status,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      }
    })

  } catch (error: any) {
    console.error('创建订单失败:', error)

    // 处理验证错误
    if (error.errors) {
      return c.json({
        success: false,
        error: {
          code: ORDER_ERROR_CODES.VALIDATION_ERROR,
          message: '请求参数验证失败',
          details: error.errors
        }
      }, 400)
    }

    // 处理数据库约束错误
    if (error.message?.includes('UNIQUE constraint failed')) {
      return c.json({
        success: false,
        error: {
          code: ORDER_ERROR_CODES.DUPLICATE_ORDER,
          message: '订单创建失败，请稍后重试'
        }
      }, 409)
    }

    // 处理商品不存在错误
    if (error.message?.includes('Product not found')) {
      return c.json({
        success: false,
        error: {
          code: ORDER_ERROR_CODES.PRODUCT_NOT_FOUND,
          message: '商品不存在或已下架'
        }
      }, 404)
    }

    // 处理其他错误
    return c.json({
      success: false,
      error: {
        code: ORDER_ERROR_CODES.INTERNAL_ERROR,
        message: '服务器内部错误，请稍后重试'
      }
    }, 500)
  }
})

/**
 * 根据ID获取单个订单
 * GET /api/v1/orders/:id
 */
app.get('/:id', async (c) => {
  try {
    const orderId = c.req.param('id')

    if (!orderId) {
      return c.json({
        success: false,
        error: {
          code: 'INVALID_ORDER_ID',
          message: '订单ID不能为空'
        }
      }, 400)
    }

    const order = await orderService.getOrderById(orderId)

    if (!order) {
      return c.json({
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: '订单不存在'
        }
      }, 404)
    }

    return c.json({
      success: true,
      data: order
    })

  } catch (error) {
    console.error('获取订单失败:', error)
    return c.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      }
    }, 500)
  }
})

/**
 * 获取订单列表（支持筛选和分页）
 * GET /api/v1/orders
 */
app.get('/', zValidator('query', orderQuerySchema), async (c) => {
  try {
    const query = c.req.valid('query')

    const result = await orderService.queryOrders({
      ...query,
      offset: (query.page - 1) * query.limit,
    })

    return c.json({
      success: true,
      data: result.orders,
      pagination: result.pagination
    })

  } catch (error: any) {
    console.error('查询订单失败:', error)

    if (error.errors) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '查询参数验证失败',
          details: error.errors
        }
      }, 400)
    }

    return c.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      }
    }, 500)
  }
})

/**
 * 根据邮箱查询订单
 * GET /api/v1/orders/by-email/:email
 */
app.get('/by-email/:email', async (c) => {
  try {
    const email = c.req.param('email')
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')

    if (!email || !email.includes('@')) {
      return c.json({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: '请提供有效的邮箱地址'
        }
      }, 400)
    }

    const result = await orderService.getOrdersByEmail(email.toLowerCase(), { page, limit })

    return c.json({
      success: true,
      data: result.orders,
      pagination: result.pagination
    })

  } catch (error) {
    console.error('根据邮箱查询订单失败:', error)
    return c.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      }
    }, 500)
  }
})

/**
 * 更新订单状态
 * PUT /api/v1/orders/:id/status
 */
app.put('/:id/status', zValidator('json', updateOrderStatusSchema), async (c) => {
  try {
    const orderId = c.req.param('id')
    const updateData = c.req.valid('json')

    if (!orderId) {
      return c.json({
        success: false,
        error: {
          code: 'INVALID_ORDER_ID',
          message: '订单ID不能为空'
        }
      }, 400)
    }

    // 检查订单是否存在
    const existingOrder = await orderService.getOrderById(orderId)
    if (!existingOrder) {
      return c.json({
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: '订单不存在'
        }
      }, 404)
    }

    // 验证状态转换是否合法
    const allowedStatuses = ORDER_STATUS_TRANSITIONS[existingOrder.status] || []
    if (!allowedStatuses.includes(updateData.status)) {
      return c.json({
        success: false,
        error: {
          code: 'INVALID_STATUS_TRANSITION',
          message: `订单状态无法从 ${existingOrder.status} 变更为 ${updateData.status}`
        }
      }, 400)
    }

    // 更新订单状态
    const updatedOrder = await orderService.updateOrderStatus(orderId, updateData.status, {
      notes: updateData.notes,
      gatewayOrderId: updateData.gatewayOrderId,
      gatewayData: updateData.gatewayData,
    })

    if (!updatedOrder) {
      return c.json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: '订单状态更新失败'
        }
      }, 500)
    }

    return c.json({
      success: true,
      data: updatedOrder
    })

  } catch (error: any) {
    console.error('更新订单状态失败:', error)

    if (error.errors) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '请求参数验证失败',
          details: error.errors
        }
      }, 400)
    }

    return c.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      }
    }, 500)
  }
})

/**
 * 获取订单统计信息
 * GET /api/v1/orders/stats
 */
app.get('/stats', async (c) => {
  try {
    const startDate = c.req.query('startDate')
    const endDate = c.req.query('endDate')

    const stats = await orderService.getOrderStats(startDate, endDate)

    return c.json({
      success: true,
      data: stats
    })

  } catch (error) {
    console.error('获取订单统计失败:', error)
    return c.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      }
    }, 500)
  }
})

/**
 * 获取最近订单
 * GET /api/v1/orders/recent
 */
app.get('/recent', async (c) => {
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '10'), 50) // 最大50条

    const orders = await orderService.getRecentOrders(limit)

    return c.json({
      success: true,
      data: orders
    })

  } catch (error) {
    console.error('获取最近订单失败:', error)
    return c.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      }
    }, 500)
  }
})

export default app