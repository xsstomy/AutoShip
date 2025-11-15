import { Context, Next } from 'hono'
import { auditService } from '../services/audit-service'

interface SuspiciousPatternOptions {
  maxRequestsPerMinute?: number // 每分钟最大请求数
  maxFailedRequests?: number // 最大失败请求数
  suspiciousHeaders?: string[] // 可疑头部列表
  blockDuration?: number // 封禁时间（毫秒）
}

/**
 * 可疑模式检测中间件
 * 检测可疑的Webhook模式，防止恶意攻击
 */
export function suspiciousPatternDetection(options: SuspiciousPatternOptions = {}) {
  const {
    maxRequestsPerMinute = 10,
    maxFailedRequests = 5,
    suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'user-agent'],
    blockDuration = 5 * 60 * 1000 // 5分钟
  } = options

  // 内存存储可疑IP（生产环境建议使用Redis）
  const suspiciousIPs = new Map<string, {
    count: number
    failedCount: number
    blockedUntil?: number
    patterns: string[]
  }>()

  return async (c: Context, next: Next) => {
    const clientIP = getClientIP(c)
    const userAgent = c.req.header('user-agent') || ''
    const path = c.req.path
    const now = Date.now()

    // 获取或创建IP记录
    let ipRecord = suspiciousIPs.get(clientIP)
    if (!ipRecord) {
      ipRecord = {
        count: 0,
        failedCount: 0,
        patterns: []
      }
      suspiciousIPs.set(clientIP, ipRecord)
    }

    // 检查是否被封禁
    if (ipRecord.blockedUntil && ipRecord.blockedUntil > now) {
      const remainingTime = Math.ceil((ipRecord.blockedUntil - now) / 1000)

      await auditService.logAuditEvent({
        action: 'suspicious_blocked',
        resourceType: 'webhook',
        resourceId: clientIP,
        success: false,
        ipAddress: clientIP,
        userAgent,
        errorMessage: `Blocked suspicious IP for ${remainingTime} seconds`,
        metadata: {
          reason: ipRecord.patterns,
          blockDuration: blockDuration
        }
      })

      c.status(429)
      return c.json({
        success: false,
        error: 'IP temporarily blocked due to suspicious activity',
        code: 'SUSPICIOUS_BLOCKED'
      })
    }

    // 执行检查
    const suspiciousPatterns = detectSuspiciousPatterns({
      ip: clientIP,
      userAgent,
      path,
      headers: {
        'user-agent': userAgent,
        'content-type': c.req.header('content-type') || '',
        'x-forwarded-for': c.req.header('x-forwarded-for') || '',
        'x-real-ip': c.req.header('x-real-ip') || '',
        'referer': c.req.header('referer') || '',
        'origin': c.req.header('origin') || ''
      },
      maxRequestsPerMinute,
      maxFailedRequests
    })

    // 更新IP记录
    ipRecord.count++
    if (suspiciousPatterns.length > 0) {
      ipRecord.failedCount++
      ipRecord.patterns.push(...suspiciousPatterns)

      // 检查是否达到封禁阈值
      if (ipRecord.failedCount >= maxFailedRequests) {
        ipRecord.blockedUntil = now + blockDuration

        await auditService.logAuditEvent({
          action: 'suspicious_pattern_blocked',
          resourceType: 'webhook',
          resourceId: clientIP,
          success: false,
          ipAddress: clientIP,
          userAgent,
          errorMessage: `IP blocked for suspicious patterns: ${suspiciousPatterns.join(', ')}`,
          metadata: {
            patterns: suspiciousPatterns,
            violationCount: ipRecord.failedCount,
            blockDuration
          }
        })

        c.status(429)
        return c.json({
          success: false,
          error: 'IP blocked due to suspicious activity',
          code: 'SUSPICIOUS_BLOCKED'
        })
      }
    }

    // 继续处理
    await next()

    // 清理过旧的IP记录（每小时）
    if (ipRecord.count === 0 && (!ipRecord.blockedUntil || ipRecord.blockedUntil <= now)) {
      suspiciousIPs.delete(clientIP)
    }
  }
}

/**
 * 检测可疑模式
 */
function detectSuspiciousPatterns(data: {
  ip: string
  userAgent: string
  path: string
  headers: Record<string, string>
  maxRequestsPerMinute: number
  maxFailedRequests: number
}): string[] {
  const patterns: string[] = []

  // 检查User-Agent
  if (!data.userAgent || data.userAgent.trim() === '') {
    patterns.push('missing_user_agent')
  } else if (data.userAgent.length > 500) {
    patterns.push('oversized_user_agent')
  }

  // 检查是否包含常见攻击字符串
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /union.*select/i,
    /drop\s+table/i,
    /eval\(/i,
    /base64/i
  ]

  const combinedData = `${data.userAgent} ${Object.keys(data.headers).join(' ')}`
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(combinedData)) {
      patterns.push('injection_pattern_detected')
      break
    }
  }

  // 检查Referer
  const referer = data.headers['referer'] || data.headers['referrer']
  if (!referer && data.headers['origin']) {
    patterns.push('missing_referer_but_has_origin')
  }

  // 检查多次失败的请求模式
  // 这里可以添加更复杂的逻辑

  return patterns
}

/**
 * 获取客户端IP
 */
function getClientIP(c: Context): string {
  return (
    c.req.header('x-forwarded-for') ||
    c.req.header('x-real-ip') ||
    c.req.header('cf-connecting-ip') ||
    'unknown'
  )
}

export default suspiciousPatternDetection
