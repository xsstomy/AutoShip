import { Context, Next } from 'hono'
import { db, schema } from '../db'
import { eq, and, lt, gt } from 'drizzle-orm'
import { auditService } from '../services/audit-service'
import { sql } from 'drizzle-orm'

interface RateLimitOptions {
  windowMs?: number // 时间窗口（毫秒）
  maxRequests?: number // 最大请求次数
  keyGenerator?: (c: Context) => string // 自定义键生成器
  skipSuccessfulRequests?: boolean // 是否跳过成功请求的计数
  skipFailedRequests?: boolean // 是否跳过失败请求的计数
  message?: string // 自定义限制消息
}

/**
 * API限流中间件
 */
export function rateLimit(options: RateLimitOptions = {}) {
  const {
    windowMs = 60 * 1000, // 默认1分钟
    maxRequests = 100, // 默认100次请求
    keyGenerator = defaultKeyGenerator,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    message = 'Too many requests, please try again later'
  } = options

  return async (c: Context, next: Next) => {
    try {
      const key = keyGenerator(c)
      const now = Date.now()
      const windowSizeSeconds = Math.ceil(windowMs / 1000)

      // 获取或创建限流记录
      const rateLimitRecord = await getRateLimitRecord(key, windowSizeSeconds, maxRequests)

      // 检查是否被封禁
      if (rateLimitRecord?.blockedUntil && new Date(rateLimitRecord.blockedUntil) > new Date()) {
        const unblockTime = new Date(rateLimitRecord.blockedUntil).toISOString()

        await auditService.logAuditEvent({
          action: 'rate_limit_blocked',
          resourceType: 'api_access',
          resourceId: key,
          success: false,
          ipAddress: getClientIP(c),
          userAgent: c.req.header('user-agent'),
          errorMessage: 'Client is currently rate limited',
          metadata: {
            path: c.req.path,
            method: c.req.method,
            unblockTime,
            violationCount: rateLimitRecord.violationCount
          }
        })

        c.set('X-RateLimit-Limit', maxRequests.toString())
        c.set('X-RateLimit-Remaining', '0')
        c.set('X-RateLimit-Reset', new Date(rateLimitRecord.blockedUntil).getTime().toString())

        c.status(429)
        return c.json({
          success: false,
          error: message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((new Date(rateLimitRecord.blockedUntil).getTime() - now) / 1000)
        })
      }

      // 检查是否超过限制
      if (rateLimitRecord && (rateLimitRecord.currentRequests ?? 0) >= maxRequests) {
        // 增加违规计数
        await incrementViolationCount(key)

        await auditService.logAuditEvent({
          action: 'rate_limit_exceeded',
          resourceType: 'api_access',
          resourceId: key,
          success: false,
          ipAddress: getClientIP(c),
          userAgent: c.req.header('user-agent'),
          errorMessage: 'Rate limit exceeded',
          metadata: {
            path: c.req.path,
            method: c.req.method,
            currentRequests: rateLimitRecord.currentRequests ?? 0,
            maxRequests,
            violationCount: (rateLimitRecord.violationCount ?? 0) + 1
          }
        })

        c.set('X-RateLimit-Limit', maxRequests.toString())
        c.set('X-RateLimit-Remaining', '0')
        c.set('X-RateLimit-Reset', (now + windowMs).toString())

        c.status(429)
        return c.json({
          success: false,
          error: message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil(windowMs / 1000)
        })
      }

      // 记录请求
      await incrementRequestCount(key)

      // 继续处理请求
      await next()

      // 根据响应状态决定是否减少计数
      const responseStatus = c.res.status
      const shouldCount = (!skipSuccessfulRequests && responseStatus < 400) ||
                         (!skipFailedRequests && responseStatus >= 400)

      if (!shouldCount) {
        // 如果不计数，则减少刚才增加的计数
        await decrementRequestCount(key)
      }

      // 设置响应头
      const updatedRecord = await getRateLimitRecord(key, windowSizeSeconds, maxRequests)
      const remaining = updatedRecord ? Math.max(0, maxRequests - (updatedRecord.currentRequests ?? 0)) : maxRequests - 1

      c.set('X-RateLimit-Limit', maxRequests.toString())
      c.set('X-RateLimit-Remaining', remaining.toString())
      c.set('X-RateLimit-Reset', (now + windowMs).toString())

    } catch (error) {
      console.error('Rate limiting error:', error)

      // 发生错误时允许请求通过
      await next()
    }
  }
}

/**
 * IP地址限流
 */
export function rateLimitByIP(options: RateLimitOptions = {}) {
  return rateLimit({
    ...options,
    keyGenerator: (c) => `ip:${getClientIP(c)}`
  })
}

/**
 * 用户限流（需要认证）
 */
export function rateLimitByUser(options: RateLimitOptions = {}) {
  return rateLimit({
    ...options,
    keyGenerator: (c) => {
      const adminAuth = c.get('adminAuth')
      if (adminAuth?.associatedId) {
        return `user:${adminAuth.associatedId}`
      }
      return `ip:${getClientIP(c)}`
    }
  })
}

/**
 * 管理员API限流（更严格的限制）
 */
