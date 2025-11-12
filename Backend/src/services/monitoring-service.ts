import { db, schema } from '../db'
import { eq, and, desc, asc, count, like } from 'drizzle-orm'

// 监控服务类
export class MonitoringService {
  /**
   * 记录管理员操作日志
   */
  async logAdminAction(logData: {
    adminEmail: string
    action: string
    resourceType: string
    resourceId?: string
    oldValues?: any
    newValues?: any
    ipAddress?: string
    userAgent?: string
    success?: boolean
    errorMessage?: string
  }) {
    try {
      await db.insert(schema.adminLogs).values({
        adminEmail: logData.adminEmail,
        action: logData.action,
        resourceType: logData.resourceType,
        resourceId: logData.resourceId,
        oldValues: logData.oldValues ? JSON.stringify(logData.oldValues) : null,
        newValues: logData.newValues ? JSON.stringify(logData.newValues) : null,
        ipAddress: logData.ipAddress,
        userAgent: logData.userAgent,
        success: logData.success !== false,
        errorMessage: logData.errorMessage,
        createdAt: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Failed to log admin action:', error)
    }
  }

  /**
   * 获取数据库性能统计
   */
  async getDatabaseStats() {
    try {
      const stats = {
        // 表记录数
        tables: {
          products: await this.getTableCount('products'),
          orders: await this.getTableCount('orders'),
          deliveries: await this.getTableCount('deliveries'),
          downloads: await this.getTableCount('downloads'),
          paymentsRaw: await this.getTableCount('payments_raw'),
          inventoryText: await this.getTableCount('inventory_text'),
          adminLogs: await this.getTableCount('admin_logs'),
          files: await this.getTableCount('files'),
          productPrices: await this.getTableCount('product_prices'),
          settings: await this.getTableCount('settings'),
        },
        // 索引使用情况（SQLite需要特殊处理）
        indexes: await this.getIndexStats(),
        // 数据库文件大小
        databaseSize: await this.getDatabaseSize(),
      }

      return stats
    } catch (error) {
      console.error('Failed to get database stats:', error)
      throw error
    }
  }

  /**
   * 获取表记录数
   */
  private async getTableCount(tableName: string): Promise<number> {
    try {
      const result = await db.execute(`SELECT COUNT(*) as count FROM ${tableName}`)
      return (result as any)[0]?.count || 0
    } catch (error) {
      console.error(`Failed to get count for table ${tableName}:`, error)
      return 0
    }
  }

  /**
   * 获取索引统计信息
   */
  private async getIndexStats() {
    try {
      const result = await db.execute(`
        SELECT
          name as indexName,
          tbl_name as tableName,
          sql as definition
        FROM sqlite_master
        WHERE type = 'index'
        AND name NOT LIKE 'sqlite_%'
        ORDER BY tbl_name, name
      `)

      return (result as any) || []
    } catch (error) {
      console.error('Failed to get index stats:', error)
      return []
    }
  }

  /**
   * 获取数据库文件大小（简化版）
   */
  private async getDatabaseSize(): Promise<number> {
    try {
      // 这里需要根据实际的数据库连接方式来获取文件大小
      // 对于better-sqlite3，可以使用文件系统API
      return 0 // 占位符
    } catch (error) {
      console.error('Failed to get database size:', error)
      return 0
    }
  }

  /**
   * 查询管理员操作日志
   */
  async queryAdminLogs(query: {
    page?: number
    limit?: number
    adminEmail?: string
    action?: string
    resourceType?: string
    startDate?: string
    endDate?: string
    success?: boolean
  }) {
    const {
      page = 1,
      limit = 50,
      adminEmail,
      action,
      resourceType,
      startDate,
      endDate,
      success
    } = query

    const offset = (page - 1) * limit

    let whereConditions = []

    if (adminEmail) {
      whereConditions.push(eq(schema.adminLogs.adminEmail, adminEmail))
    }

    if (action) {
      whereConditions.push(eq(schema.adminLogs.action, action))
    }

    if (resourceType) {
      whereConditions.push(eq(schema.adminLogs.resourceType, resourceType))
    }

    if (success !== undefined) {
      whereConditions.push(eq(schema.adminLogs.success, success))
    }

    if (startDate) {
      whereConditions.push(`${schema.adminLogs.createdAt} >= '${startDate}'`)
    }

    if (endDate) {
      whereConditions.push(`${schema.adminLogs.createdAt} <= '${endDate}'`)
    }

    let queryBuilder = db.select().from(schema.adminLogs)

    if (whereConditions.length > 0) {
      queryBuilder = queryBuilder.where(and(...whereConditions))
    }

    const logs = await queryBuilder
      .orderBy(desc(schema.adminLogs.createdAt))
      .limit(limit)
      .offset(offset)

    // 获取总数
    let countQuery = db.select({ count: count() }).from(schema.adminLogs)
    if (whereConditions.length > 0) {
      countQuery = countQuery.where(and(...whereConditions))
    }

    const totalCountResult = await countQuery
    const total = totalCountResult[0].count

    return {
      logs,
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
   * 获取操作统计
   */
  async getOperationStats(startDate?: string, endDate?: string) {
    let whereConditions = []

    if (startDate) {
      whereConditions.push(`${schema.adminLogs.createdAt} >= '${startDate}'`)
    }

    if (endDate) {
      whereConditions.push(`${schema.adminLogs.createdAt} <= '${endDate}'`)
    }

    // 按操作类型统计
    const actionStats = await db.select({
      action: schema.adminLogs.action,
      count: count(),
      successRate: count(schema.adminLogs.id).filter(eq(schema.adminLogs.success, true)) * 100.0 / count(schema.adminLogs.id),
    })
      .from(schema.adminLogs)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(schema.adminLogs.action)

    // 按资源类型统计
    const resourceStats = await db.select({
      resourceType: schema.adminLogs.resourceType,
      count: count(),
    })
      .from(schema.adminLogs)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(schema.adminLogs.resourceType)

    // 按管理员统计
    const adminStats = await db.select({
      adminEmail: schema.adminLogs.adminEmail,
      count: count(),
      lastActivity: schema.adminLogs.createdAt,
    })
      .from(schema.adminLogs)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(schema.adminLogs.adminEmail)
      .orderBy(desc(count(schema.adminLogs.id)))

    // 成功率统计
    const successStats = await db.select({
      total: count(),
      successful: count(schema.adminLogs.id).filter(eq(schema.adminLogs.success, true)),
      failed: count(schema.adminLogs.id).filter(eq(schema.adminLogs.success, false)),
    })
      .from(schema.adminLogs)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)

    const totalStats = successStats[0] || { total: 0, successful: 0, failed: 0 }

    return {
      actionStats,
      resourceStats,
      adminStats,
      successRate: totalStats.total > 0 ? (totalStats.successful / totalStats.total) * 100 : 0,
      totalOperations: totalStats.total,
      successfulOperations: totalStats.successful,
      failedOperations: totalStats.failed,
    }
  }

  /**
   * 清理旧的日志记录
   */
  async cleanupOldLogs(daysToKeep = 90) {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString()

    const result = await db.delete(schema.adminLogs)
      .where(`${schema.adminLogs.createdAt} < '${cutoffDate}'`)

    return result.changes
  }

  /**
   * 获取系统健康状态
   */
  async getSystemHealth() {
    const health = {
      database: {
        connected: false,
        responseTime: 0,
        errorCount: 0,
      },
      tables: {
        orders: { status: 'unknown', count: 0 },
        products: { status: 'unknown', count: 0 },
        deliveries: { status: 'unknown', count: 0 },
      },
      recentErrors: [] as any[],
      performance: {
        avgResponseTime: 0,
        slowQueries: 0,
      },
    }

    try {
      // 检查数据库连接
      const startTime = Date.now()
      await db.execute('SELECT 1')
      const responseTime = Date.now() - startTime

      health.database.connected = true
      health.database.responseTime = responseTime

      // 检查主要表的记录数
      health.tables.orders.count = await this.getTableCount('orders')
      health.tables.products.count = await this.getTableCount('products')
      health.tables.deliveries.count = await this.getTableCount('deliveries')

      // 确定表状态
      Object.keys(health.tables).forEach(table => {
        const tableData = health.tables[table as keyof typeof health.tables]
        if (typeof tableData === 'object' && tableData !== null) {
          tableData.status = tableData.count >= 0 ? 'healthy' : 'error'
        }
      })

      // 获取最近的错误日志
      const recentErrors = await db.select()
        .from(schema.adminLogs)
        .where(and(
          eq(schema.adminLogs.success, false),
          `${schema.adminLogs.createdAt} > datetime('now', '-1 hour')`
        ))
        .orderBy(desc(schema.adminLogs.createdAt))
        .limit(10)

      health.recentErrors = recentErrors
      health.database.errorCount = recentErrors.length

      // 基本性能指标
      health.performance.avgResponseTime = responseTime
      health.performance.slowQueries = responseTime > 1000 ? 1 : 0 // 简化版

    } catch (error) {
      health.database.connected = false
      console.error('Health check failed:', error)
    }

    return health
  }

  /**
   * 获取订单趋势数据
   */
  async getOrderTrends(days = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    try {
      // 按日期分组统计订单
      const dailyOrders = await db.execute(`
        SELECT
          date(created_at) as date,
          COUNT(*) as totalOrders,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paidOrders,
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as deliveredOrders,
          SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as totalRevenue
        FROM orders
        WHERE created_at >= '${startDate}'
        GROUP BY date(created_at)
        ORDER BY date DESC
      `)

      // 按状态统计
      const statusStats = await db.execute(`
        SELECT
          status,
          COUNT(*) as count,
          SUM(amount) as totalAmount
        FROM orders
        WHERE created_at >= '${startDate}'
        GROUP BY status
      `)

      return {
        dailyOrders: (dailyOrders as any) || [],
        statusStats: (statusStats as any) || [],
      }
    } catch (error) {
      console.error('Failed to get order trends:', error)
      return {
        dailyOrders: [],
        statusStats: [],
      }
    }
  }

  /**
   * 记录性能指标
   */
  async recordPerformanceMetric(metric: {
    endpoint: string
    method: string
    responseTime: number
    statusCode: number
    userAgent?: string
    ipAddress?: string
  }) {
    try {
      // 这里可以创建专门的性能监控表
      // 目前使用adminLogs表记录
      await db.insert(schema.adminLogs).values({
        adminEmail: 'system@autoship.com',
        action: 'view', // 使用view表示性能监控
        resourceType: 'performance',
        resourceId: metric.endpoint,
        newValues: JSON.stringify({
          method: metric.method,
          responseTime: metric.responseTime,
          statusCode: metric.statusCode,
        }),
        ipAddress: metric.ipAddress,
        userAgent: metric.userAgent,
        success: metric.statusCode < 400,
        createdAt: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Failed to record performance metric:', error)
    }
  }
}

// 创建监控服务实例
export const monitoringService = new MonitoringService()

// 性能监控装饰器
export function performanceMonitor(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value

  descriptor.value = async function (...args: any[]) {
    const startTime = Date.now()
    const endpoint = `${target.constructor.name}.${propertyName}`

    try {
      const result = await method.apply(this, args)
      const responseTime = Date.now() - startTime

      // 记录成功的性能指标
      monitoringService.recordPerformanceMetric({
        endpoint,
        method: 'function',
        responseTime,
        statusCode: 200,
      }).catch(error => {
        console.error('Failed to record performance metric:', error)
      })

      return result
    } catch (error) {
      const responseTime = Date.now() - startTime

      // 记录失败的性能指标
      monitoringService.recordPerformanceMetric({
        endpoint,
        method: 'function',
        responseTime,
        statusCode: 500,
      }).catch(logError => {
        console.error('Failed to record performance metric:', logError)
      })

      throw error
    }
  }

  return descriptor
}

// 默认导出
export default monitoringService