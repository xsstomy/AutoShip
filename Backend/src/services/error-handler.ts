import { ZodError } from 'zod'
import { db, schema } from '../db'

// 自定义错误类
export class DatabaseError extends Error {
  public code: string
  public details?: any

  constructor(message: string, code: string = 'DATABASE_ERROR', details?: any) {
    super(message)
    this.name = 'DatabaseError'
    this.code = code
    this.details = details
  }
}

export class ValidationError extends Error {
  public code: string
  public field?: string
  public validationErrors?: any

  constructor(message: string, code: string = 'VALIDATION_ERROR', field?: string, validationErrors?: any) {
    super(message)
    this.name = 'ValidationError'
    this.code = code
    this.field = field
    this.validationErrors = validationErrors
  }
}

export class BusinessLogicError extends Error {
  public code: string
  public context?: any

  constructor(message: string, code: string = 'BUSINESS_LOGIC_ERROR', context?: any) {
    super(message)
    this.name = 'BusinessLogicError'
    this.code = code
    this.context = context
  }
}

export class NotFoundError extends Error {
  public resource: string
  public identifier?: any

  constructor(resource: string, identifier?: any) {
    super(`${resource} not found${identifier ? ` with identifier: ${identifier}` : ''}`)
    this.name = 'NotFoundError'
    this.resource = resource
    this.identifier = identifier
  }
}

export class PermissionError extends Error {
  public action: string
  public resource: string

  constructor(action: string, resource: string) {
    super(`Permission denied for ${action} on ${resource}`)
    this.name = 'PermissionError'
    this.action = action
    this.resource = resource
  }
}

// 错误代码枚举
export enum ErrorCode {
  // 数据库错误
  DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  DATABASE_QUERY_FAILED = 'DATABASE_QUERY_FAILED',
  DATABASE_TRANSACTION_FAILED = 'DATABASE_TRANSACTION_FAILED',
  DATABASE_CONSTRAINT_VIOLATION = 'DATABASE_CONSTRAINT_VIOLATION',

  // 验证错误
  INVALID_INPUT_FORMAT = 'INVALID_INPUT_FORMAT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_EMAIL_FORMAT = 'INVALID_EMAIL_FORMAT',
  INVALID_UUID_FORMAT = 'INVALID_UUID_FORMAT',

  // 业务逻辑错误
  INSUFFICIENT_INVENTORY = 'INSUFFICIENT_INVENTORY',
  ORDER_NOT_PENDING = 'ORDER_NOT_PENDING',
  ORDER_ALREADY_PAID = 'ORDER_ALREADY_PAID',
  ORDER_CANNOT_BE_REFUNDED = 'ORDER_CANNOT_BE_REFUNDED',
  PRODUCT_NOT_ACTIVE = 'PRODUCT_NOT_ACTIVE',
  DOWNLOAD_LINK_EXPIRED = 'DOWNLOAD_LINK_EXPIRED',
  DOWNLOAD_LIMIT_EXCEEDED = 'DOWNLOAD_LIMIT_EXCEEDED',

  // 权限错误
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  FORBIDDEN_OPERATION = 'FORBIDDEN_OPERATION',

  // 通用错误
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
}

// 错误处理器类
export class ErrorHandler {
  /**
   * 处理数据库错误
   */
  static handleDatabaseError(error: any): DatabaseError {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return new DatabaseError(
        'Duplicate entry detected',
        ErrorCode.DATABASE_CONSTRAINT_VIOLATION,
        { constraint: error.code }
      )
    }