export function adminRateLimit(options: RateLimitOptions = {}) {
  return rateLimit({
    windowMs: 60 * 1000, // 1分钟
    maxRequests: 30, // 30次请求
    keyGenerator: (c) => {
      const adminAuth = c.get('adminAuth')
      if (adminAuth?.keyId) {
        return `admin:${adminAuth.keyId}`
      }
      return `admin:ip:${getClientIP(c)}`
    },
    ...options
  })
}

/**
 * 默认键生成器
 */
function defaultKeyGenerator(c: Context): string {
  return `global:${getClientIP(c)}`
}

/**
 * 获取限流记录
 */
async function getRateLimitRecord(key: string, windowSize: number, maxRequests: number) {
  try {
    const records = await db.select()
      .from(schema.rateLimits)
      .where(eq(schema.rateLimits.limitKey, key))
      .limit(1)

    if (records.length === 0) {
      // 创建新记录
      await db.insert(schema.rateLimits).values({
        limitKey: key,
        limitType: determineLimitType(key),
        windowSize,
        maxRequests,
        currentRequests: 0,
        violationCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      return null
    }

    const record = records[0]

    // 检查记录是否过期，如果过期则重置
    const recordAge = Date.now() - new Date(record.updatedAt ?? new Date()).getTime()
    if (recordAge > windowSize * 1000) {
      await db.update(schema.rateLimits)
        .set({
          currentRequests: 0,
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.rateLimits.limitKey, key))

      return {
        ...record,
        currentRequests: 0,
        updatedAt: new Date().toISOString()
      }
    }

    return record
  } catch (error) {
    console.error('Error getting rate limit record:', error)
    return null
  }
}

/**
 * 增加请求计数
 */
async function incrementRequestCount(key: string) {
  try {
    await db.update(schema.rateLimits)
      .set({
        currentRequests: sql`${schema.rateLimits.currentRequests} + 1`,
        updatedAt: new Date().toISOString()
      })
      .where(eq(schema.rateLimits.limitKey, key))
  } catch (error) {
    console.error('Error incrementing request count:', error)
  }
}

/**
 * 减少请求计数
 */
async function decrementRequestCount(key: string) {
  try {
    await db.update(schema.rateLimits)
      .set({
        currentRequests: sql`CASE WHEN ${schema.rateLimits.currentRequests} > 0 THEN ${schema.rateLimits.currentRequests} - 1 ELSE 0 END`,
        updatedAt: new Date().toISOString()
      })
      .where(eq(schema.rateLimits.limitKey, key))
  } catch (error) {
    console.error('Error decrementing request count:', error)
  }
}

/**
 * 增加违规计数
 */
async function incrementViolationCount(key: string) {
  try {
    const record = await getRateLimitRecord(key, 60, 100)
    if (record) {
      const newViolationCount = (record.violationCount ?? 0) + 1
      const blockedUntil = newViolationCount >= 3 ?
        new Date(Date.now() + (Math.pow(2, newViolationCount) * 60 * 1000)).toISOString() : // 指数退避
        null

      await db.update(schema.rateLimits)
        .set({
          violationCount: newViolationCount,
          blockedUntil,
          lastViolationAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.rateLimits.limitKey, key))
    }
  } catch (error) {
    console.error('Error incrementing violation count:', error)
  }
}

/**
 * 确定限流类型
 */
function determineLimitType(key: string): string {
  if (key.startsWith('ip:')) return 'ip'
  if (key.startsWith('user:')) return 'user'
  if (key.startsWith('admin:')) return 'admin'
  return 'global'
}

/**
 * 获取客户端IP地址
 */
function getClientIP(c: Context): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
         c.req.header('x-real-ip') ||
         c.req.header('cf-connecting-ip') ||
         'unknown'
}

/**
 * 清理过期的限流记录
 */
export async function cleanupExpiredRateLimits() {
  try {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24小时前

    const result = await db.delete(schema.rateLimits)
      .where(and(
        lt(schema.rateLimits.updatedAt, cutoffTime.toISOString()),
        eq(schema.rateLimits.violationCount, 0) // 只清理没有违规的记录
      ))

    console.log(`Cleaned up ${result.changes} expired rate limit records`)
    return result.changes
  } catch (error) {
    console.error('Failed to cleanup expired rate limits:', error)
    return 0
  }
}

/**
 * 获取限流统计
 */
export async function getRateLimitStats() {
  try {
    const stats = await db.select({
      totalRecords: sql`COUNT(*)`,
      activeBlocks: sql`COUNT(CASE WHEN ${schema.rateLimits.blockedUntil} > datetime('now') THEN 1 END)`,
      totalViolations: sql`SUM(${schema.rateLimits.violationCount})`,
      avgRequests: sql`AVG(${schema.rateLimits.currentRequests})`
    })
      .from(schema.rateLimits)

    return {
      totalKeys: stats[0].totalRecords,
      activeBlocks: stats[0].activeBlocks,
      totalViolations: stats[0].totalViolations || 0,
      averageRequests: stats[0].avgRequests || 0
    }
  } catch (error) {
    console.error('Error getting rate limit stats:', error)
    return null
  }
}

export default rateLimit