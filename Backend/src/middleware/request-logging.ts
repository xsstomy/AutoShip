import { Context, Next } from 'hono'
import { db, schema } from '../db'
import { auditService } from '../services/audit-service'
import { securityService } from '../services/security-service'
import { sql } from 'drizzle-orm'

interface RequestLoggingOptions {
  excludePaths?: string[]
  excludeMethods?: string[]
  includeRequestBody?: boolean
  includeResponseBody?: boolean
  maxBodySize?: number
  sanitizeHeaders?: string[]
}

/**
 * 请求日志中间件
 * 记录所有API请求和响应的详细信息
 */
export function requestLogging(options: RequestLoggingOptions = {}) {
  const {
    excludePaths = ['/health', '/metrics', '/favicon.ico'],
    excludeMethods = ['OPTIONS'],
    includeRequestBody = false,
    includeResponseBody = false,
    maxBodySize = 1024, // 1KB
    sanitizeHeaders = ['authorization', 'x-admin-key', 'admin-key', 'cookie', 'set-cookie']
  } = options

  return async (c: Context, next: Next) => {
    const startTime = Date.now()
    const path = c.req.path
    const method = c.req.method

    // 检查是否应该跳过日志记录
    if (shouldSkipLogging(path, method, excludePaths, excludeMethods)) {
      await next()
      return
    }

    const requestId = securityService.generateUUID()
    const clientIP = getClientIP(c)
    const userAgent = c.req.header('user-agent')

    // 添加请求ID到响应头（用于跟踪）
    c.set('X-Request-ID', requestId)

    let requestBody: string | undefined
    let responseBody: string | undefined
    let error: Error | undefined

    try {
      // 记录请求体（如果需要）
      if (includeRequestBody) {
        const contentType = c.req.header('content-type')
        if (contentType?.includes('application/json') || contentType?.includes('application/x-www-form-urlencoded')) {
          try {
            requestBody = await c.req.text()
            // 限制请求体大小
            if (requestBody.length > maxBodySize) {
              requestBody = requestBody.substring(0, maxBodySize) + '...[truncated]'
            }
          } catch (error) {
            requestBody = '[unreadable]'
          }
        }
      }

      // 继续处理请求
      await next()

      // 记录响应体（如果需要）
      if (includeResponseBody) {
        const response = c.res as any
        if (response.body && typeof response.body === 'string') {
          responseBody = response.body.length > maxBodySize
            ? response.body.substring(0, maxBodySize) + '...[truncated]'
            : response.body
        }
      }

    } catch (err) {
      error = err as Error
      throw err // 重新抛出错误让其他中间件处理
    } finally {
      const endTime = Date.now()
      const duration = endTime - startTime
      const responseStatus = c.res.status

      // 脱敏头部信息
      const sanitizedHeaders = sanitizeRequestHeaders(c.req.header(), sanitizeHeaders)

      // 记录到audit_logs表
      await logRequestToAudit({
        requestId,
        method,
        path,
        query: c.req.query(),
        headers: sanitizedHeaders,
        requestBody,
        responseBody,
        responseStatus,
        duration,
        clientIP,
        userAgent,
        error: error?.message,
        adminAuth: c.get('adminAuth'),
        webhookValidated: c.get('webhookValidated')
      })

      // 同时记录到专门的请求日志表（如果需要更详细的分析）
      await logRequestToDetails({
        requestId,
        method,
        path,
        query: c.req.query(),
        headers: c.req.header(),
        requestBody,
        responseBody,
        responseStatus,
        duration,
        clientIP,
        userAgent,
        timestamp: new Date(startTime).toISOString()
      })

      // 设置响应头
      c.set('X-Response-Time', `${duration}ms`)
    }
  }
}

/**
 * 安全请求日志（用于安全监控）
 */
export function securityRequestLogging() {
  return requestLogging({
    excludePaths: ['/health', '/metrics'],
    includeRequestBody: true,
    maxBodySize: 2048,
    sanitizeHeaders: ['authorization', 'x-admin-key', 'admin-key', 'cookie', 'set-cookie']
  })
}

/**
 * 管理员API请求日志
 */
