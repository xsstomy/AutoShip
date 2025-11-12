import { db, schema } from '../db'
import { eq, and, lt, desc } from 'drizzle-orm'
import { OrderStatus } from '../db/schema'
import { auditService } from './audit-service'
import { backupService } from './backup-service'

// 维护服务类
export class MaintenanceService {
  /**
   * 执行所有维护任务
   */
  async runAllMaintenanceTasks(): Promise<{
    success: boolean
    results: Record<string, any>
    errors: string[]
  }> {
    const results: Record<string, any> = {}
    const errors: string[] = []

    console.log('🔧 Starting maintenance tasks...')

    try {
      // 1. 清理过期订单
      results.expiredOrders = await this.cleanupExpiredOrders()

      // 2. 清理过期库存
      results.expiredInventory = await this.cleanupExpiredInventory()

      // 3. 清理旧的支付回调记录
      results.oldPaymentCallbacks = await this.cleanupOldPaymentCallbacks()

      // 4. 清理旧的下载记录
      results.oldDownloads = await this.cleanupOldDownloads()

      // 5. 清理旧的管理员日志
      results.oldAuditLogs = await this.cleanupOldAuditLogs()

      // 6. 清理无效的下载链接
      results.invalidDownloads = await this.cleanupInvalidDownloads()

      // 7. 优化数据库
      results.optimization = await this.optimizeDatabase()

      // 8. 更新统计信息
      results.statistics = await this.updateStatistics()

      // 9. 清理旧备份
      results.backupCleanup = await this.cleanupOldBackups()

      console.log('✅ Maintenance tasks completed successfully')

      return {
        success: true,
        results,
        errors,
      }

    } catch (error) {
      const errorMessage = `Maintenance failed: ${error.message}`
      console.error('❌', errorMessage)
      errors.push(errorMessage)

      // 记录维护失败
      await auditService.logAuditEvent({
        userEmail: 'system@autoship.com',
        action: 'maintenance_failed',
        resourceType: 'system',
        success: false,
        errorMessage: error.message,
      })

      return {
        success: false,
        results,
        errors,
      }
    }
  }

  /**
   * 清理过期订单
   */
  async cleanupExpiredOrders(timeoutHours = 24): Promise<{ cleaned: number; errors: string[] }> {
    const errors: string[] = []

    try {
      const timeoutDate = new Date(Date.now() - timeoutHours * 60 * 60 * 1000).toISOString()

      const result = await db.update(schema.orders)
        .set({
          status: OrderStatus.FAILED,
          updatedAt: new Date().toISOString(),
        })
        .where(and(
          eq(schema.orders.status, OrderStatus.PENDING),
          lt(schema.orders.createdAt, timeoutDate)
        ))

      console.log(`🧹 Cleaned up ${result.changes} expired orders`)

      return {
        cleaned: result.changes,
        errors,
      }

    } catch (error) {
      const errorMsg = `Failed to cleanup expired orders: ${error.message}`
      errors.push(errorMsg)
      console.error('❌', errorMsg)
      return { cleaned: 0, errors }
    }
  }

  /**
   * 清理过期库存
   */
  async cleanupExpiredInventory(): Promise<{ cleaned: number; errors: string[] }> {
    const errors: string[] = []

    try {
      const result = await db.delete(schema.inventoryText)
        .where(and(
          eq(schema.inventoryText.isUsed, false),
          `${schema.inventoryText.expiresAt} IS NOT NULL`,
          lt(schema.inventoryText.expiresAt, new Date().toISOString())
        ))

      console.log(`🧹 Cleaned up ${result.changes} expired inventory items`)

      return {
        cleaned: result.changes,
        errors,
      }

    } catch (error) {
      const errorMsg = `Failed to cleanup expired inventory: ${error.message}`
      errors.push(errorMsg)
      console.error('❌', errorMsg)
      return { cleaned: 0, errors }
    }
  }

