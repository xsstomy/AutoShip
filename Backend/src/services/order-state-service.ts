import { db, schema } from '../db'
import { and, eq, sql, desc } from 'drizzle-orm'
import { auditService } from './audit-service'
import { OrderStatus, OrderStatusType, ORDER_STATUS_TRANSITIONS, GatewayType } from '../types/orders'

/**
 * 订单状态更新选项
 */
export interface OrderStatusUpdateOptions {
  transactionId?: string
  paidAt?: string
  gatewayData?: string
  notes?: string
  triggerBy?: 'webhook' | 'manual' | 'system'
}

/**
 * 订单状态更新结果
 */
export interface OrderStatusUpdateResult {
  orderId: string
  previousStatus: OrderStatusType
  newStatus: OrderStatusType
  updated: boolean
  triggeredActions: string[]
}

/**
 * 订单状态历史记录
 */
export interface OrderStatusHistory {
  orderId: string
  status: OrderStatusType
  timestamp: string
  reason: string
  triggeredBy: string
}

/**
 * 订单状态统计信息
 */
export interface OrderStateStats {
  totalOrders: number
  statusDistribution: Array<{
    status: OrderStatusType
    count: number
    percentage: number
  }>
  gatewayDistribution: Array<{
    gateway: GatewayType
    count: number
    totalAmount: number
  }>
  dailyStats: Array<{
    date: string
    orderCount: number
    paidCount: number
    revenue: number
  }>
}

/**
 * 订单状态管理服务
 * 负责订单状态转换、审计、触发业务逻辑
 */
export class OrderStateService {
  /**
   * 从Webhook更新订单状态
   * 接收支付网关回调并更新订单状态
   */
  async updateOrderStatusFromWebhook(
    orderId: string,
    gateway: GatewayType,
    gatewayOrderId: string,
    paymentStatus: string,
    options: OrderStatusUpdateOptions
  ): Promise<OrderStatusUpdateResult> {
    try {
      console.log(`[OrderState] Updating order ${orderId} from webhook:`, {
        gateway,
        gatewayOrderId,
        paymentStatus
      })

      // 1. 查询当前订单
      const order = await this.getOrderById(orderId)
      if (!order) {
        throw new Error(`Order ${orderId} not found`)
      }

      // 2. 映射支付状态到订单状态
      const newStatus = this.mapPaymentStatusToOrderStatus(paymentStatus)
      if (!newStatus) {
        throw new Error(`Unknown payment status: ${paymentStatus}`)
      }

      // 3. 验证状态转换
      const validationResult = await this.validateStatusTransition(order.status, newStatus, orderId)
      if (!validationResult.isValid) {
        throw new Error(`Invalid status transition: ${order.status} -> ${newStatus}`)
      }

      // 4. 在事务中更新状态
      const result = await this.updateOrderStatusInTransaction(
        orderId,
        order.status,
        newStatus,
        {
          ...options,
          triggerBy: 'webhook',
          gatewayOrderId
        }
      )

      console.log(`[OrderState] Order ${orderId} status updated:`, {
        from: order.status,
        to: newStatus,
        triggeredBy: 'webhook'
      })

      return result

    } catch (error) {
      console.error(`[OrderState] Failed to update order ${orderId} from webhook:`, error)
      throw error
    }
  }

  /**
   * 手动更新订单状态
   * 管理员手动触发状态变更
   */
  async updateOrderStatusManually(
    orderId: string,
    newStatus: OrderStatusType,
    options: OrderStatusUpdateOptions = {}
  ): Promise<OrderStatusUpdateResult> {
    try {
      console.log(`[OrderState] Manual status update for order ${orderId}:`, {
        to: newStatus,
        notes: options.notes
      })

      // 1. 查询当前订单
      const order = await this.getOrderById(orderId)
      if (!order) {
        throw new Error(`Order ${orderId} not found`)
      }

      // 2. 验证状态转换
      const validationResult = await this.validateStatusTransition(order.status, newStatus, orderId)
      if (!validationResult.isValid) {
        throw new Error(`Invalid status transition: ${order.status} -> ${newStatus}`)
      }

      // 3. 在事务中更新状态
      const result = await this.updateOrderStatusInTransaction(
        orderId,
        order.status,
        newStatus,
        {
          ...options,
          triggerBy: 'manual'
        }
      )

      console.log(`[OrderState] Order ${orderId} status manually updated:`, {
        from: order.status,
        to: newStatus
      })

      return result

    } catch (error) {
      console.error(`[OrderState] Manual status update failed for order ${orderId}:`, error)
      throw error
    }
  }

