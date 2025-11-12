import { Context, Next } from 'hono'

interface ResponseFormatOptions {
  includeTimestamp?: boolean
  includeRequestId?: boolean
  includeVersion?: boolean
  version?: string
}

/**
 * 统一响应格式中间件
 * 确保所有API响应都遵循统一的格式
 */
export function responseFormatter(options: ResponseFormatOptions = {}) {
  const {
    includeTimestamp = true,
    includeRequestId = true,
    includeVersion = true,
    version = '1.0.0'
  } = options

  return async (c: Context, next: Next) => {
    // 生成请求ID
    const requestId = c.get('requestId') || generateRequestId()
    c.set('requestId', requestId)

    // 存储原始响应方法
    const originalSend = c.text.bind(c)
    const originalJson = c.json.bind(c)

    // 重写c.text以支持统一格式
    c.text = (body: string, status: number = 200) => {
      if (status >= 400) {
        // 错误响应使用统一格式
        return originalJson({
          success: false,
          error: body,
          code: 'TEXT_ERROR',
          timestamp: includeTimestamp ? new Date().toISOString() : undefined,
          requestId: includeRequestId ? requestId : undefined,
          version: includeVersion ? version : undefined
        }, status)
      }
      return originalSend(body, status)
    }

    // 重写c.json以支持统一格式
    c.json = (data: any, status: number = 200) => {
      if (status >= 400) {
        // 错误响应已经是统一格式，检查是否需要补充字段
        if (typeof data === 'object' && data !== null) {
          if (includeTimestamp && !data.timestamp) {
            data.timestamp = new Date().toISOString()
          }
          if (includeRequestId && !data.requestId) {
            data.requestId = requestId
          }
          if (includeVersion && !data.version) {
            data.version = version
          }
        }
        return originalJson(data, status)
      } else {
        // 成功响应使用统一格式
        const formattedData = {
          success: true,
          data,
          timestamp: includeTimestamp ? new Date().toISOString() : undefined,
          requestId: includeRequestId ? requestId : undefined,
          version: includeVersion ? version : undefined
        }

        // 移除undefined字段
        const cleanedData = removeUndefinedFields(formattedData)
        return originalJson(cleanedData, status)
      }
    }

    await next()
  }
}

/**
 * 生成请求ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * 移除undefined字段
 */
function removeUndefinedFields(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedFields)
  } else if (obj !== null && typeof obj === 'object') {
    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        result[key] = removeUndefinedFields(value)
      }
    }
    return result
  }
  return obj
}

export default responseFormatter

/**
 * Webhook响应格式化器
 * 专门用于Webhook端点的响应格式化
 */
export function webhookResponseFormatter() {
  return async (c: Context, next: Next) => {
    // Webhook路由可能需要特殊处理
    // 例如支付宝需要返回'success'字符串而不是JSON
    if (c.req.path().includes('/webhooks/')) {
      await next()
      return
    }

    // 其他API使用标准格式化
    await responseFormatter()(c, next)
  }
}

/**
 * API响应格式化器
 * 专门用于API端点的响应格式化
 */
export function apiResponseFormatter() {
  return responseFormatter({
    includeTimestamp: true,
    includeRequestId: true,
    includeVersion: true,
    version: '1.0.0'
  })
}

/**
 * 管理员API响应格式化器
 * 专门用于管理员API的响应格式化
 */
export function adminResponseFormatter() {
  return responseFormatter({
    includeTimestamp: true,
    includeRequestId: true,
    includeVersion: true,
    version: '1.0.0'
  })
}