    if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return new DatabaseError(
        'Foreign key constraint violation',
        ErrorCode.DATABASE_CONSTRAINT_VIOLATION,
        { constraint: error.code }
      )
    }

    if (error.code === 'SQLITE_CONSTRAINT_NOTNULL') {
      return new DatabaseError(
        'Required field cannot be null',
        ErrorCode.DATABASE_CONSTRAINT_VIOLATION,
        { constraint: error.code }
      )
    }

    if (error.code === 'SQLITE_LOCKED' || error.code === 'SQLITE_BUSY') {
      return new DatabaseError(
        'Database is locked, please try again',
        ErrorCode.DATABASE_QUERY_FAILED,
        { originalError: error }
      )
    }

    return new DatabaseError(
      error.message || 'Unknown database error',
      ErrorCode.DATABASE_QUERY_FAILED,
      { originalError: error }
    )
  }

  /**
   * 处理验证错误
   */
  static handleValidationError(error: any): ValidationError {
    if (error instanceof ZodError) {
      const fieldErrors = error.issues.map((err: any) => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }))

      return new ValidationError(
        'Validation failed',
        ErrorCode.INVALID_INPUT_FORMAT,
        fieldErrors[0]?.field,
        fieldErrors
      )
    }

    return new ValidationError(
      error.message || 'Validation failed',
      ErrorCode.INVALID_INPUT_FORMAT
    )
  }

  /**
   * 记录错误日志
   */
  static async logError(
    error: Error,
    context: {
      endpoint?: string
      method?: string
      userId?: string
      ipAddress?: string
      userAgent?: string
      requestId?: string
    } = {}
  ): Promise<void> {
    try {
      const errorData = {
        message: error.message,
        name: error.name,
        stack: error.stack,
        context: context,
        timestamp: new Date().toISOString(),
      }

      // 如果是自定义错误，添加额外信息
      if (error instanceof DatabaseError) {
        const dbError = error as DatabaseError
        ;(errorData as any).code = dbError.code
        ;(errorData as any).details = dbError.details
      }

      if (error instanceof ValidationError) {
        const valError = error as ValidationError
        ;(errorData as any).code = valError.code
        ;(errorData as any).field = valError.field || undefined
        ;(errorData as any).validationErrors = valError.validationErrors
      }

      if (error instanceof BusinessLogicError) {
        const bizError = error as BusinessLogicError
        ;(errorData as any).code = bizError.code
        ;(errorData as any).context = bizError.context
      }

      // 保存到数据库（异步操作，不影响主流程）
      db.insert(schema.adminLogs)
        .values({
          adminEmail: 'system@autoship.com',
          action: 'view', // 使用 'view' 表示系统错误
          resourceType: 'error',
          resourceId: context.requestId || 'unknown',
          newValues: JSON.stringify(errorData),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          success: false,
          errorMessage: error.message,
          createdAt: new Date().toISOString(),
        })
        .run()

      // 同时输出到控制台
      console.error('🚨 Application Error:', {
        error: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString(),
      })

    } catch (logError) {
      // 如果记录日志失败，至少输出到控制台
      console.error('Failed to log error:', logError)
      console.error('Original error:', error)
    }
  }

  /**
   * 获取用户友好的错误消息
   */
  static getUserFriendlyMessage(error: Error): string {
    if (error instanceof ValidationError) {
      return '请检查输入的数据格式是否正确'
    }

    if (error instanceof DatabaseError) {
      if (error.code === ErrorCode.DATABASE_CONSTRAINT_VIOLATION) {
        return '数据已存在或格式不正确'
      }
      return '数据库操作失败，请稍后重试'
    }

    if (error instanceof BusinessLogicError) {
      switch (error.code) {
        case ErrorCode.INSUFFICIENT_INVENTORY:
          return '库存不足，无法完成订单'
        case ErrorCode.ORDER_NOT_PENDING:
          return '订单状态不正确，无法执行此操作'
        case ErrorCode.DOWNLOAD_LINK_EXPIRED:
          return '下载链接已过期'
        case ErrorCode.DOWNLOAD_LIMIT_EXCEEDED:
          return '下载次数已达上限'
        default:
          return error.message
      }
    }

    if (error instanceof NotFoundError) {
      return '请求的资源不存在'
    }

    if (error instanceof PermissionError) {
      return '没有权限执行此操作'
    }

    // 默认消息
    return '系统错误，请联系管理员'
  }

  /**
   * 获取HTTP状态码
   */
  static getHttpStatusCode(error: Error): number {
    if (error instanceof ValidationError) {
      return 400
    }

    if (error instanceof DatabaseError) {
      if (error.code === ErrorCode.DATABASE_CONSTRAINT_VIOLATION) {
        return 409 // Conflict
      }
      return 500
    }

    if (error instanceof BusinessLogicError) {
      switch (error.code) {
        case ErrorCode.INSUFFICIENT_INVENTORY:
        case ErrorCode.ORDER_NOT_PENDING:
        case ErrorCode.ORDER_ALREADY_PAID:
        case ErrorCode.ORDER_CANNOT_BE_REFUNDED:
          return 400 // Bad Request
        case ErrorCode.DOWNLOAD_LINK_EXPIRED:
        case ErrorCode.DOWNLOAD_LIMIT_EXCEEDED:
          return 410 // Gone
        default:
          return 400
      }
    }

    if (error instanceof NotFoundError) {
      return 404
    }

    if (error instanceof PermissionError) {
      return 403
    }

    return 500
  }

  /**
   * 格式化错误响应
   */
  static formatErrorResponse(error: Error, includeStackTrace = false) {
    const statusCode = this.getHttpStatusCode(error)
    const message = this.getUserFriendlyMessage(error)

    const response: any = {
      success: false,
      error: error.name || 'Error',
      message,
      statusCode,
    }

    // 在开发环境中包含更多错误信息
    if (process.env.NODE_ENV === 'development' || includeStackTrace) {
      response.details = {
        name: error.name,
        stack: error.stack,
      }

      if (error instanceof DatabaseError) {
        response.details.code = error.code
        response.details.details = error.details
      }

      if (error instanceof ValidationError) {
        response.details.code = error.code
        response.details.field = error.field
        response.details.validationErrors = error.validationErrors
      }

      if (error instanceof BusinessLogicError) {
        response.details.code = error.code
        response.details.context = error.context
      }
    }

    return response
  }
}

// 异步错误包装器
export function asyncErrorHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      // 记录错误
      await ErrorHandler.logError(error as Error, {
        // 可以从请求上下文中获取更多信息
        endpoint: fn.name,
      })

      // 重新抛出错误，让上层处理
      throw error
    }
  }
}

// 错误边界中间件
export function errorBoundary(
  error: Error,
  context: {
    endpoint?: string
    method?: string
    userId?: string
    ipAddress?: string
    userAgent?: string
    requestId?: string
  } = {}
): never {
  // 记录错误
  ErrorHandler.logError(error, context).catch(logError => {
    console.error('Failed to log error:', logError)
  })

  // 抛出格式化的错误
  throw error
}

export default ErrorHandler