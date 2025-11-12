import { db, schema, withTransaction } from '../db'
import { eq, and, desc, asc, count, like, or, sql } from 'drizzle-orm'
import { OrderStatus, Currency, Gateway } from '../db/schema'
import { validateOrder, validateOrderCreate, validateOrderUpdate, validateOrderQuery } from '../db/validation'
import { randomUUID } from 'crypto'

// 订单服务类
export class OrderService {
  /**
   * 创建新订单
   */
  async createOrder(orderData: any) {
    const validatedData = validateOrderCreate(orderData)

    return await withTransaction(async () => {
      // 生成UUID作为订单ID
      const orderId = randomUUID()

      const order = await db.insert(schema.orders)
        .values({
          id: orderId,
          productId: validatedData.productId,
          email: validatedData.email,
          gateway: validatedData.gateway,
          amount: validatedData.amount,
          currency: validatedData.currency,
          status: validatedData.status || OrderStatus.PENDING,
          gatewayOrderId: validatedData.gatewayOrderId,
          gatewayData: validatedData.gatewayData,
          notes: validatedData.notes,
          customerIp: validatedData.customerIp,
          customerUserAgent: validatedData.customerUserAgent,
        })
        .returning()

      return order[0]
    })
  }

  /**
   * 根据ID获取订单
   */
  async getOrderById(orderId: string) {
    const order = await db.select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .limit(1)

    return order[0] || null
  }

  /**
   * 获取订单详情（包含商品和发货信息）
   */
  async getOrderWithDetails(orderId: string) {
    const result = await db
      .select({
        order: schema.orders,
        product: schema.products,
        delivery: schema.deliveries,
      })
      .from(schema.orders)
      .leftJoin(schema.products, eq(schema.orders.productId, schema.products.id))
      .leftJoin(schema.deliveries, eq(schema.orders.id, schema.deliveries.orderId))
      .where(eq(schema.orders.id, orderId))
      .limit(1)

    return result[0] || null
  }

  /**
   * 根据邮箱查询订单
   */
  async getOrdersByEmail(email: string, options: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 20 } = options
    const offset = (page - 1) * limit

    const orders = await db.select()
      .from(schema.orders)
      .where(eq(schema.orders.email, email))
      .orderBy(desc(schema.orders.createdAt))
      .limit(limit)
      .offset(offset)

    const totalCount = await db.select({ count: count() })
      .from(schema.orders)
      .where(eq(schema.orders.email, email))

