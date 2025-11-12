import { Hono } from 'hono'
import { webhookProcessingService } from '../services/webhook-processing-service'
import { orderStateService } from '../services/order-state-service'
import {
  adminAuth,
  adminRateLimit,
  adminRequestLogging,
  corsSecurity,
  adminCorsSecurity,
  allSecurityHeaders
} from '../middleware'

const app = new Hono()

// 全局安全中间件 - 对所有管理员路由应用
app.use('*', corsSecurity())
app.use('*', adminCorsSecurity())
app.use('*', allSecurityHeaders())
app.use('*', adminRequestLogging())
app.use('*', adminRateLimit())
app.use('*', adminAuth())

/**
 * 获取Webhook统计信息
 * GET /api/v1/webhooks/stats
 */
app.get('/stats', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)

    const stats = await webhookProcessingService.getWebhookStats(days)

    return c.json({
      success: true,
      data: {
        period: `${days} days`,
        ...stats
      }
    }, 200)

  } catch (error) {
    console.error('Failed to get webhook stats:', error)

    return c.json({
      success: false,
      error: {
        code: 'STATS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get webhook stats'
      }
    }, 500)
  }
})

/**
 * 获取Webhook处理日志
 * GET /api/v1/webhooks/logs
 */
app.get('/logs', async (c) => {
  try {
    const gateway = c.req.query('gateway') || undefined
    const startDate = c.req.query('startDate') || undefined
    const endDate = c.req.query('endDate') || undefined
    const status = c.req.query('status') || undefined
    const orderId = c.req.query('orderId') || undefined
    const page = parseInt(c.req.query('page') || '1', 10)
    const pageSize = parseInt(c.req.query('pageSize') || '50', 10)

    const result = await webhookProcessingService.getWebhookLogs({
      gateway,
      startDate,
      endDate,
      status,
      orderId,
      page,
      pageSize
    })

    return c.json({
      success: true,
      data: {
        records: result.records,
        pagination: {
          page,
          pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / pageSize)
        }
      }
    }, 200)

  } catch (error) {
    console.error('Failed to get webhook logs:', error)

    return c.json({
      success: false,
      error: {
        code: 'LOGS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get webhook logs'
      }
    }, 500)
  }
})

/**
 * 手动重新处理Webhook记录
 * POST /api/v1/webhooks/reprocess/:recordId
 */
app.post('/reprocess/:recordId', async (c) => {
  try {
    const recordId = c.req.param('recordId')

    const result = await webhookProcessingService.reprocessWebhook(recordId)

    return c.json({
      success: result.success,
      data: {
        recordId,
        processed: result.processed,
        message: result.message,
        orderId: result.orderId,
        retryCount: result.retryCount
      }
    }, result.success ? 200 : 400)

  } catch (error) {
    console.error(`Failed to reprocess webhook record ${c.req.param('recordId')}:`, error)

    return c.json({
      success: false,
      error: {
        code: 'REPROCESS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to reprocess webhook'
      }
    }, 500)
  }
})

/**
 * 获取订单状态详情
 * GET /api/v1/orders/:orderId/status
 */
app.get('/orders/:orderId/status', async (c) => {
  try {
    const orderId = c.req.param('orderId')

    const result = await orderStateService.getOrderStatusDetails(orderId)

    return c.json({
      success: true,
      data: {
        order: {
          id: result.order.id,
          email: result.order.email,
          productId: result.order.productId,
          gateway: result.order.gateway,
          amount: result.order.amount,
          currency: result.order.currency,
          status: result.order.status,
          createdAt: result.order.createdAt,
          updatedAt: result.order.updatedAt
        },
        paymentInfo: result.paymentInfo,
        statusHistory: result.statusHistory
      }
    }, 200)

  } catch (error) {
    console.error(`Failed to get order status for ${c.req.param('orderId')}:`, error)

    return c.json({
      success: false,
      error: {
        code: 'ORDER_STATUS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get order status'
      }
    }, error instanceof Error && error.message.includes('not found') ? 404 : 500)
  }
})

/**
 * 查询订单列表
 * GET /api/v1/orders
 */
