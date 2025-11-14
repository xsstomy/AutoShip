import { z } from 'zod'

// 订单状态枚举
export const OrderStatus = {
  PENDING: 'pending',
  PAID: 'paid',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled',
} as const

export type OrderStatusType = typeof OrderStatus[keyof typeof OrderStatus]

// 支付网关枚举
export const Gateway = {
  ALIPAY: 'alipay',
  CREEM: 'creem',
} as const

export type GatewayType = typeof Gateway[keyof typeof Gateway]

// 货币枚举
export const Currency = {
  CNY: 'CNY',
  USD: 'USD',
} as const

export type CurrencyType = typeof Currency[keyof typeof Currency]

// 支付网关详细信息
export interface GatewayInfo {
  id: string           // 网关ID (alipay, creem)
  name: string         // 网关标识
  displayName: string  // 显示名称
  supportedCurrencies: CurrencyType[]  // 支持的货币
  recommendedCurrency: CurrencyType    // 推荐货币
  isEnabled: boolean   // 是否启用
}

// 订单数据类型
export interface Order {
  id: string
  productId: number
  email: string
  gateway: GatewayType
  amount: number
  currency: CurrencyType
  status: OrderStatusType
  gatewayOrderId?: string
  gatewayData?: string
  notes?: string
  customerIp?: string
  customerUserAgent?: string
  paidAt?: string
  deliveredAt?: string
  refundedAt?: string
  createdAt: string
  updatedAt: string
}

// 订单创建请求类型
export interface CreateOrderRequest {
  productId: number
  productName: string
  email: string
  price: number
  currency: CurrencyType
  gateway: GatewayType
  customerIp?: string
  customerUserAgent?: string
}

// 订单创建响应类型
export interface CreateOrderResponse {
  id: string
  email: string
  productName: string
  price: string
  currency: CurrencyType
  status: OrderStatusType
  createdAt: string
  updatedAt: string
}

// 订单查询参数类型
export interface OrderQueryParams {
  page?: number
  limit?: number
  status?: OrderStatusType
  email?: string
  gateway?: GatewayType
  currency?: CurrencyType
  startDate?: string
  endDate?: string
  search?: string
}

// 订单状态更新请求类型
export interface UpdateOrderStatusRequest {
  status: OrderStatusType
  notes?: string
  gatewayOrderId?: string
  gatewayData?: string
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
}

// 分页响应类型
export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// 订单统计类型
export interface OrderStats {
  statusStats: Array<{
    status: OrderStatusType
    count: number
    totalAmount: number
  }>
  gatewayStats: Array<{
    gateway: GatewayType
    count: number
    totalAmount: number
  }>
  currencyStats: Array<{
    currency: CurrencyType
    count: number
    totalAmount: number
  }>
}

// 订单指标类型
export interface OrderMetrics {
  totalOrders: number
  totalRevenue: number
  averageOrderValue: number
  dailyStats: Array<{
    date: string
    orderCount: number
    revenue: number
  }>
  funnelStats: Array<{
    status: OrderStatusType
    count: number
  }>
}

// 订单健康状态类型
export interface OrderHealthStatus {
  healthy: boolean
  metrics: {
    recentOrders24h: number
    recentOrders1h: number
    stuckOrders: number
    timeoutOrders: number
  }
  checks: {
    hasRecentActivity: boolean
    hasVeryRecentActivity: boolean
    noStuckOrders: boolean
    noTimeoutOrders: boolean
  }
}

// Zod验证模式
export const createOrderSchema = z.object({
  productId: z.number().positive('商品ID必须大于0'),
  productName: z.string().min(1, '商品名称不能为空').max(255, '商品名称过长'),
  email: z.string().email('请输入有效的邮箱地址'),
  price: z.number().positive('价格必须大于0'),
  currency: z.enum(['CNY', 'USD']).refine((val) => ['CNY', 'USD'].includes(val), {
    message: '仅支持CNY和USD货币'
  }),
  gateway: z.enum(['alipay', 'creem']).refine((val) => ['alipay', 'creem'].includes(val), {
    message: '仅支持支付宝和Creem支付'
  }),
  customerIp: z.string().optional(),
  customerUserAgent: z.string().optional(),
})

