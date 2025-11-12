import { Context, Next } from 'hono'
import { cors } from 'hono/cors'
import { auditService } from '../services/audit-service'

/**
 * CORS安全配置中间件
 * 提供严格的CORS策略以防止跨域攻击
 */
export function corsSecurity(options: {
  allowedOrigins?: string[]
  allowedMethods?: string[]
  allowedHeaders?: string[]
  credentials?: boolean
  maxAge?: number
} = {}) {
  const {
    allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
    allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders = ['Content-Type', 'Authorization', 'X-Admin-Key', 'X-Requested-With'],
    credentials = true,
    maxAge = 86400 // 24小时
  } = options

  return async (c: Context, next: Next) => {
    const origin = c.req.header('origin')
    const method = c.req.method
    const requestHeaders = c.req.header('access-control-request-headers')
    const clientIP = getClientIP(c)
    const userAgent = c.req.header('user-agent')

    try {
      // 处理预检请求
      if (method === 'OPTIONS') {
        // 验证来源
        if (!isOriginAllowed(origin, allowedOrigins)) {
          await auditService.logAuditEvent({
            action: 'cors_preflight_origin_denied',
            resourceType: 'cors',
            success: false,
            ipAddress: clientIP,
            userAgent,
            errorMessage: 'Origin not allowed in CORS preflight',
            metadata: {
              origin,
              method,
              requestHeaders,
              path: c.req.path
            }
          })

          // 对于预检请求，返回400而不是401
          c.status(400)
          return c.json({
            success: false,
            error: 'CORS policy violation',
            code: 'CORS_ORIGIN_NOT_ALLOWED'
          })
        }

        // 验证请求方法
        if (requestHeaders) {
          const requestedMethod = c.req.header('access-control-request-method')
          if (requestedMethod && !allowedMethods.includes(requestedMethod)) {
            await auditService.logAuditEvent({
              action: 'cors_preflight_method_denied',
              resourceType: 'cors',
              success: false,
              ipAddress: clientIP,
              userAgent,
              errorMessage: 'Method not allowed in CORS preflight',
              metadata: {
                origin,
                requestedMethod,
                path: c.req.path
              }
            })

            c.status(400)
            return c.json({
              success: false,
              error: 'Method not allowed',
              code: 'CORS_METHOD_NOT_ALLOWED'
            })
          }
        }

        // 设置CORS头部
        c.header('Access-Control-Allow-Origin', getAllowOriginHeader(origin, allowedOrigins))
        c.header('Access-Control-Allow-Methods', allowedMethods.join(', '))
        c.header('Access-Control-Allow-Headers', allowedHeaders.join(', '))
        c.header('Access-Control-Max-Age', maxAge.toString())
        if (credentials) {
          c.header('Access-Control-Allow-Credentials', 'true')
        }
        c.header('Access-Control-Expose-Headers', 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset')

        c.status(200)
        return c.text('')
      }

      // 处理实际请求
      await next()

      // 为响应添加CORS头部
      if (isOriginAllowed(origin, allowedOrigins)) {
        c.header('Access-Control-Allow-Origin', getAllowOriginHeader(origin, allowedOrigins))
        if (credentials) {
          c.header('Access-Control-Allow-Credentials', 'true')
        }
        c.header('Access-Control-Expose-Headers', 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset')
        c.header('Vary', 'Origin')
      }

      // 记录跨域请求（可选，用于监控）
      if (origin && origin !== c.req.url.split('/')[2]) {
        await auditService.logAuditEvent({
          action: 'cors_cross_origin_request',
          resourceType: 'cors',
          success: true,
          ipAddress: clientIP,
          userAgent,
          metadata: {
            origin,
            method,
            path: c.req.path,
            responseStatus: c.res.status
          }
        })
      }

    } catch (error) {
      console.error('CORS middleware error:', error)
      // 发生CORS错误时不应该暴露系统信息
      c.status(500)
      return c.json({
        success: false,
        error: 'CORS configuration error',
        code: 'CORS_ERROR'
      })
    }
  }
}

/**
 * 管理员API的严格CORS配置
 */
export function adminCorsSecurity() {
  return corsSecurity({
    allowedOrigins: process.env.ADMIN_ALLOWED_ORIGINS?.split(',') || [],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key', 'X-Requested-With'],
    credentials: true,
    maxAge: 7200 // 2小时，更短的缓存时间
  })
}

/**
 * Webhook专用的CORS配置（通常不允许跨域）
 */
export function webhookCorsSecurity() {
  return async (c: Context, next: Next) => {
    // Webhook通常不需要CORS，直接拒绝跨域请求
    const origin = c.req.header('origin')

    if (origin) {
      await auditService.logAuditEvent({
        action: 'webhook_cors_denied',
        resourceType: 'webhook',
        success: false,
        ipAddress: getClientIP(c),
        userAgent: c.req.header('user-agent'),
        errorMessage: 'Webhook endpoint does not allow cross-origin requests',
        metadata: {
          origin,
          path: c.req.path
        }
      })

      c.status(400)
      return c.json({
        success: false,
        error: 'Cross-origin requests not allowed for webhook endpoints',
        code: 'WEBHOOK_CORS_NOT_ALLOWED'
      })
    }

    await next()
  }
}

/**
 * API专用的CORS配置
 */
export function apiCorsSecurity() {
  return corsSecurity({
    allowedOrigins: [
      ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
      ...(process.env.ALLOWED_ORIGINS?.split(',') || []),
      'http://localhost:5173',
      'http://localhost:3000'
    ],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
  })
}

/**
 * 开发环境的宽松CORS配置
 */
export function devCorsSecurity() {
  return corsSecurity({
    allowedOrigins: ['*'], // 开发环境允许所有来源
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['*'],
    credentials: true
  })
}

/**
 * 检查来源是否被允许
 */
function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) return true // 同源请求不需要检查

  if (allowedOrigins.includes('*')) return true

  return allowedOrigins.some(allowed => {
    if (allowed === origin) return true

    // 支持通配符匹配
    if (allowed.includes('*')) {
      const regex = new RegExp(allowed.replace(/\*/g, '.*'))
      return regex.test(origin)
    }

    return false
  })
}