    return {
      orders,
      pagination: {
        page,
        limit,
        total: totalCount[0].count,
        totalPages: Math.ceil(totalCount[0].count / limit),
        hasNext: page * limit < totalCount[0].count,
        hasPrev: page > 1,
      }
    }
  }

  /**
   * 根据状态查询订单
   */
  async getOrdersByStatus(status: string, options: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 20 } = options
    const offset = (page - 1) * limit

    const orders = await db.select()
      .from(schema.orders)
      .where(eq(schema.orders.status, status))
      .orderBy(desc(schema.orders.createdAt))
      .limit(limit)
      .offset(offset)

    const totalCount = await db.select({ count: count() })
      .from(schema.orders)
      .where(eq(schema.orders.status, status))

    return {
      orders,
      pagination: {
        page,
        limit,
        total: totalCount[0].count,
        totalPages: Math.ceil(totalCount[0].count / limit),
        hasNext: page * limit < totalCount[0].count,
        hasPrev: page > 1,
      }
    }
  }

  /**
   * 高级订单查询
   */
  async queryOrders(query: any) {
    const validatedQuery = validateOrderQuery(query)
    const { page = 1, limit = 20, offset = 0, status, email, gateway, currency, startDate, endDate, search } = validatedQuery

    let whereConditions = []

    // 构建查询条件
    if (status) {
      whereConditions.push(eq(schema.orders.status, status))
    }

    if (email) {
      whereConditions.push(eq(schema.orders.email, email))
    }

    if (gateway) {
      whereConditions.push(eq(schema.orders.gateway, gateway))
    }

    if (currency) {
      whereConditions.push(eq(schema.orders.currency, currency))
    }

    if (startDate) {
      // 使用Drizzle的日期比较函数
      whereConditions.push(sql`${schema.orders.createdAt} >= ${startDate}`)
    }

    if (endDate) {
      whereConditions.push(sql`${schema.orders.createdAt} <= ${endDate}`)
    }

    if (search) {
      whereConditions.push(
        or(
          like(schema.orders.id, `%${search}%`),
          like(schema.orders.email, `%${search}%`),
          like(schema.orders.gatewayOrderId, `%${search}%`)
        )
      )
    }

    let queryBuilder = db.select().from(schema.orders)

    if (whereConditions.length > 0) {
      queryBuilder = queryBuilder.where(and(...whereConditions))
    }

    queryBuilder = queryBuilder
      .orderBy(desc(schema.orders.createdAt))
      .limit(limit)
      .offset(offset || (page - 1) * limit)

    const orders = await queryBuilder

    // 获取总数
    let countQuery = db.select({ count: count() }).from(schema.orders)
    if (whereConditions.length > 0) {
      countQuery = countQuery.where(and(...whereConditions))
    }

    const totalCountResult = await countQuery
    const total = totalCountResult[0].count

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      }
    }
  }

  /**
   * 更新订单状态
   */
  async updateOrderStatus(orderId: string, status: string, additionalData?: any) {
    return await withTransaction(async () => {
      const updateData: any = {
        status,
        updatedAt: new Date().toISOString(),
      }

      // 根据状态设置时间戳
      if (status === OrderStatus.PAID && !additionalData?.skipPaidAt) {
        updateData.paidAt = new Date().toISOString()
      }

      if (status === OrderStatus.DELIVERED && !additionalData?.skipDeliveredAt) {
        updateData.deliveredAt = new Date().toISOString()
      }

      if (status === OrderStatus.REFUNDED && !additionalData?.skipRefundedAt) {
        updateData.refundedAt = new Date().toISOString()
      }

      // 合并额外数据
      if (additionalData) {
        Object.assign(updateData, additionalData)
      }

      const result = await db.update(schema.orders)
        .set(updateData)
        .where(eq(schema.orders.id, orderId))
        .returning()

      return result[0] || null
    })
  }

  /**
   * 更新订单信息
   */
  async updateOrder(orderId: string, updateData: any) {
    const validatedData = validateOrderUpdate(updateData)

    const result = await db.update(schema.orders)
      .set({
        ...validatedData,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.orders.id, orderId))
      .returning()

    return result[0] || null
  }

  /**
   * 检查订单是否存在
   */
  async orderExists(orderId: string) {
    const result = await db.select({ count: count() })
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))

    return result[0].count > 0
  }

  /**
   * 根据网关订单ID查找订单
   */
  async findByGatewayOrderId(gatewayOrderId: string, gateway: string) {
    const order = await db.select()
      .from(schema.orders)
      .where(and(
        eq(schema.orders.gatewayOrderId, gatewayOrderId),
        eq(schema.orders.gateway, gateway)
      ))
      .limit(1)

    return order[0] || null
  }

  /**
   * 获取订单统计信息
   */
  async getOrderStats(startDate?: string, endDate?: string) {
    let whereConditions = []

    if (startDate) {
      // 使用Drizzle的日期比较函数
      whereConditions.push(sql`${schema.orders.createdAt} >= ${startDate}`)
    }

    if (endDate) {
      whereConditions.push(sql`${schema.orders.createdAt} <= ${endDate}`)
    }

    let queryBuilder = db.select({
      totalOrders: count(),
      totalAmount: schema.orders.amount, // 这需要更复杂的聚合查询
    })

    if (whereConditions.length > 0) {
      queryBuilder = queryBuilder.where(and(...whereConditions))
    }

    // 按状态分组统计
    const statusStats = await db.select({
      status: schema.orders.status,
      count: count(),
      totalAmount: schema.orders.amount,
    })
      .from(schema.orders)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(schema.orders.status)

    // 按网关分组统计
    const gatewayStats = await db.select({
      gateway: schema.orders.gateway,
      count: count(),
      totalAmount: schema.orders.amount,
    })
      .from(schema.orders)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(schema.orders.gateway)

    // 按货币分组统计
    const currencyStats = await db.select({
      currency: schema.orders.currency,
      count: count(),
      totalAmount: schema.orders.amount,
    })
      .from(schema.orders)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(schema.orders.currency)

    return {
      statusStats,
      gatewayStats,
      currencyStats,
    }
  }

  /**
   * 获取最近订单
   */
  async getRecentOrders(limit = 10) {
    return await db.select()
      .from(schema.orders)
      .orderBy(desc(schema.orders.createdAt))
      .limit(limit)
  }

  /**
   * 清理过期订单
   */
  async cleanupExpiredOrders(timeoutHours = 24) {
    const timeoutDate = new Date(Date.now() - timeoutHours * 60 * 60 * 1000).toISOString()

    const result = await db.update(schema.orders)
      .set({
        status: OrderStatus.FAILED,
        updatedAt: new Date().toISOString(),
      })
      .where(and(
        eq(schema.orders.status, OrderStatus.PENDING),
        sql`${schema.orders.createdAt} < ${timeoutDate}`
      ))
      .returning()

    return result.length
  }

  /**
   * 导出订单数据
   */
  async exportOrders(query: any, format: 'csv' | 'json' = 'csv') {
    const validatedQuery = validateOrderQuery(query)

    // 获取匹配的订单（不分页，用于导出）
    const orders = await db.select()
      .from(schema.orders)
      .where(this._buildWhereConditions(validatedQuery))
      .orderBy(desc(schema.orders.createdAt))

    if (format === 'json') {
      return {
        data: orders,
        filename: `orders_${new Date().toISOString().split('T')[0]}.json`
      }
    }

    // CSV格式导出
    const headers = [
      '订单ID', '商品ID', '邮箱', '支付网关', '金额', '货币',
      '状态', '网关订单ID', '客户IP', '支付时间', '发货时间', '创建时间'
    ]

    const csvRows = orders.map(order => [
      order.id,
      order.productId.toString(),
      order.email,
      order.gateway,
      order.amount.toString(),
      order.currency,
      order.status,
      order.gatewayOrderId || '',
      order.customerIp || '',
      order.paidAt || '',
      order.deliveredAt || '',
      order.createdAt
    ])

    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    return {
      data: csvContent,
      filename: `orders_${new Date().toISOString().split('T')[0]}.csv`
    }
  }

  /**
   * 记录订单操作日志
   */
  async logOrderAction(orderId: string, action: string, details?: any) {
    try {
      // 这里可以集成到审计服务中
      console.log(`Order Action Log: ${orderId} - ${action}`, details)

      // 如果有专门的审计日志表，可以在这里插入记录
      // await auditService.logOrderAction(orderId, action, details)
    } catch (error) {
      console.error('Failed to log order action:', error)
    }
  }

  /**
   * 获取订单的业务指标
   */
  async getOrderMetrics(startDate?: string, endDate?: string) {
    const whereConditions = this._buildDateConditions(startDate, endDate)

    // 基础指标
    const basicMetrics = await db.select({
      totalOrders: count(),
      totalRevenue: schema.orders.amount,
      averageOrderValue: schema.orders.amount,
    })
      .from(schema.orders)
      .where(and(
        eq(schema.orders.status, OrderStatus.PAID),
        ...whereConditions
      ))

    // 按时间分组的趋势数据
    const dailyStats = await db.select({
      date: schema.orders.createdAt, // 需要按日期分组
      orderCount: count(),
      revenue: schema.orders.amount,
    })
      .from(schema.orders)
      .where(and(
        eq(schema.orders.status, OrderStatus.PAID),
        ...whereConditions
      ))
      .groupBy(schema.orders.createdAt) // 需要修改为按日期分组

    // 转化率计算
    const funnelStats = await db.select({
      status: schema.orders.status,
      count: count(),
    })
      .from(schema.orders)
      .where(and(...whereConditions))
      .groupBy(schema.orders.status)

    return {
      totalOrders: basicMetrics[0]?.totalOrders || 0,
      totalRevenue: basicMetrics[0]?.totalRevenue || 0,
      averageOrderValue: basicMetrics[0]?.averageOrderValue || 0,
      dailyStats,
      funnelStats,
    }
  }

  /**
   * 获取订单健康状态
   */
  async getOrderHealthStatus() {
    const now = new Date()
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const last1h = new Date(now.getTime() - 60 * 60 * 1000).toISOString()

    // 检查最近24小时的订单情况
    const recentOrders = await db.select({ count: count() })
      .from(schema.orders)
      .where(sql`${schema.orders.createdAt} >= ${last24h}`)

    // 检查最近1小时的订单情况
    const veryRecentOrders = await db.select({ count: count() })
      .from(schema.orders)
      .where(sql`${schema.orders.createdAt} >= ${last1h}`)

    // 检查长时间未支付的订单
    const stuckOrders = await db.select({ count: count() })
      .from(schema.orders)
      .where(and(
        eq(schema.orders.status, OrderStatus.PENDING),
        sql`${schema.orders.createdAt} < ${last24h}`
      ))

    // 检查支付超时的订单数量
    const timeoutThreshold = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString() // 2小时
    const timeoutOrders = await db.select({ count: count() })
      .from(schema.orders)
      .where(and(
        eq(schema.orders.status, OrderStatus.PENDING),
        sql`${schema.orders.createdAt} < ${timeoutThreshold}`
      ))

    const isHealthy = {
      hasRecentActivity: recentOrders[0]?.count > 0,
      hasVeryRecentActivity: veryRecentOrders[0]?.count > 0,
      noStuckOrders: stuckOrders[0]?.count < 10, // 允许少量积压
      noTimeoutOrders: timeoutOrders[0]?.count < 5, // 允许少量超时
    }

    const overallHealth = Object.values(isHealthy).every(Boolean)

    return {
      healthy: overallHealth,
      metrics: {
        recentOrders24h: recentOrders[0]?.count || 0,
        recentOrders1h: veryRecentOrders[0]?.count || 0,
        stuckOrders: stuckOrders[0]?.count || 0,
        timeoutOrders: timeoutOrders[0]?.count || 0,
      },
      checks: isHealthy,
    }
  }

  /**
   * 构建查询条件（内部方法）
   */
  private _buildWhereConditions(query: any) {
    let conditions = []

    if (query.status) {
      conditions.push(eq(schema.orders.status, query.status))
    }

    if (query.email) {
      conditions.push(eq(schema.orders.email, query.email))
    }

    if (query.gateway) {
      conditions.push(eq(schema.orders.gateway, query.gateway))
    }

    if (query.currency) {
      conditions.push(eq(schema.orders.currency, query.currency))
    }

    if (query.search) {
      conditions.push(
        or(
          like(schema.orders.id, `%${query.search}%`),
          like(schema.orders.email, `%${query.search}%`),
          like(schema.orders.gatewayOrderId, `%${query.search}%`)
        )
      )
    }

    return conditions.length > 0 ? and(...conditions) : undefined
  }

  /**
   * 构建日期条件（内部方法）
   */
  private _buildDateConditions(startDate?: string, endDate?: string) {
    let conditions = []

    if (startDate) {
      conditions.push(sql`${schema.orders.createdAt} >= ${startDate}`)
    }

    if (endDate) {
      conditions.push(sql`${schema.orders.createdAt} <= ${endDate}`)
    }

    return conditions
  }
}

// 创建订单服务实例
export const orderService = new OrderService()

// 默认导出
export default orderService