import { db, schema } from '../db'
import { eq, and, desc, asc } from 'drizzle-orm'
import { securityService } from './security-service'

// 审计服务类
export class AuditService {
  /**
   * 记录审计日志
   */
  async logAuditEvent(event: {
    userId?: string
    userEmail?: string
    action: string
    resourceType: string
    resourceId?: string
    oldValues?: any
    newValues?: any
    ipAddress?: string
    userAgent?: string
    success: boolean
    errorMessage?: string
    metadata?: any
  }) {
    try {
      // 敏感数据脱敏
      const maskedOldValues = event.oldValues ? this.maskSensitiveData(event.oldValues) : null
      const maskedNewValues = event.newValues ? this.maskSensitiveData(event.newValues) : null

      await db.insert(schema.adminLogs).values({
        adminEmail: event.userEmail || event.userId || 'anonymous',
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        oldValues: maskedOldValues ? JSON.stringify(maskedOldValues) : null,
        newValues: maskedNewValues ? JSON.stringify(maskedNewValues) : null,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        success: event.success,
        errorMessage: event.errorMessage,
        createdAt: new Date().toISOString(),
      })

      // 如果是重要操作，同时记录到专门的审计表（可以扩展）
      if (this.isCriticalAction(event.action)) {
        await this.logCriticalEvent(event)
      }
    } catch (error) {
      console.error('Failed to log audit event:', error)
      // 审计日志失败不应该影响主业务流程
    }
  }

  /**
   * 判断是否为关键操作
   */
  private isCriticalAction(action: string): boolean {
    const criticalActions = [
      'delete',
      'refund',
      'bulk_update',
      'export',
      'import',
      'settings_update',
      'payment_process',
    ]

    return criticalActions.some(critical => action.toLowerCase().includes(critical))
  }