export const orderQuerySchema = z.object({
  page: z.coerce.number().positive().min(1).default(1),
  limit: z.coerce.number().positive().min(1).max(100).default(20),
  status: z.enum(['pending', 'paid', 'delivered', 'failed', 'refunded', 'cancelled']).optional(),
  email: z.string().email().optional(),
  gateway: z.enum(['alipay', 'creem']).optional(),
  currency: z.enum(['CNY', 'USD']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().min(1).max(100).optional(),
})

export const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'paid', 'delivered', 'failed', 'refunded', 'cancelled']),
  notes: z.string().max(500).optional(),
  gatewayOrderId: z.string().max(100).optional(),
  gatewayData: z.string().optional(),
})

// 类型导出
export type CreateOrderRequestType = z.infer<typeof createOrderSchema>
export type OrderQueryParamsType = z.infer<typeof orderQuerySchema>
export type UpdateOrderStatusRequestType = z.infer<typeof updateOrderStatusSchema>

// 错误码定义
export const ORDER_ERROR_CODES = {
  // 通用错误
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  // 订单相关错误
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  INVALID_ORDER_ID: 'INVALID_ORDER_ID',
  DUPLICATE_ORDER: 'DUPLICATE_ORDER',
  UPDATE_FAILED: 'UPDATE_FAILED',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',

  // 商品相关错误
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  PRODUCT_INACTIVE: 'PRODUCT_INACTIVE',
  PRICE_MISMATCH: 'PRICE_MISMATCH',

  // 邮箱相关错误
  INVALID_EMAIL: 'INVALID_EMAIL',

  // 业务逻辑错误
  INSUFFICIENT_INVENTORY: 'INSUFFICIENT_INVENTORY',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
} as const

export type OrderErrorCodeType = typeof ORDER_ERROR_CODES[keyof typeof ORDER_ERROR_CODES]

// 常量定义
export const ORDER_CONSTANTS = {
  // 订单ID格式
  ORDER_ID_PREFIX: 'ORDER',
  ORDER_ID_LENGTH: 22, // ORDER + 14位时间戳 + 4位随机数

  // 分页默认值
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // 订单超时时间（小时）
  ORDER_TIMEOUT_HOURS: 24,

  // 价格验证容差（百分比）
  PRICE_TOLERANCE_PERCENTAGE: 5,

  // 字符串长度限制
  MAX_PRODUCT_NAME_LENGTH: 255,
  MAX_NOTES_LENGTH: 500,
  MAX_GATEWAY_ORDER_ID_LENGTH: 100,
  MAX_SEARCH_LENGTH: 100,
} as const

// 订单状态转换规则
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatusType, OrderStatusType[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.FAILED, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.DELIVERED, OrderStatus.REFUNDED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
  [OrderStatus.FAILED]: [], // 终态
  [OrderStatus.REFUNDED]: [], // 终态
  [OrderStatus.CANCELLED]: [], // 终态
}

// 格式化工具函数
export class OrderFormatter {
  static formatOrderId(orderId: string): string {
    return orderId.toUpperCase()
  }

  static formatCurrency(amount: number, currency: CurrencyType): string {
    return new Intl.NumberFormat(currency === 'CNY' ? 'zh-CN' : 'en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  static formatDate(dateString?: string): string {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  static getStatusText(status: OrderStatusType): string {
    const statusMap: Record<OrderStatusType, string> = {
      [OrderStatus.PENDING]: '待支付',
      [OrderStatus.PAID]: '已支付',
      [OrderStatus.DELIVERED]: '已发货',
      [OrderStatus.FAILED]: '支付失败',
      [OrderStatus.REFUNDED]: '已退款',
      [OrderStatus.CANCELLED]: '已取消',
    }
    return statusMap[status] || status
  }

  static getGatewayText(gateway: GatewayType): string {
    const gatewayMap: Record<GatewayType, string> = {
      [Gateway.ALIPAY]: '支付宝',
      [Gateway.CREEM]: 'Creem',
    }
    return gatewayMap[gateway] || gateway
  }
}