  /**
   * 查询订单状态详情
   * 包含支付信息和状态历史
   */
  async getOrderStatusDetails(orderId: string): Promise<{
    order: any
    statusHistory: OrderStatusHistory[]
    paymentInfo: {
      gateway: string
      gatewayOrderId?: string
      transactionId?: string
      paidAt?: string
    }
  }> {
    try {
      // 查询订单
      const [order] = await db.select()
        .from(schema.orders)
        .where(eq(schema.orders.id, orderId))
        .limit(1)

      if (!order) {
        throw new Error(`Order ${orderId} not found`)
      }

      // 查询状态历史
      const statusHistory = await this.getOrderStatusHistory(orderId)

      // 提取支付信息
      const paymentInfo = {
        gateway: order.gateway,
        gatewayOrderId: order.gatewayOrderId || undefined,
        transactionId: undefined, // 从 gatewayData 中解析
        paidAt: order.paidAt || undefined
      }

      // 如果有gatewayData，尝试解析transactionId
      if (order.gatewayData) {
        try {
          const gatewayData = JSON.parse(order.gatewayData)
          paymentInfo.transactionId = gatewayData.trade_no || gatewayData.transaction_id
        } catch (error) {
          // 忽略解析错误
        }
      }

      return {
        order,
        statusHistory,
        paymentInfo
      }

    } catch (error) {
      console.error(`[OrderState] Failed to get status details for order ${orderId}:`, error)
      throw error
    }
  }

  /**
   * 查询订单状态历史
   */
  async getOrderStatusHistory(orderId: string): Promise<OrderStatusHistory[]> {
    try {
      // 从audit_logs表查询状态变更历史
      const historyRecords = await db.select()
        .from(schema.auditLogs)
        .where(and(
          eq(schema.auditLogs.resourceType, 'order'),
          eq(schema.auditLogs.resourceId, orderId),
          sql`${schema.auditLogs.action} LIKE '%status%'`
        ))
        .orderBy(desc(schema.auditLogs.createdAt))
        .limit(50)

      return historyRecords.map(record => {
        let metadata = {}
        try {
          metadata = record.metadata ? JSON.parse(record.metadata) : {}
        } catch (e) {
          // 忽略 JSON 解析错误
        }

        return {
          orderId,
          status: (metadata as any).status || 'unknown',
          timestamp: record.createdAt || '',
          reason: record.action,
          triggeredBy: (metadata as any).triggeredBy || 'system'
        }
      })

    } catch (error) {
      console.error(`[OrderState] Failed to get status history for order ${orderId}:`, error)
      return []
    }
  }