  /**
   * 记录关键事件
   */
  private async logCriticalEvent(event: any) {
    // 可以创建专门的critical_events表
    // 目前使用adminLogs表，但添加特殊标记
    try {
      await db.insert(schema.adminLogs).values({
        adminEmail: event.userEmail || 'system',
        action: 'CRITICAL_EVENT',
        resourceType: 'audit',
        resourceId: event.resourceId,
        newValues: JSON.stringify({
          originalAction: event.action,
          resourceType: event.resourceType,
          resourceId: event.resourceId,
          timestamp: new Date().toISOString(),
          ipAddress: event.ipAddress,
        }),
        success: true,
        createdAt: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Failed to log critical event:', error)
    }
  }

  /**
   * 脱敏敏感数据
   */
  private maskSensitiveData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data
    }

    const sensitiveFields = [
      'email',
      'ipAddress',
      'userAgent',
      'password',
      'token',
      'secret',
      'key',
      'creditCard',
      'ssn',
    ]

    const masked = { ...data }

    const maskRecursive = (obj: any, path: string = ''): void => {
      if (typeof obj !== 'object' || obj === null) {
        return
      }

      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key

        if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
          obj[key] = this.maskValue(value, key)
        } else if (typeof value === 'object' && value !== null) {
          maskRecursive(value, currentPath)
        }
      }
    }

    maskRecursive(masked)
    return masked
  }

  /**
   * 脱敏值
   */
  private maskValue(value: any, fieldName: string): string {
    if (typeof value !== 'string') {
      return '[MASKED]'
    }

    if (fieldName.toLowerCase().includes('email')) {
      return securityService.maskEmail(value)
    }

    if (fieldName.toLowerCase().includes('ip')) {
      return securityService.maskIpAddress(value)
    }

    return securityService.maskGeneric(value)
  }

  /**
   * 查询审计日志
   */
  async queryAuditLogs(query: {
    page?: number
    limit?: number
    userId?: string
    action?: string
    resourceType?: string
    resourceId?: string
    startDate?: string
    endDate?: string
    success?: boolean
    includeSensitive?: boolean
  }) {
    const {
      page = 1,
      limit = 50,
      userId,
      action,
      resourceType,
      resourceId,
      startDate,
      endDate,
      success,
      includeSensitive = false
    } = query

    const offset = (page - 1) * limit

    let whereConditions = []

    if (userId) {
      whereConditions.push(eq(schema.adminLogs.adminEmail, userId))
    }

    if (action) {
      whereConditions.push(eq(schema.adminLogs.action, action))
    }

    if (resourceType) {
      whereConditions.push(eq(schema.adminLogs.resourceType, resourceType))
    }

    if (resourceId) {
      whereConditions.push(eq(schema.adminLogs.resourceId, resourceId))
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

    // 如果不包含敏感信息，则进行脱敏处理
    const processedLogs = includeSensitive ? logs : logs.map(log => ({
      ...log,
      adminEmail: log.adminEmail ? securityService.maskEmail(log.adminEmail) : log.adminEmail,
      ipAddress: log.ipAddress ? securityService.maskIpAddress(log.ipAddress) : log.ipAddress,
      userAgent: log.userAgent ? securityService.maskUserAgent(log.userAgent) : log.userAgent,
    }))

    // 获取总数
    let countQuery = db.select({ count: require('drizzle-orm').count() }).from(schema.adminLogs)
    if (whereConditions.length > 0) {
      countQuery = countQuery.where(and(...whereConditions))
    }

    const totalCountResult = await countQuery
    const total = totalCountResult[0].count

    return {
      logs: processedLogs,
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
   * 获取用户活动时间线
   */
  async getUserActivityTimeline(userEmail: string, days = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const activities = await db.select()
      .from(schema.adminLogs)
      .where(and(
        eq(schema.adminLogs.adminEmail, userEmail),
        `${schema.adminLogs.createdAt} >= '${startDate}'`
      ))
      .orderBy(desc(schema.adminLogs.createdAt))

    return activities.map(activity => ({
      timestamp: activity.createdAt,
      action: activity.action,
      resourceType: activity.resourceType,
      resourceId: activity.resourceId,
      success: activity.success,
      errorMessage: activity.errorMessage,
    }))
  }

  /**
   * 获取资源变更历史
   */
  async getResourceHistory(resourceType: string, resourceId: string) {
    const history = await db.select()
      .from(schema.adminLogs)
      .where(and(
        eq(schema.adminLogs.resourceType, resourceType),
        eq(schema.adminLogs.resourceId, resourceId)
      ))
      .orderBy(desc(schema.adminLogs.createdAt))

    return history.map(record => ({
      timestamp: record.createdAt,
      action: record.action,
      adminEmail: record.adminEmail,
      oldValues: record.oldValues ? JSON.parse(record.oldValues) : null,
      newValues: record.newValues ? JSON.parse(record.newValues) : null,
      success: record.success,
      errorMessage: record.errorMessage,
    }))
  }

  /**
   * 生成审计报告
   */
  async generateAuditReport(startDate: string, endDate: string, options: {
    groupBy?: 'user' | 'action' | 'resourceType'
    includeDetails?: boolean
  } = {}) {
    const { groupBy = 'user', includeDetails = false } = options

    try {
      let report: any = {
        period: { startDate, endDate },
        summary: {},
        details: [],
        generatedAt: new Date().toISOString(),
      }

      // 基础统计
      const basicStats = await db.select({
        totalEvents: require('drizzle-orm').count(),
        successfulEvents: require('drizzle-orm').count(schema.adminLogs.id).filter(eq(schema.adminLogs.success, true)),
        failedEvents: require('drizzle-orm').count(schema.adminLogs.id).filter(eq(schema.adminLogs.success, false)),
      })
        .from(schema.adminLogs)
        .where(and(
          `${schema.adminLogs.createdAt} >= '${startDate}'`,
          `${schema.adminLogs.createdAt} <= '${endDate}'`
        ))

      const stats = basicStats[0]
      report.summary = {
        totalEvents: stats.totalEvents,
        successfulEvents: stats.successfulEvents,
        failedEvents: stats.failedEvents,
        successRate: stats.totalEvents > 0 ? (stats.successfulEvents / stats.totalEvents * 100).toFixed(2) : 0,
      }

      // 按分组统计
      let groupField
      switch (groupBy) {
        case 'user':
          groupField = schema.adminLogs.adminEmail
          break
        case 'action':
          groupField = schema.adminLogs.action
          break
        case 'resourceType':
          groupField = schema.adminLogs.resourceType
          break
      }

      const groupedStats = await db.select({
        group: groupField,
        count: require('drizzle-orm').count(),
        successful: require('drizzle-orm').count(schema.adminLogs.id).filter(eq(schema.adminLogs.success, true)),
        failed: require('drizzle-orm').count(schema.adminLogs.id).filter(eq(schema.adminLogs.success, false)),
      })
        .from(schema.adminLogs)
        .where(and(
          `${schema.adminLogs.createdAt} >= '${startDate}'`,
          `${schema.adminLogs.createdAt} <= '${endDate}'`
        ))
        .groupBy(groupField)
        .orderBy(require('drizzle-orm').desc(require('drizzle-orm').count(schema.adminLogs.id)))

      report.summary.groupedStats = groupedStats.map(stat => ({
        name: stat.group,
        total: stat.count,
        successful: stat.successful,
        failed: stat.failed,
        successRate: stat.count > 0 ? (stat.successful / stat.count * 100).toFixed(2) : 0,
      }))

      // 详细记录（可选）
      if (includeDetails) {
        const details = await db.select()
          .from(schema.adminLogs)
          .where(and(
            `${schema.adminLogs.createdAt} >= '${startDate}'`,
            `${schema.adminLogs.createdAt} <= '${endDate}'`
          ))
          .orderBy(desc(schema.adminLogs.createdAt))
          .limit(1000) // 限制详细记录数量

        report.details = details.map(record => ({
          timestamp: record.createdAt,
          adminEmail: securityService.maskEmail(record.adminEmail),
          action: record.action,
          resourceType: record.resourceType,
          resourceId: record.resourceId,
          success: record.success,
          errorMessage: record.errorMessage,
        }))
      }

      return report
    } catch (error) {
      console.error('Failed to generate audit report:', error)
      throw error
    }
  }

  /**
   * 清理旧的审计日志
   */
  async cleanupOldAuditLogs(daysToKeep = 365) {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString()

    const result = await db.delete(schema.adminLogs)
      .where(and(
        eq(schema.adminLogs.success, true), // 只删除成功的日志
        `${schema.adminLogs.createdAt} < '${cutoffDate}'`,
        `${schema.adminLogs.action} != 'CRITICAL_EVENT'` // 保留关键事件
      ))

    return result.changes
  }

  /**
   * 导出审计数据
   */
  async exportAuditData(startDate: string, endDate: string, format: 'json' | 'csv' = 'json') {
    const logs = await db.select()
      .from(schema.adminLogs)
      .where(and(
        `${schema.adminLogs.createdAt} >= '${startDate}'`,
        `${schema.adminLogs.createdAt} <= '${endDate}'`
      ))
      .orderBy(desc(schema.adminLogs.createdAt))

    if (format === 'csv') {
      // 简单的CSV格式转换
      const headers = ['created_at', 'admin_email', 'action', 'resource_type', 'resource_id', 'success', 'error_message']
      const csvData = logs.map(log => [
        log.createdAt,
        securityService.maskEmail(log.adminEmail),
        log.action,
        log.resourceType,
        log.resourceId,
        log.success,
        log.errorMessage,
      ])

      return [
        headers.join(','),
        ...csvData.map(row => row.map(cell => `"${cell || ''}"`).join(','))
      ].join('\n')
    }

    // JSON格式（默认）
    return {
      exportInfo: {
        startDate,
        endDate,
        recordCount: logs.length,
        exportedAt: new Date().toISOString(),
      },
      data: logs.map(log => ({
        ...log,
        adminEmail: securityService.maskEmail(log.adminEmail),
        ipAddress: log.ipAddress ? securityService.maskIpAddress(log.ipAddress) : null,
        userAgent: log.userAgent ? securityService.maskUserAgent(log.userAgent) : null,
      }))
    }
  }
}

// 创建审计服务实例
export const auditService = new AuditService()

// 默认导出
export default auditService