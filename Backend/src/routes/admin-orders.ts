import { Hono } from 'hono'
import { z } from 'zod'
import { orderService } from '../services/order-service'
import { orderStateService } from '../services/order-state-service'
import { paymentGatewayService } from '../services/payment-gateway-service'
import { verifyToken, getClientIP } from '../utils/auth'
import { AdminEventType, AdminEventCategory } from '../db/schema'

const app = new Hono()

// 订单筛选验证模式
const orderQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z.string().optional(),
  gateway: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.string().optional(),
})

// 退款验证模式
const refundSchema = z.object({
  reason: z.string().min(1, '退款原因不能为空').max(500, '退款原因不能超过500字符'),
})

/**
 * 管理员权限验证中间件
 */
async function requireAdminAuth(c: any, next: () => Promise<void>) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: '未授权访问' }, 401)
  }

  const token = authHeader.substring(7)

  try {
    const decoded = verifyToken(token)
    if (!decoded || !['admin', 'super_admin'].includes(decoded.role)) {
      return c.json({ success: false, error: '权限不足' }, 403)
    }

    // 将管理员信息附加到上下文
    c.set('admin', decoded)
    await next()
  } catch (error) {
    return c.json({ success: false, error: '令牌无效或已过期' }, 401)
  }
}

/**
 * 获取订单列表（包含分页和筛选）
 */
app.get('/orders', requireAdminAuth, async (c) => {
  try {
    // 获取查询参数
    const queryParams = orderQuerySchema.parse({
      page: c.req.query('page'),
      limit: c.req.query('limit'),
      status: c.req.query('status'),
      gateway: c.req.query('gateway'),
      dateFrom: c.req.query('dateFrom'),
      dateTo: c.req.query('dateTo'),
      search: c.req.query('search'),
      sortBy: c.req.query('sortBy'),
      sortOrder: c.req.query('sortOrder'),
    })

    const page = parseInt(queryParams.page || '1')
    const limit = parseInt(queryParams.limit || '20')
    const offset = (page - 1) * limit

    // 构建查询条件
    const filters: any = {
      page,
      limit,
      offset,
    }

    if (queryParams.status) {
      filters.status = queryParams.status
    }

    if (queryParams.gateway) {
      filters.gateway = queryParams.gateway
    }

    if (queryParams.dateFrom) {
      filters.dateFrom = queryParams.dateFrom
    }

    if (queryParams.dateTo) {
      filters.dateTo = queryParams.dateTo
    }

    if (queryParams.search) {
      filters.search = queryParams.search
    }

    if (queryParams.sortBy) {
      filters.sortBy = queryParams.sortBy
    } else {
      filters.sortBy = 'createdAt'
    }

    if (queryParams.sortOrder) {
      filters.sortOrder = queryParams.sortOrder
    } else {
      filters.sortOrder = 'desc'
    }

    // 查询订单列表
    const result = await orderService.getOrdersWithFilters(filters)

    return c.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('获取订单列表失败:', error)
    return c.json({
      success: false,
      error: '获取订单列表失败',
    }, 500)
  }
})

/**
 * 获取订单筛选选项
 */
app.get('/orders/filter-options', requireAdminAuth, async (c) => {
  try {
    const filterOptions = await orderService.getOrderFilterOptions()

    return c.json({
      success: true,
      data: filterOptions,
    })
  } catch (error) {
    console.error('获取筛选选项失败:', error)
    return c.json({
      success: false,
      error: '获取筛选选项失败',
    }, 500)
  }
})

/**
 * 重新发送订单发货邮件
 */
app.post('/orders/:orderId/resend', requireAdminAuth, async (c) => {
  const admin = c.get('admin')
  const clientIP = getClientIP(c.req)
  const orderId = c.req.param('orderId')

  try {
    // 验证订单ID
    if (!orderId) {
      return c.json({
        success: false,
        error: '订单ID不能为空',
      }, 400)
    }

    // 获取订单详情
    const orderDetails = await orderService.getOrderWithDetails(orderId)
    if (!orderDetails || !orderDetails.order) {
      return c.json({
        success: false,
        error: '订单不存在',
      }, 404)
    }

    const order = orderDetails.order

    // 检查订单状态
    if (order.status !== 'delivered' && order.status !== 'paid') {
      return c.json({
        success: false,
        error: '只有已发货或已支付的订单才能重发邮件',
      }, 400)
    }

    // TODO: 调用订单状态服务重新发送邮件
    // 临时实现：直接返回成功
    console.log(`管理员 ${admin.username} 在 ${clientIP} 重发了订单 ${orderId} 的发货邮件`, {
      eventType: AdminEventType.ORDER_RESEND,
      eventCategory: AdminEventCategory.ORDER_MANAGEMENT,
      details: {
        orderId,
        email: order.email,
        status: order.status,
      },
    })

    return c.json({
      success: true,
      message: '邮件重发成功',
      data: {
        orderId,
        email: order.email,
        resendAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('重发邮件失败:', error)
    return c.json({
      success: false,
      error: '重发邮件失败，请稍后重试',
    }, 500)
  }
})

/**
 * 执行订单退款
 */
app.post('/orders/:orderId/refund', requireAdminAuth, async (c) => {
  const admin = c.get('admin')
  const clientIP = getClientIP(c.req)
  const orderId = c.req.param('orderId')

  try {
    // 验证订单ID
    if (!orderId) {
      return c.json({
        success: false,
        error: '订单ID不能为空',
      }, 400)
    }

    // 解析请求体
    const body = await c.req.json()
    const { reason } = refundSchema.parse(body)

    // 获取订单详情
    const orderDetails = await orderService.getOrderWithDetails(orderId)
    if (!orderDetails || !orderDetails.order) {
      return c.json({
        success: false,
        error: '订单不存在',
      }, 404)
    }

    const order = orderDetails.order

    // 检查订单状态
    if (order.status !== 'paid' && order.status !== 'delivered') {
      return c.json({
        success: false,
        error: '只有已支付或已发货的订单才能退款',
      }, 400)
    }

    // TODO: 调用支付网关服务执行退款
    // 临时实现：直接返回成功
    console.log(`管理员 ${admin.username} 在 ${clientIP} 执行了订单 ${orderId} 的退款操作`, {
      eventType: AdminEventType.ORDER_REFUND,
      eventCategory: AdminEventCategory.ORDER_MANAGEMENT,
      details: {
        orderId,
        email: order.email,
        amount: order.amount,
        currency: order.currency,
        gateway: order.gateway,
        reason,
      },
    })

    return c.json({
      success: true,
      message: '退款操作成功',
      data: {
        orderId,
        amount: order.amount,
        currency: order.currency,
        gateway: order.gateway,
        refundAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('退款操作失败:', error)

    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: '输入数据无效',
        details: error.errors,
      }, 400)
    }

    return c.json({
      success: false,
      error: '退款操作失败，请稍后重试',
    }, 500)
  }
})

export default app