export function adminRequestLogging() {
  return requestLogging({
    excludePaths: [],
    excludeMethods: ['OPTIONS'],
    includeRequestBody: true,
    includeResponseBody: true,
    maxBodySize: 4096,
    sanitizeHeaders: ['authorization', 'x-admin-key', 'admin-key']
  })
}

/**
 * Webhook请求日志
 */
export function webhookRequestLogging() {
  return requestLogging({
    excludePaths: [],
    excludeMethods: [],
    includeRequestBody: true,
    includeResponseBody: false, // 通常不需要记录webhook响应
    maxBodySize: 8192, // Webhook可能更大
    sanitizeHeaders: [] // Webhook通常不需要脱敏头部
  })
}

/**
 * 检查是否应该跳过日志记录
 */
function shouldSkipLogging(
  path: string,
  method: string,
  excludePaths: string[],
  excludeMethods: string[]
): boolean {
  // 检查方法
  if (excludeMethods.includes(method)) {
    return true
  }

  // 检查路径
  return excludePaths.some(excludePath => {
    if (excludePath.includes('*')) {
      const regex = new RegExp(excludePath.replace(/\*/g, '.*'))
      return regex.test(path)
    }
    return path === excludePath
  })
}

/**
 * 脱敏请求头部
 */
function sanitizeRequestHeaders(headers: Record<string, string>, sanitizeList: string[]): Record<string, string> {
  const sanitized: Record<string, string> = {}

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase()
    if (sanitizeList.some(sensitive => lowerKey.includes(sensitive.toLowerCase()))) {
      sanitized[key] = '[REDACTED]'
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * 记录请求到审计表
 */
async function logRequestToAudit(data: {
  requestId: string
  method: string
  path: string
  query: Record<string, string>
  headers: Record<string, string>
  requestBody?: string
  responseBody?: string
  responseStatus: number
  duration: number
  clientIP: string
  userAgent?: string
  error?: string
  adminAuth?: any
  webhookValidated?: boolean
}) {
  try {
    // 确定事件类型和严重程度
    const { eventType, severity } = categorizeRequest(data)

    await db.insert(schema.auditLogs).values({
      eventType,
      eventCategory: determineEventCategory(data),
      severity,
      userId: data.adminAuth?.associatedId,
      userEmail: data.adminAuth?.associatedId,
      ipAddress: data.clientIP,
      userAgent: data.userAgent,
      requestPath: data.path,
      requestMethod: data.method,
      resourceType: 'api_request',
      resourceId: data.requestId,
      action: `${data.method} ${data.path}`,
      result: data.responseStatus < 400 ? 'success' : 'failure',
      details: JSON.stringify({
        requestId: data.requestId,
        query: data.query,
        responseStatus: data.responseStatus,
        duration: data.duration,
        requestBodySize: data.requestBody?.length || 0,
        responseBodySize: data.responseBody?.length || 0,
        hasAdminAuth: !!data.adminAuth,
        webhookValidated: data.webhookValidated,
        error: data.error
      }),
      metadata: JSON.stringify({
        headers: data.headers,
        requestBody: data.requestBody ? truncateBody(data.requestBody) : undefined,
        responseBody: data.responseBody ? truncateBody(data.responseBody) : undefined,
        adminKeyId: data.adminAuth?.keyId,
        timestamp: new Date().toISOString()
      }),
      riskScore: calculateRiskScore(data),
      traceId: data.requestId,
      tags: generateRequestTags(data)
    })
  } catch (error) {
    console.error('Failed to log request to audit:', error)
    // 不应该阻断主流程
  }
}

/**
 * 记录请求到详细表（可以创建专门的请求日志表）
 */
async function logRequestToDetails(data: {
  requestId: string
  method: string
  path: string
  query: Record<string, string>
  headers: Record<string, string>
  requestBody?: string
  responseBody?: string
  responseStatus: number
  duration: number
  clientIP: string
  userAgent?: string
  timestamp: string
}) {
  try {
    // 这里可以创建专门的requests_logs表
    // 目前使用简化方式记录关键信息
    await auditService.logAuditEvent({
      action: 'api_request_detailed',
      resourceType: 'api_request',
      resourceId: data.requestId,
      success: data.responseStatus < 400,
      ipAddress: data.clientIP,
      userAgent: data.userAgent,
      metadata: {
        requestId: data.requestId,
        method: data.method,
        path: data.path,
        responseStatus: data.responseStatus,
        duration: data.duration,
        timestamp: data.timestamp
      }
    })
  } catch (error) {
    console.error('Failed to log request details:', error)
  }
}

/**
 * 分类请求类型
 */
function categorizeRequest(data: {
  method: string
  path: string
  responseStatus: number
  adminAuth?: any
  webhookValidated?: boolean
  error?: string
}): { eventType: string; severity: string } {
  const { method, path, responseStatus, adminAuth, webhookValidated, error } = data

  // 错误请求
  if (error || responseStatus >= 500) {
    return { eventType: 'security', severity: 'error' }
  }

  // 管理员操作
  if (adminAuth || path.startsWith('/admin')) {
    return { eventType: 'admin', severity: responseStatus < 400 ? 'info' : 'warning' }
  }

  // Webhook请求
  if (path.includes('/webhook') || path.includes('/callback')) {
    return {
      eventType: 'webhook',
      severity: webhookValidated ? 'info' : 'warning'
    }
  }

  // 认证相关请求
  if (path.includes('/auth') || path.includes('/login')) {
    return { eventType: 'security', severity: 'info' }
  }

  // 支付相关请求
  if (path.includes('/payment') || path.includes('/checkout')) {
    return { eventType: 'payment', severity: 'info' }
  }

  // 下载相关请求
  if (path.includes('/download')) {
    return { eventType: 'download', severity: 'info' }
  }

  // 默认分类
  return { eventType: 'security', severity: 'info' }
}

/**
 * 确定事件类别
 */
function determineEventCategory(data: {
  method: string
  path: string
  responseStatus: number
  adminAuth?: any
}): string {
  const { method, path, responseStatus, adminAuth } = data

  if (responseStatus >= 400) return 'error'
  if (method === 'GET' && path.includes('/admin')) return 'access'
  if (method === 'POST' || method === 'PUT' || method === 'DELETE') return 'auth'
  return 'access'
}

/**
 * 计算风险评分
 */
function calculateRiskScore(data: {
  method: string
  path: string
  responseStatus: number
  clientIP: string
  adminAuth?: any
  error?: string
}): number {
  let riskScore = 0

  // 基于响应状态
  if (data.responseStatus >= 500) riskScore += 30
  if (data.responseStatus >= 400) riskScore += 20

  // 基于方法
  if (data.method === 'DELETE') riskScore += 15
  if (data.method === 'PUT' || data.method === 'POST') riskScore += 10

  // 基于路径
  if (data.path.includes('/admin')) riskScore += 5
  if (data.path.includes('/auth')) riskScore += 8

  // 基于IP（如果是私有IP，降低风险）
  if (isPrivateIP(data.clientIP)) riskScore -= 5

  // 基于错误
  if (data.error) riskScore += 25

  // 管理员认证降低风险
  if (data.adminAuth) riskScore -= 10

  return Math.max(0, Math.min(100, riskScore))
}

/**
 * 生成请求标签
 */
function generateRequestTags(data: {
  method: string
  path: string
  responseStatus: number
  adminAuth?: any
  webhookValidated?: boolean
}): string {
  const tags = []

  tags.push(data.method.toLowerCase())
  tags.push(data.responseStatus.toString())

  if (data.adminAuth) tags.push('admin')
  if (data.webhookValidated) tags.push('webhook')
  if (data.path.includes('/admin')) tags.push('admin-panel')
  if (data.path.includes('/api')) tags.push('api')

  return tags.join(',')
}

/**
 * 截断请求体
 */
function truncateBody(body: string, maxSize = 500): string {
  return body.length > maxSize ? body.substring(0, maxSize) + '...[truncated]' : body
}

/**
 * 检查是否为私有IP
 */
function isPrivateIP(ip: string): boolean {
  if (!ip || ip === 'unknown') return false

  // IPv4私有地址范围
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./, // 链路本地地址
    /^::1$/, // IPv6本地地址
    /^fc00:/, // IPv6私有地址
    /^fe80:/ // IPv6链路本地地址
  ]

  return privateRanges.some(range => range.test(ip))
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

export default requestLogging