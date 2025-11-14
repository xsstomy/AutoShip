import { Context } from 'hono'

/**
 * 标准化成功响应接口
 */
interface ApiSuccess<T = any> {
  success: true
  data: T
}

/**
 * 标准化错误响应接口
 */
interface ApiError {
  success: false
  error: {
    code: string           // 错误代码（如：PRODUCT_NOT_FOUND）
    message: string        // 用户友好的错误信息
    details?: any          // 可选的详细错误信息
  }
}

/**
 * 创建成功响应
 */
export function successResponse<T>(c: Context, data: T, httpStatus = 200) {
  return c.json({
    success: true,
    data,
  }, httpStatus)
}

/**
 * 创建错误响应
 */
export function errorResponse(
  c: Context,
  code: string,
  message: string,
  httpStatus = 400,
  details?: any
) {
  return c.json({
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    }
  }, httpStatus)
}

/**
 * 预定义的常用错误响应
 */
export const errors = {
  // 400 Bad Request
  INVALID_REQUEST: (c: Context, message = '请求参数无效', details?: any) =>
    errorResponse(c, 'INVALID_REQUEST', message, 400, details),

  // 401 Unauthorized
  UNAUTHORIZED: (c: Context, message = '未登录，请先登录') =>
    errorResponse(c, 'UNAUTHORIZED', message, 401),

  INVALID_TOKEN: (c: Context, message = '令牌无效或已过期') =>
    errorResponse(c, 'INVALID_TOKEN', message, 401),

  SESSION_INVALID: (c: Context, message = '会话已失效，请重新登录') =>
    errorResponse(c, 'SESSION_INVALID', message, 401),

  SESSION_EXPIRED: (c: Context, message = '会话已过期，请重新登录') =>
    errorResponse(c, 'SESSION_EXPIRED', message, 401),

  // 403 Forbidden
  FORBIDDEN: (c: Context, message = '没有权限执行此操作') =>
    errorResponse(c, 'FORBIDDEN', message, 403),

  ACCOUNT_DISABLED: (c: Context, message = '账户不存在或已被禁用') =>
    errorResponse(c, 'ACCOUNT_DISABLED', message, 403),

  INSUFFICIENT_PERMISSIONS: (c: Context, message = '没有权限执行此操作') =>
    errorResponse(c, 'INSUFFICIENT_PERMISSIONS', message, 403),

  // 404 Not Found
  NOT_FOUND: (c: Context, message = '资源不存在') =>
    errorResponse(c, 'NOT_FOUND', message, 404),

  PRODUCT_NOT_FOUND: (c: Context, message = '商品不存在') =>
    errorResponse(c, 'PRODUCT_NOT_FOUND', message, 404),

  ORDER_NOT_FOUND: (c: Context, message = '订单不存在') =>
    errorResponse(c, 'ORDER_NOT_FOUND', message, 404),

  // 409 Conflict
  PRODUCT_INACTIVE: (c: Context, message = '商品已下架') =>
    errorResponse(c, 'PRODUCT_INACTIVE', message, 409),

  // 422 Unprocessable Entity
  VALIDATION_ERROR: (c: Context, message = '数据验证失败', details?: any) =>
    errorResponse(c, 'VALIDATION_ERROR', message, 422, details),

  // 429 Too Many Requests
  RATE_LIMIT_EXCEEDED: (c: Context, message = '请求过于频繁，请稍后重试') =>
    errorResponse(c, 'RATE_LIMIT_EXCEEDED', message, 429),

  // 500 Internal Server Error
  INTERNAL_ERROR: (c: Context, message = '服务器内部错误', details?: any) =>
    errorResponse(c, 'INTERNAL_ERROR', message, 500, details),

  // 503 Service Unavailable
  SERVICE_UNAVAILABLE: (c: Context, message = '服务暂不可用，请稍后重试') =>
    errorResponse(c, 'SERVICE_UNAVAILABLE', message, 503),
}

/**
 * 包装异步路由处理函数，自动捕获错误并返回统一格式
 */
export function asyncHandler<T extends Function>(handler: T) {
  return async (c: Context, ...args: any[]) => {
    try {
      return await handler(c, ...args)
    } catch (error: any) {
      console.error('Route handler error:', error)

      // 根据错误类型返回相应的错误响应
      if (error.name === 'ZodError') {
        return errors.VALIDATION_ERROR(c, '数据验证失败', error.errors)
      }

      // 默认返回内部服务器错误
      return errors.INTERNAL_ERROR(c, '服务器内部错误', {
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
      })
    }
  }
}

export default {
  successResponse,
  errorResponse,
  errors,
  asyncHandler,
}
