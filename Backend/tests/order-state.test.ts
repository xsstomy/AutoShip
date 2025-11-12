import { describe, it, expect, beforeEach, vi } from 'vitest'
import { orderStateService } from '../src/services/order-state-service'
import { OrderStatus, Gateway } from '../src/types/orders'

// Mock 依赖
vi.mock('../src/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn()
  },
  schema: {
    orders: {
      id: 'id',
      status: 'status',
      gateway: 'gateway',
      gatewayOrderId: 'gatewayOrderId',
      paidAt: 'paidAt',
      createdAt: 'createdAt',
      updatedAt: 'updatedAt'
    },
    auditLogs: {
      resourceType: 'resourceType',
      resourceId: 'resourceId',
      action: 'action',
      createdAt: 'createdAt',
      metadata: 'metadata'
    }
  }
}))

vi.mock('../src/services/audit-service', () => ({
  auditService: {
    logAuditEvent: vi.fn()
  }
}))

describe('OrderStateService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('updateOrderStatusFromWebhook', () => {
    it('should update order status from paid webhook', async () => {
      const mockOrder = {
        id: 'ORDER_TEST_123',
        status: OrderStatus.PENDING,
        gateway: Gateway.ALIPAY,
        gatewayOrderId: 'ALIPAY_TEST_123'
      }

      // Mock getOrderById
      const { db } = await import('../src/db')
      vi.mocked(db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockOrder])
          })
        })
      }))

      // Mock update
      vi.mocked(db.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ changes: 1 })
        })
      }))

      const result = await orderStateService.updateOrderStatusFromWebhook(
        'ORDER_TEST_123',
        Gateway.ALIPAY,
        'ALIPAY_TEST_123',
        'paid',
        {
          transactionId: 'TXN_123',
          paidAt: new Date().toISOString()
        }
      )

      expect(result.orderId).toBe('ORDER_TEST_123')
      expect(result.previousStatus).toBe(OrderStatus.PENDING)
      expect(result.newStatus).toBe(OrderStatus.PAID)
      expect(result.updated).toBe(true)
    })

    it('should update order status from cancelled webhook', async () => {
      const mockOrder = {
        id: 'ORDER_TEST_123',
        status: OrderStatus.PENDING,
        gateway: Gateway.CREEM,
        gatewayOrderId: 'CREEM_TEST_123'
      }

      const { db } = await import('../src/db')
      vi.mocked(db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockOrder])
          })
        })
      }))

      vi.mocked(db.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ changes: 1 })
        })
      }))

      const result = await orderStateService.updateOrderStatusFromWebhook(
        'ORDER_TEST_123',
        Gateway.CREEM,
        'CREEM_TEST_123',
        'cancelled',
        {}
      )

      expect(result.orderId).toBe('ORDER_TEST_123')
      expect(result.newStatus).toBe(OrderStatus.CANCELLED)
    })

    it('should update order status from failed webhook', async () => {
      const mockOrder = {
        id: 'ORDER_TEST_123',
        status: OrderStatus.PENDING,
        gateway: Gateway.ALIPAY
      }

      const { db } = await import('../src/db')
      vi.mocked(db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockOrder])
          })
        })
      }))

      vi.mocked(db.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ changes: 1 })
        })
      }))

      const result = await orderStateService.updateOrderStatusFromWebhook(
        'ORDER_TEST_123',
        Gateway.ALIPAY,
        'ALIPAY_TEST_123',
        'failed',
        {}
      )

      expect(result.orderId).toBe('ORDER_TEST_123')
      expect(result.newStatus).toBe(OrderStatus.FAILED)
    })

    it('should throw error for unknown payment status', async () => {
      const mockOrder = {
        id: 'ORDER_TEST_123',
        status: OrderStatus.PENDING
      }

      const { db } = await import('../src/db')
      vi.mocked(db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockOrder])
          })
        })
      }))

      await expect(
        orderStateService.updateOrderStatusFromWebhook(
          'ORDER_TEST_123',
          Gateway.ALIPAY,
          'ALIPAY_TEST_123',
          'unknown_status',
          {}
        )
      ).rejects.toThrow('Unknown payment status')
    })

    it('should throw error for order not found', async () => {
      const { db } = await import('../src/db')
      vi.mocked(db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      }))

      await expect(
        orderStateService.updateOrderStatusFromWebhook(
          'ORDER_NOT_FOUND',
          Gateway.ALIPAY,
          'ALIPAY_TEST_123',
          'paid',
          {}
        )
      ).rejects.toThrow('Order ORDER_NOT_FOUND not found')
    })
  })

  describe('updateOrderStatusManually', () => {
    it('should manually update order status', async () => {
      const mockOrder = {
        id: 'ORDER_TEST_123',
        status: OrderStatus.PAID
      }

      const { db } = await import('../src/db')
      vi.mocked(db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockOrder])
          })
        })
      }))

      vi.mocked(db.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({ changes: 1 })
        })
      }))

      const result = await orderStateService.updateOrderStatusManually(
        'ORDER_TEST_123',
        OrderStatus.DELIVERED,
        { notes: 'Manual delivery' }
      )

      expect(result.orderId).toBe('ORDER_TEST_123')
      expect(result.newStatus).toBe(OrderStatus.DELIVERED)
      expect(result.triggeredActions).toContain('delivery_process')
    })

    it('should reject invalid status transition', async () => {
      const mockOrder = {
        id: 'ORDER_TEST_123',
        status: OrderStatus.FAILED
      }

      const { db } = await import('../src/db')
      vi.mocked(db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockOrder])
          })
        })
      }))

      await expect(
        orderStateService.updateOrderStatusManually(
          'ORDER_TEST_123',
          OrderStatus.PAID,
          {}
        )
      ).rejects.toThrow('Invalid status transition')
    })
  })

  describe('getOrderStatusDetails', () => {
    it('should return order status details', async () => {
      const mockOrder = {
        id: 'ORDER_TEST_123',
        email: 'test@example.com',
        gateway: Gateway.ALIPAY,
        status: OrderStatus.PAID,
        paidAt: new Date().toISOString()
      }

      const { db } = await import('../src/db')
      vi.mocked(db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockOrder])
          })
        })
      }))

      vi.mocked(db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            and: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                like: vi.fn().mockResolvedValue([])
              })
            })
          }),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      }))

      const result = await orderStateService.getOrderStatusDetails('ORDER_TEST_123')

      expect(result.order.id).toBe('ORDER_TEST_123')
      expect(result.paymentInfo.gateway).toBe(Gateway.ALIPAY)
    })
  })

  describe('getOrderStateStats', () => {
    it('should return order state statistics', async () => {
      const mockStats = {
        totalOrders: 100,
        statusDistribution: [
          { status: OrderStatus.PENDING, count: 20, percentage: 20 },
          { status: OrderStatus.PAID, count: 50, percentage: 50 },
          { status: OrderStatus.DELIVERED, count: 30, percentage: 30 }
        ],
        gatewayDistribution: [
          { gateway: Gateway.ALIPAY, count: 60, totalAmount: 6000 },
          { gateway: Gateway.CREEM, count: 40, totalAmount: 4000 }
        ],
        dailyStats: []
      }

      const { db } = await import('../src/db')
      vi.mocked(db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([{ count: 100 }])
            })
          })
        })
      }))

      vi.mocked(db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([])
            })
          })
        })
      }))

      vi.mocked(db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([])
            })
          })
        })
      }))

      const result = await orderStateService.getOrderStateStats(7)

      expect(result.totalOrders).toBe(100)
      expect(result.statusDistribution).toHaveLength(3)
    })
  })

  describe('getPaymentSuccessRate', () => {
    it('should return payment success rate', async () => {
      const { db } = await import('../src/db')
      vi.mocked(db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ total: 100, paid: 90 }])
        })
      }))

      vi.mocked(db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue([])
          })
        })
      }))

      vi.mocked(db.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([])
            })
          })
        })
      }))

      const result = await orderStateService.getPaymentSuccessRate(7)

      expect(result.overall).toBe(90)
      expect(result.byGateway).toEqual({})
    })
  })
})