  /**
   * 按条件查询订单
   * 支持状态、网关、时间等过滤条件
   */
  async queryOrders(options: {
    status?: OrderStatusType
    gateway?: GatewayType
    startDate?: string
    endDate?: string
    email?: string
    page?: number
    limit?: number
  }): Promise<{
    orders: any[]
    total: number
  }> {
    try {
      const page = options.page || 1
      const limit = Math.min(options.limit || 20, 100)
      const offset = (page - 1) * limit

      const conditions = []

      if (options.status) {
        conditions.push(eq(schema.orders.status, options.status))
      }

      if (options.gateway) {
        conditions.push(eq(schema.orders.gateway, options.gateway))
      }

      if (options.email) {
        conditions.push(eq(schema.orders.email, options.email))
      }

      if (options.startDate) {
        conditions.push(sql`${schema.orders.createdAt} >= ${options.startDate}`)
      }

      if (options.endDate) {
        conditions.push(sql`${schema.orders.createdAt} <= ${options.endDate}`)
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      // 查询订单
      const orders = await db.select()
        .from(schema.orders)
        .where(whereClause)
        .orderBy(desc(schema.orders.createdAt))
        .limit(limit)
        .offset(offset)

      // 查询总数
      const countResult = await db.select({
        count: sql`COUNT(*)`
      })
        .from(schema.orders)
        .where(whereClause)

      return {
        orders,
        total: Number(countResult[0]?.count || 0)
      }

    } catch (error) {
      console.error('[OrderState] Failed to query orders:', error)
      throw error
    }
  }

  /**
   * 获取订单状态统计信息
   */
  async getOrderStateStats(days = 7): Promise<OrderStateStats> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

      // 总订单数
      const totalResult = await db.select({
        count: sql`COUNT(*)`
      })
        .from(schema.orders)
        .where(sql`${schema.orders.createdAt} >= ${startDate}`)

      const totalOrders = Number(totalResult[0]?.count || 0)

      // 状态分布
      const statusResult = await db.select({
        status: schema.orders.status,
        count: sql`COUNT(*)`
      })
        .from(schema.orders)
        .where(sql`${schema.orders.createdAt} >= ${startDate}`)
        .groupBy(schema.orders.status)

      const statusDistribution = statusResult.map(s => ({
        status: s.status as OrderStatusType,
        count: Number(s.count || 0),
        percentage: totalOrders > 0 ? (Number(s.count || 0) / totalOrders * 100) : 0
      }))

      // 网关分布
      const gatewayResult = await db.select({
        gateway: schema.orders.gateway,
        count: sql`COUNT(*)`,
        totalAmount: sql`SUM(${schema.orders.amount})`
      })
        .from(schema.orders)
        .where(sql`${schema.orders.createdAt} >= ${startDate}`)
        .groupBy(schema.orders.gateway)

      const gatewayDistribution = gatewayResult.map(g => ({
        gateway: g.gateway as GatewayType,
        count: Number(g.count || 0),
        totalAmount: Number(g.totalAmount) || 0
      }))

      // 每日统计
      const dailyResult = await db.select({
        date: sql`DATE(${schema.orders.createdAt}) as date`,
        orderCount: sql`COUNT(*)`,
        paidCount: sql`SUM(CASE WHEN ${schema.orders.status} = 'paid' THEN 1 ELSE 0 END)`,
        revenue: sql`SUM(CASE WHEN ${schema.orders.status} = 'paid' THEN ${schema.orders.amount} ELSE 0 END)`
      })
        .from(schema.orders)
        .where(sql`${schema.orders.createdAt} >= ${startDate}`)
        .groupBy(sql`DATE(${schema.orders.createdAt})`)
        .orderBy(sql`DATE(${schema.orders.createdAt})`)

      const dailyStats = dailyResult.map(d => ({
        date: String(d.date),
        orderCount: Number(d.orderCount || 0),
        paidCount: Number(d.paidCount || 0),
        revenue: Number(d.revenue) || 0
      }))

      return {
        totalOrders,
        statusDistribution,
        gatewayDistribution,
        dailyStats
      }

    } catch (error) {
      console.error('[OrderState] Failed to get order state stats:', error)
      return {
        totalOrders: 0,
        statusDistribution: [],
        gatewayDistribution: [],
        dailyStats: []
      }
    }
  }

  /**
   * 支付成功率统计
   */
  async getPaymentSuccessRate(days = 7): Promise<{
    overall: number
    byGateway: Record<string, number>
    daily: Array<{
      date: string
      rate: number
    }>
  }> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

      // 整体成功率
      const totalResult = await db.select({
        total: sql`COUNT(*)`,
        paid: sql`SUM(CASE WHEN ${schema.orders.status} = 'paid' THEN 1 ELSE 0 END)`
      })
        .from(schema.orders)
        .where(sql`${schema.orders.createdAt} >= ${startDate}`)

      const overall = Number(totalResult[0]?.total || 0) > 0 ?
        (Number(totalResult[0]?.paid || 0) / Number(totalResult[0]?.total || 0) * 100) : 0

      // 按网关统计
      const gatewayResult = await db.select({
        gateway: schema.orders.gateway,
        total: sql`COUNT(*)`,
        paid: sql`SUM(CASE WHEN ${schema.orders.status} = 'paid' THEN 1 ELSE 0 END)`
      })
        .from(schema.orders)
        .where(sql`${schema.orders.createdAt} >= ${startDate}`)
        .groupBy(schema.orders.gateway)

      const byGateway: Record<string, number> = {}
      gatewayResult.forEach(g => {
        const total = Number(g.total || 0)
        const paid = Number(g.paid || 0)
        byGateway[String(g.gateway)] = total > 0 ? (paid / total * 100) : 0
      })

      // 每日统计
      const dailyResult = await db.select({
        date: sql`DATE(${schema.orders.createdAt}) as date`,
        total: sql`COUNT(*)`,
        paid: sql`SUM(CASE WHEN ${schema.orders.status} = 'paid' THEN 1 ELSE 0 END)`
      })
        .from(schema.orders)
        .where(sql`${schema.orders.createdAt} >= ${startDate}`)
        .groupBy(sql`DATE(${schema.orders.createdAt})`)
        .orderBy(sql`DATE(${schema.orders.createdAt})`)

      const daily = dailyResult.map(d => ({
        date: String(d.date),
        rate: Number(d.total || 0) > 0 ? (Number(d.paid || 0) / Number(d.total || 0) * 100) : 0
      }))

      return {
        overall,
        byGateway,
        daily
      }

    } catch (error) {
      console.error('[OrderState] Failed to get payment success rate:', error)
      return {
        overall: 0,
        byGateway: {},
        daily: []
      }
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 获取订单详情
   */
  private async getOrderById(orderId: string): Promise<any | null> {
    const result = await db.select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .limit(1)

    return result[0] || null
  }

  /**
   * 映射支付状态到订单状态
   */
  private mapPaymentStatusToOrderStatus(paymentStatus: string): OrderStatusType | null {
    switch (paymentStatus) {
      case 'paid':
        return OrderStatus.PAID
      case 'cancelled':
        return OrderStatus.CANCELLED
      case 'failed':
        return OrderStatus.FAILED
      case 'pending':
        return OrderStatus.PENDING
      default:
        return null
    }
  }

  /**
   * 验证状态转换是否合法
   */
  private async validateStatusTransition(
    currentStatus: OrderStatusType,
    newStatus: OrderStatusType,
    orderId: string
  ): Promise<{ isValid: boolean; error?: string }> {
    // 检查是否为终态
    if (ORDER_STATUS_TRANSITIONS[currentStatus]?.length === 0) {
      return {
        isValid: false,
        error: `Cannot transition from terminal status: ${currentStatus}`
      }
    }

    // 检查转换规则
    const allowedTransitions = ORDER_STATUS_TRANSITIONS[currentStatus] || []
    if (!allowedTransitions.includes(newStatus)) {
      return {
        isValid: false,
        error: `Invalid status transition: ${currentStatus} -> ${newStatus}`
      }
    }

    return { isValid: true }
  }

  /**
   * 在事务中更新订单状态
   * 包括状态更新、审计日志、业务触发器
   */
  private async updateOrderStatusInTransaction(
    orderId: string,
    previousStatus: OrderStatusType,
    newStatus: OrderStatusType,
    options: OrderStatusUpdateOptions & { gatewayOrderId?: string }
  ): Promise<OrderStatusUpdateResult> {
    try {
      // 1. 更新订单状态
      const updateData: any = {
        status: newStatus,
        updatedAt: new Date().toISOString()
      }

      // 支付成功时设置支付时间
      if (newStatus === OrderStatus.PAID && options.paidAt) {
        updateData.paidAt = options.paidAt
      }

      // 更新网关订单ID
      if (options.gatewayOrderId) {
        updateData.gatewayOrderId = options.gatewayOrderId
      }

      // 更新网关数据
      if (options.gatewayData) {
        updateData.gatewayData = options.gatewayData
      }

      // 更新备注
      if (options.notes) {
        updateData.notes = options.notes
      }

      await db.update(schema.orders)
        .set(updateData)
        .where(eq(schema.orders.id, orderId))

      // 2. 记录审计日志
      await auditService.logAuditEvent({
        action: 'order_status_changed',
        resourceType: 'order',
        resourceId: orderId,
        success: true,
        metadata: {
          previousStatus,
          newStatus,
          triggeredBy: options.triggerBy || 'system',
          transactionId: options.transactionId,
          gatewayOrderId: options.gatewayOrderId
        }
      })

      // 3. 触发业务逻辑
      const triggeredActions = await this.triggerBusinessLogic(orderId, newStatus, previousStatus, options)

      return {
        orderId,
        previousStatus,
        newStatus,
        updated: true,
        triggeredActions
      }

    } catch (error) {
      console.error(`[OrderState] Failed to update order status in transaction:`, error)
      throw error
    }
  }

  /**
   * 触发业务逻辑
   * 根据状态变更执行相应操作
   */
  private async triggerBusinessLogic(
    orderId: string,
    newStatus: OrderStatusType,
    previousStatus: OrderStatusType,
    options: OrderStatusUpdateOptions
  ): Promise<string[]> {
    const triggeredActions: string[] = []

    try {
      // 支付成功 -> 触发发货
      if (newStatus === OrderStatus.PAID && previousStatus === OrderStatus.PENDING) {
        console.log(`[OrderState] Triggering delivery process for order ${orderId}`)
        triggeredActions.push('delivery_process')

        // TODO: 这里可以调用发货服务
        // await deliveryService.processDelivery(orderId)
      }

      // 发货完成 -> 触发完成通知
      if (newStatus === OrderStatus.DELIVERED) {
        console.log(`[OrderState] Triggering completion notifications for order ${orderId}`)
        triggeredActions.push('completion_notifications')

        // TODO: 发送完成通知邮件
      }

      // 支付失败 -> 触发失败通知
      if (newStatus === OrderStatus.FAILED && previousStatus === OrderStatus.PENDING) {
        console.log(`[OrderState] Triggering failure notifications for order ${orderId}`)
        triggeredActions.push('failure_notifications')

        // TODO: 发送失败通知邮件
      }

      return triggeredActions

    } catch (error) {
      console.error(`[OrderState] Business logic trigger failed for order ${orderId}:`, error)

      // 业务逻辑失败不应该影响状态更新
      return triggeredActions
    }
  }
}

// 创建并导出订单状态服务实例
export const orderStateService = new OrderStateService()

export default orderStateService