/**
 * 获取Allow-Origin头部值
 */
function getAllowOriginHeader(origin: string | undefined, allowedOrigins: string[]): string {
  if (!origin) return '*'

  if (allowedOrigins.includes('*')) return '*'

  if (isOriginAllowed(origin, allowedOrigins)) {
    return origin
  }

  return allowedOrigins[0] || 'null'
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
 * 内容安全策略中间件
 */
export function contentSecurityPolicy(options: {
  scriptSrc?: string[]
  styleSrc?: string[]
  imgSrc?: string[]
  connectSrc?: string[]
  fontSrc?: string[]
  objectSrc?: string[]
  mediaSrc?: string[]
  frameSrc?: string[]
} = {}) {
  const {
    scriptSrc = ["'self'"],
    styleSrc = ["'self'", "'unsafe-inline'"],
    imgSrc = ["'self'", 'data:', 'https:'],
    connectSrc = ["'self'"],
    fontSrc = ["'self'", 'https:'],
    objectSrc = ["'none'"],
    mediaSrc = ["'self'"],
    frameSrc = ["'none'"]
  } = options

  return async (c: Context, next: Next) => {
    await next()

    // 只对HTML响应设置CSP
    const contentType = c.res.headers.get('content-type')
    if (contentType?.includes('text/html')) {
      const cspDirectives = [
        `default-src 'self'`,
        `script-src ${scriptSrc.join(' ')}`,
        `style-src ${styleSrc.join(' ')}`,
        `img-src ${imgSrc.join(' ')}`,
        `connect-src ${connectSrc.join(' ')}`,
        `font-src ${fontSrc.join(' ')}`,
        `object-src ${objectSrc.join(' ')}`,
        `media-src ${mediaSrc.join(' ')}`,
        `frame-src ${frameSrc.join(' ')}`,
        `base-uri 'self'`,
        `form-action 'self'`,
        `frame-ancestors 'none'`,
        `upgrade-insecure-requests`
      ]

      c.header('Content-Security-Policy', cspDirectives.join('; '))
    }
  }
}

/**
 * 其他安全头部中间件
 */
export function securityHeaders() {
  return async (c: Context, next: Next) => {
    await next()

    // HTTPS强制
    if (process.env.NODE_ENV === 'production') {
      c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
    }

    // 防止MIME类型嗅探
    c.header('X-Content-Type-Options', 'nosniff')

    // 防止点击劫持
    c.header('X-Frame-Options', 'DENY')

    // XSS保护
    c.header('X-XSS-Protection', '1; mode=block')

    // 引用策略
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin')

    // 权限策略（替代Feature-Policy）
    c.header('Permissions-Policy',
      'geolocation=(), ' +
      'microphone=(), ' +
      'camera=(), ' +
      'payment=(), ' +
      'usb=(), ' +
      'magnetometer=(), ' +
      'gyroscope=(), ' +
      'accelerometer=(), ' +
      'autoplay=(), ' +
      'encrypted-media=(), ' +
      'fullscreen=(self), ' +
      'picture-in-picture=(), ' +
      'speaker=()'
    )
  }
}

/**
 * 合并所有安全头部中间件
 */
export function allSecurityHeaders() {
  return [
    securityHeaders(),
    contentSecurityPolicy()
  ]
}

export default corsSecurity