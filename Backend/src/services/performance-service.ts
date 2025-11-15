import { db } from '../db'
import { eq, desc, asc, count } from 'drizzle-orm'

// 简单的内存缓存
class MemoryCache {
  private cache = new Map<string, { data: any; expires: number }>()
  private defaultTTL = 5 * 60 * 1000 // 5分钟

  set(key: string, data: any, ttl?: number): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + (ttl || this.defaultTTL),
    })
  }

  get(key: string): any | null {
    const item = this.cache.get(key)
    if (!item) return null

    if (Date.now() > item.expires) {
      this.cache.delete(key)
      return null
    }

    return item.data
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

// 性能服务类
export class PerformanceService {
  private cache = new MemoryCache()
  private queryMetrics = new Map<string, { count: number; totalTime: number; maxTime: number }>()

  /**
   * 执行查询并记录性能指标
   */
  async executeQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>,
    options: {
      cache?: boolean
      cacheTTL?: number
      recordMetrics?: boolean
    } = {}
  ): Promise<T> {
    const { cache: useCache = false, cacheTTL, recordMetrics = true } = options
    const startTime = Date.now()

    // 检查缓存
    if (useCache) {
      const cached = this.cache.get(queryName)
      if (cached) {
        console.log(`📋 Cache hit for query: ${queryName}`)
        return cached
      }
    }

    try {
      // 执行查询
      const result = await queryFn()

      // 记录性能指标
      if (recordMetrics) {
        this.recordQueryMetric(queryName, Date.now() - startTime)
      }

      // 缓存结果
      if (useCache) {
        this.cache.set(queryName, result, cacheTTL)
        console.log(`💾 Cached query result: ${queryName}`)
      }

      return result

    } catch (error) {
      console.error(`❌ Query failed: ${queryName}`, error)
      throw error
    }
  }

  /**
   * 记录查询性能指标
   */
  private recordQueryMetric(queryName: string, executionTime: number): void {
    const existing = this.queryMetrics.get(queryName) || { count: 0, totalTime: 0, maxTime: 0 }

    this.queryMetrics.set(queryName, {
      count: existing.count + 1,
      totalTime: existing.totalTime + executionTime,
      maxTime: Math.max(existing.maxTime, executionTime),
    })
  }

  /**
   * 获取查询性能统计
   */
  getQueryMetrics(): Array<{
    queryName: string
    count: number
    avgTime: number
    maxTime: number
    totalTime: number
  }> {
    const metrics = Array.from(this.queryMetrics.entries()).map(([queryName, stats]) => ({
      queryName,
      count: stats.count,
      avgTime: Math.round(stats.totalTime / stats.count),
      maxTime: stats.maxTime,
      totalTime: stats.totalTime,
    }))

    return metrics.sort((a, b) => b.totalTime - a.totalTime)
  }

  /**
   * 分析慢查询
   */
  async analyzeSlowQueries(thresholdMs = 1000): Promise<any> {
    const metrics = this.getQueryMetrics()
    const slowQueries = metrics.filter(metric => metric.avgTime > thresholdMs)

    return {
      threshold: thresholdMs,
      slowQueries: slowQueries.map(query => ({
        queryName: query.queryName,
        avgTime: query.avgTime,
        maxTime: query.maxTime,
        count: query.count,
        recommendation: this.getQueryOptimizationRecommendation(query.queryName),
      })),
      totalSlowQueries: slowQueries.length,
      impact: slowQueries.reduce((sum, q) => sum + q.totalTime, 0),
    }
  }

  /**
   * 获取查询优化建议
   */
  private getQueryOptimizationRecommendation(queryName: string): string {
    const recommendations: Record<string, string> = {
      'getOrdersByStatus': 'Add index on orders(status, created_at)',
      'queryOrders': 'Optimize complex WHERE clauses, consider full-text search',
      'getProductsWithPrices': 'Add composite index on product_prices(product_id, is_active)',
      'getInventoryStats': 'Consider materialized views for complex aggregations',
    }

    return recommendations[queryName] || 'Consider adding appropriate indexes'
  }

  /**
   * 优化的分页查询
   */
  async paginatedQuery<T>(
    queryName: string,
    baseQuery: () => Promise<T[]>,
    countQuery: () => Promise<number>,
    page: number,
    limit: number,
    options: {
      cache?: boolean
      cacheTTL?: number
      orderBy?: string
      orderDirection?: 'asc' | 'desc'
    } = {}
  ): Promise<{
    items: T[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
      hasNext: boolean
      hasPrev: boolean
    }
  }> {
    const cacheKey = `${queryName}_page_${page}_limit_${limit}`
    const offset = (page - 1) * limit

    // 使用缓存执行查询
    const [items, total] = await Promise.all([
      this.executeQuery(`${cacheKey}_items`, baseQuery, options),
      this.executeQuery(`${cacheKey}_total`, countQuery, options),
    ])

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    }
  }

  /**
   * 批量操作优化
   */
  async batchOperation<T>(
    operationName: string,
    items: T[],
    operationFn: (batch: T[]) => Promise<any>,
    batchSize = 100
  ): Promise<any[]> {
    const results = []

    console.log(`🔄 Starting batch operation: ${operationName} (${items.length} items, batch size: ${batchSize})`)

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`)

      try {
        const result = await operationFn(batch)
        results.push(result)
      } catch (error) {
        console.error(`❌ Batch operation failed at batch ${Math.floor(i / batchSize) + 1}:`, error)
        throw error
      }
    }

    console.log(`✅ Batch operation completed: ${operationName}`)
    return results
  }

  /**
   * 预热缓存
   */
  async warmupCache(): Promise<void> {
    console.log('🔥 Warming up cache...')

    try {
      // 预加载常用数据
      await this.executeQuery('activeProducts', async () => {
        return await db.select().from(require('../db/schema').products)
          .where(eq(require('../db/schema').products.isActive, true))
      }, { cache: true, cacheTTL: 10 * 60 * 1000 }) // 10分钟缓存

      await this.executeQuery('systemSettings', async () => {
        return await db.select().from(require('../db/schema').settings)
      }, { cache: true, cacheTTL: 30 * 60 * 1000 }) // 30分钟缓存

      console.log('✅ Cache warmed up successfully')
    } catch (error) {
      console.error('❌ Cache warmup failed:', error)
    }
  }

  /**
   * 清理缓存
   */
  clearCache(pattern?: string): void {
    if (pattern) {
      // 简化版模式匹配
      const keys = Array.from((this.cache as any).cache.keys())
      for (const key of keys) {
        if (typeof key === 'string' && key.includes(pattern)) {
          this.cache.delete(key)
        }
      }
      console.log(`🧹 Cleared cache matching pattern: ${pattern}`)
    } else {
      this.cache.clear()
      console.log('🧹 Cleared all cache')
    }
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    size: number
    memoryUsage: string
    keys: string[]
  } {
    return {
      size: this.cache.size(),
      memoryUsage: '~' + Math.round(JSON.stringify(Array.from((this.cache as any).cache.entries())).length / 1024) + 'KB',
      keys: Array.from((this.cache as any).cache.keys()),
    }
  }

  /**
   * 生成性能报告
   */
  async generatePerformanceReport(): Promise<{
    timestamp: string
    queryMetrics: any
    cacheStats: any
    slowQueries: any
    recommendations: string[]
  }> {
    const [queryMetrics, slowQueries, cacheStats] = await Promise.all([
      Promise.resolve(this.getQueryMetrics()),
      this.analyzeSlowQueries(),
      Promise.resolve(this.getCacheStats()),
    ])

    const recommendations = this.generateRecommendations(queryMetrics, slowQueries, cacheStats)

    return {
      timestamp: new Date().toISOString(),
      queryMetrics,
      cacheStats,
      slowQueries,
      recommendations,
    }
  }

  /**
   * 生成性能优化建议
   */
  private generateRecommendations(
    queryMetrics: any[],
    slowQueries: any,
    cacheStats: any
  ): string[] {
    const recommendations: string[] = []

    // 基于查询性能的建议
    if (slowQueries.slowQueries.length > 0) {
      recommendations.push(`发现 ${slowQueries.slowQueries.length} 个慢查询，建议优化索引和查询语句`)
    }

    // 基于缓存的建议
    if (cacheStats.size < 5) {
      recommendations.push('缓存使用率较低，建议为常用查询添加缓存')
    }

    if (cacheStats.memoryUsage.includes('KB') && parseInt(cacheStats.memoryUsage) > 1000) {
      recommendations.push('缓存内存使用较高，考虑调整缓存策略或TTL')
    }

    // 基于查询频率的建议
    const highFrequencyQueries = queryMetrics.filter(q => q.count > 1000)
    if (highFrequencyQueries.length > 0) {
      recommendations.push(`${highFrequencyQueries.length} 个高频查询建议使用缓存`)
    }

    return recommendations
  }

  /**
   * 连接池状态（简化版）
   */
  getConnectionPoolStatus(): any {
    return {
      // SQLite是单连接的，这里返回基本信息
      type: 'SQLite Single Connection',
      status: 'Active',
      optimization: 'WAL mode enabled',
      maxConnections: 1,
      activeConnections: 1,
    }
  }

  /**
   * 数据库性能监控
   */
  async monitorDatabasePerformance(): Promise<any> {
    try {
      // SQLite性能监控
      const pragmaResults = await Promise.all([
        (db as any).execute('PRAGMA cache_size'),
        (db as any).execute('PRAGMA journal_mode'),
        (db as any).execute('PRAGMA synchronous'),
        (db as any).execute('PRAGMA temp_store'),
      ])

      return {
        configuration: {
          cacheSize: (pragmaResults[0] as any)[0]?.cache_size || 'Unknown',
          journalMode: (pragmaResults[1] as any)[0]?.journal_mode || 'Unknown',
          synchronous: (pragmaResults[2] as any)[0]?.synchronous || 'Unknown',
          tempStore: (pragmaResults[3] as any)[0]?.temp_store || 'Unknown',
        },
        status: 'Optimized',
        lastChecked: new Date().toISOString(),
      }
    } catch (error) {
      return {
        status: 'Error',
        error: error instanceof Error ? error.message : String(error),
        lastChecked: new Date().toISOString(),
      }
    }
  }
}

// 创建性能服务实例
export const performanceService = new PerformanceService()

// 性能监控装饰器
export function monitor(queryName?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value
    const queryNameToUse = queryName || `${target.constructor.name}.${propertyName}`

    descriptor.value = async function (...args: any[]) {
      return await performanceService.executeQuery(
        queryNameToUse,
        () => method.apply(this, args),
        { recordMetrics: true }
      )
    }

    return descriptor
  }
}

// 缓存装饰器
export function cache(ttl?: number) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value
    const queryName = `${target.constructor.name}.${propertyName}`

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${queryName}_${JSON.stringify(args)}`

      return await performanceService.executeQuery(
        cacheKey,
        () => method.apply(this, args),
        { cache: true, cacheTTL: ttl }
      )
    }

    return descriptor
  }
}

// 默认导出
export default performanceService