app.get('/orders', async (c) => {
  try {
    const status = c.req.query('status') as any || undefined
    const gateway = c.req.query('gateway') as any || undefined
    const startDate = c.req.query('startDate') || undefined
    const endDate = c.req.query('endDate') || undefined
    const email = c.req.query('email') || undefined
    const page = parseInt(c.req.query('page') || '1', 10)
    const limit = parseInt(c.req.query('limit') || '20', 10)

    const result = await orderStateService.queryOrders({
      status,
      gateway,
      startDate,
      endDate,
      email,
      page,
      limit
    })

    return c.json({
      success: true,
      data: {
        orders: result.orders,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit)
        }
      }
    }, 200)

  } catch (error) {
    console.error('Failed to query orders:', error)

    return c.json({
      success: false,
      error: {
        code: 'QUERY_ERROR',
        message: error instanceof Error ? error.message : 'Failed to query orders'
      }
    }, 500)
  }
})

/**
 * 获取订单状态统计
 * GET /api/v1/orders/stats
 */
app.get('/orders/stats', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)

    const stats = await orderStateService.getOrderStateStats(days)

    return c.json({
      success: true,
      data: {
        period: `${days} days`,
        ...stats
      }
    }, 200)

  } catch (error) {
    console.error('Failed to get order state stats:', error)

    return c.json({
      success: false,
      error: {
        code: 'STATS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get order state stats'
      }
    }, 500)
  }
})

/**
 * 获取支付成功率统计
 * GET /api/v1/orders/payment-success-rate
 */
app.get('/orders/payment-success-rate', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10)

    const stats = await orderStateService.getPaymentSuccessRate(days)

    return c.json({
      success: true,
      data: {
        period: `${days} days`,
        ...stats
      }
    }, 200)

  } catch (error) {
    console.error('Failed to get payment success rate:', error)

    return c.json({
      success: false,
      error: {
        code: 'STATS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get payment success rate'
      }
    }, 500)
  }
})

/**
 * 手动更新订单状态
 * POST /api/v1/orders/:orderId/status
 */
app.post('/orders/:orderId/status', async (c) => {
  try {
    const orderId = c.req.param('orderId')
    const body = await c.req.json()

    const { status, notes } = body

    if (!status) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Status is required'
        }
      }, 400)
    }

    const result = await orderStateService.updateOrderStatusManually(orderId, status, {
      notes
    })

    return c.json({
      success: true,
      data: {
        orderId: result.orderId,
        previousStatus: result.previousStatus,
        newStatus: result.newStatus,
        triggeredActions: result.triggeredActions
      }
    }, 200)

  } catch (error) {
    console.error(`Failed to update order status for ${c.req.param('orderId')}:`, error)

    return c.json({
      success: false,
      error: {
        code: 'UPDATE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update order status'
      }
    }, error instanceof Error && error.message.includes('not found') ? 404 : 500)
  }
})

/**
 * 清理过期的Webhook记录
 * POST /api/v1/webhooks/cleanup
 */
app.post('/cleanup', async (c) => {
  try {
    const daysToKeep = parseInt(c.req.query('days') || '30', 10)

    const deletedCount = await webhookProcessingService.cleanupExpiredRecords(daysToKeep)

    return c.json({
      success: true,
      data: {
        deletedCount,
        daysKept: daysToKeep
      }
    }, 200)

  } catch (error) {
    console.error('Failed to cleanup webhook records:', error)

    return c.json({
      success: false,
      error: {
        code: 'CLEANUP_ERROR',
        message: error instanceof Error ? error.message : 'Failed to cleanup webhook records'
      }
    }, 500)
  }
})

/**
 * Webhook管理员API根路径
 * GET /api/v1/webhooks
 */
app.get('/', async (c) => {
  return c.json({
    success: true,
    message: 'Webhook Admin API',
    version: '1.0.0',
    endpoints: [
      'GET /api/v1/webhooks/stats - Get webhook statistics',
      'GET /api/v1/webhooks/logs - Get webhook processing logs',
      'POST /api/v1/webhooks/reprocess/:recordId - Reprocess webhook',
      'GET /api/v1/webhooks/orders/:orderId/status - Get order status details',
      'GET /api/v1/webhooks/orders - Query orders',
      'GET /api/v1/webhooks/orders/stats - Get order state statistics',
      'GET /api/v1/webhooks/orders/payment-success-rate - Get payment success rate',
      'POST /api/v1/webhooks/orders/:orderId/status - Update order status manually',
      'POST /api/v1/webhooks/cleanup - Cleanup expired webhook records'
    ]
  }, 200)
})

export default app