  /**
   * 清理旧的支付回调记录
   */
  async cleanupOldPaymentCallbacks(daysToKeep = 90): Promise<{ cleaned: number; errors: string[] }> {
    const errors: string[] = []

    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString()

      const result = await db.delete(schema.paymentsRaw)
        .where(and(
          eq(schema.paymentsRaw.processed, true),
          lt(schema.paymentsRaw.createdAt, cutoffDate)
        ))

      console.log(`🧹 Cleaned up ${result.changes} old payment callback records`)

      return {
        cleaned: result.changes,
        errors,
      }

    } catch (error) {
      const errorMsg = `Failed to cleanup old payment callbacks: ${error.message}`
      errors.push(errorMsg)
      console.error('❌', errorMsg)
      return { cleaned: 0, errors }
    }
  }

  /**
   * 清理旧的下载记录
   */
  async cleanupOldDownloads(daysToKeep = 365): Promise<{ cleaned: number; errors: string[] }> {
    const errors: string[] = []

    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString()

      const result = await db.delete(schema.downloads)
        .where(lt(schema.downloads.downloadedAt, cutoffDate))

      console.log(`🧹 Cleaned up ${result.changes} old download records`)

      return {
        cleaned: result.changes,
        errors,
      }

    } catch (error) {
      const errorMsg = `Failed to cleanup old downloads: ${error.message}`
      errors.push(errorMsg)
      console.error('❌', errorMsg)
      return { cleaned: 0, errors }
    }
  }

  /**
   * 清理旧的管理员日志
   */
  async cleanupOldAuditLogs(daysToKeep = 365): Promise<{ cleaned: number; errors: string[] }> {
    const errors: string[] = []

    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString()

      const result = await db.delete(schema.adminLogs)
        .where(and(
          eq(schema.adminLogs.success, true),
          lt(schema.adminLogs.createdAt, cutoffDate)
        ))

      console.log(`🧹 Cleaned up ${result.changes} old audit logs`)

      return {
        cleaned: result.changes,
        errors,
      }

    } catch (error) {
      const errorMsg = `Failed to cleanup old audit logs: ${error.message}`
      errors.push(errorMsg)
      console.error('❌', errorMsg)
      return { cleaned: 0, errors }
    }
  }

  /**
   * 清理无效的下载链接
   */
  async cleanupInvalidDownloads(): Promise<{ cleaned: number; errors: string[] }> {
    const errors: string[] = []

    try {
      // 清理已过期且未被使用的下载链接
      const result = await db.delete(schema.deliveries)
        .where(and(
          eq(schema.deliveries.isActive, true),
          `${schema.deliveries.expiresAt} IS NOT NULL`,
          lt(schema.deliveries.expiresAt, new Date().toISOString())
        ))

      console.log(`🧹 Cleaned up ${result.changes} invalid download links`)

      return {
        cleaned: result.changes,
        errors,
      }

    } catch (error) {
      const errorMsg = `Failed to cleanup invalid downloads: ${error.message}`
      errors.push(errorMsg)
      console.error('❌', errorMsg)
      return { cleaned: 0, errors }
    }
  }

  /**
   * 优化数据库
   */
  async optimizeDatabase(): Promise<{ optimized: boolean; errors: string[] }> {
    const errors: string[] = []

    try {
      // SQLite优化命令
      await db.execute('VACUUM')
      await db.execute('ANALYZE')

      console.log('🔧 Database optimized (VACUUM + ANALYZE)')

      return {
        optimized: true,
        errors,
      }

    } catch (error) {
      const errorMsg = `Failed to optimize database: ${error.message}`
      errors.push(errorMsg)
      console.error('❌', errorMsg)
      return { optimized: false, errors }
    }
  }

  /**
   * 更新统计信息
   */
  async updateStatistics(): Promise<{ updated: boolean; stats?: any; errors: string[] }> {
    const errors: string[] = []

    try {
      // 获取当前统计信息
      const stats = {
        products: await db.select({ count: { count: 'count' } }).from(schema.products),
        orders: await db.select({ count: { count: 'count' } }).from(schema.orders),
        deliveries: await db.select({ count: { count: 'count' } }).from(schema.deliveries),
        downloads: await db.select({ count: { count: 'count' } }).from(schema.downloads),
        inventoryText: await db.select({ count: { count: 'count' } }).from(schema.inventoryText),
      }

      const statsSummary = {
        products: (stats as any)[0]?.count?.count || 0,
        orders: (stats as any)[1]?.count?.count || 0,
        deliveries: (stats as any)[2]?.count?.count || 0,
        downloads: (stats as any)[3]?.count?.count || 0,
        inventoryText: (stats as any)[4]?.count?.count || 0,
        updatedAt: new Date().toISOString(),
      }

      console.log('📊 Statistics updated:', statsSummary)

      return {
        updated: true,
        stats: statsSummary,
        errors,
      }

    } catch (error) {
      const errorMsg = `Failed to update statistics: ${error.message}`
      errors.push(errorMsg)
      console.error('❌', errorMsg)
      return { updated: false, errors }
    }
  }

  /**
   * 清理旧备份
   */
  async cleanupOldBackups(daysToKeep = 30): Promise<{ cleaned: number; errors: string[] }> {
    const errors: string[] = []

    try {
      const cleaned = await backupService.cleanupOldBackups(daysToKeep)

      console.log(`🗑️ Cleaned up ${cleaned} old backups`)

      return {
        cleaned,
        errors,
      }

    } catch (error) {
      const errorMsg = `Failed to cleanup old backups: ${error.message}`
      errors.push(errorMsg)
      console.error('❌', errorMsg)
      return { cleaned: 0, errors }
    }
  }

  /**
   * 检查数据库健康状况
   */
  async checkDatabaseHealth(): Promise<{
    healthy: boolean
    issues: string[]
    recommendations: string[]
  }> {
    const issues: string[] = []
    const recommendations: string[] = []

    try {
      // 检查外键完整性
      const foreignKeyCheck = await db.execute('PRAGMA foreign_key_check')
      if ((foreignKeyCheck as any).length > 0) {
        issues.push('Foreign key constraints violated')
        recommendations.push('Run database integrity check')
      }

      // 检查表完整性
      const tables = ['products', 'orders', 'deliveries', 'inventory_text']
      for (const table of tables) {
        try {
          await db.execute(`SELECT COUNT(*) FROM ${table}`)
        } catch (error) {
          issues.push(`Table ${table} is corrupted or missing`)
          recommendations.push(`Recreate or repair table ${table}`)
        }
      }

      // 检查索引
      const indexCheck = await db.execute('PRAGMA index_list(products)')
      if ((indexCheck as any).length === 0) {
        issues.push('Missing indexes on critical tables')
        recommendations.push('Create missing indexes for performance')
      }

      // 检查数据库大小
      const pageCount = await db.execute('PRAGMA page_count')
      const pageSize = await db.execute('PRAGMA page_size')
      const dbSize = (pageCount as any)[0]?.page_count * (pageSize as any)[0]?.page_size || 0
      const dbSizeMB = dbSize / (1024 * 1024)

      if (dbSizeMB > 1000) { // 大于1GB
        recommendations.push('Consider archiving old data to reduce database size')
      }

      console.log(`🏥 Database health check completed. Issues: ${issues.length}, Recommendations: ${recommendations.length}`)

      return {
        healthy: issues.length === 0,
        issues,
        recommendations,
      }

    } catch (error) {
      issues.push(`Health check failed: ${error.message}`)
      recommendations.push('Review database configuration and permissions')
      return { healthy: false, issues, recommendations }
    }
  }

  /**
   * 生成维护报告
   */
  async generateMaintenanceReport(): Promise<{
    timestamp: string
    healthCheck: any
    statistics: any
    recommendations: string[]
  }> {
    const [healthCheck, statistics] = await Promise.all([
      this.checkDatabaseHealth(),
      this.updateStatistics(),
    ])

    const report = {
      timestamp: new Date().toISOString(),
      healthCheck,
      statistics: statistics.stats,
      recommendations: [...healthCheck.recommendations],
    }

    // 保存维护报告
    await auditService.logAuditEvent({
      userEmail: 'system@autoship.com',
      action: 'maintenance_report',
      resourceType: 'system',
      newValues: report,
      success: true,
    })

    return report
  }

  /**
   * 计划任务调度器
   */
  async scheduleMaintenanceTasks() {
    console.log('⏰ Starting maintenance task scheduler...')

    // 每日任务
    setInterval(async () => {
      console.log('📅 Running daily maintenance tasks...')
      await this.cleanupExpiredOrders()
      await this.cleanupExpiredInventory()
    }, 24 * 60 * 60 * 1000) // 每24小时

    // 每周任务
    setInterval(async () => {
      console.log('📅 Running weekly maintenance tasks...')
      await this.cleanupOldPaymentCallbacks(7)
      await this.cleanupInvalidDownloads()
    }, 7 * 24 * 60 * 60 * 1000) // 每7天

    // 每月任务
    setInterval(async () => {
      console.log('📅 Running monthly maintenance tasks...')
      await this.runAllMaintenanceTasks()
      await this.generateMaintenanceReport()
    }, 30 * 24 * 60 * 60 * 1000) // 每30天

    console.log('✅ Maintenance task scheduler started')
  }
}

// 创建维护服务实例
export const maintenanceService = new MaintenanceService()

// 默认导出
export default maintenanceService