import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// Products - 商品信息表
export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  templateText: text('template_text'),
  deliveryType: text('delivery_type').notNull().default('text'), // text, download, hybrid
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  sortOrder: integer('sort_order').default(0), // 排序字段
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
})

// Product prices - 商品定价表（支持多币种）
export const productPrices = sqliteTable('product_prices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  currency: text('currency').notNull(), // CNY, USD, EUR, JPY
  price: real('price').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  // 确保每个商品每种货币只有一个价格
  uniqueProductCurrency: uniqueIndex('unique_product_currency').on(table.productId, table.currency),
}))

// Orders - 订单记录表
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(), // UUID
  productId: integer('product_id').notNull().references(() => products.id),
  email: text('email').notNull(),
  gateway: text('gateway').notNull(), // alipay, creem, stripe
  amount: real('amount').notNull(),
  currency: text('currency').notNull(), // CNY, USD, EUR, JPY
  status: text('status').notNull().default('pending'), // pending, paid, refunded, failed, cancelled, delivered
  gatewayOrderId: text('gateway_order_id'), // 第三方支付订单ID
  gatewayData: text('gateway_data'), // 支付网关返回的额外数据（JSON格式）
  notes: text('notes'), // 订单备注
  customerIp: text('customer_ip'), // 客户IP地址
  customerUserAgent: text('customer_user_agent'), // 客户浏览器信息
  paidAt: text('paid_at'), // 支付时间
  deliveredAt: text('delivered_at'), // 发货时间
  refundedAt: text('refunded_at'), // 退款时间
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  // 优化常用查询的索引
  emailIndex: uniqueIndex('idx_orders_email').on(table.email),
  statusIndex: uniqueIndex('idx_orders_status').on(table.status),
  gatewayIndex: uniqueIndex('idx_orders_gateway').on(table.gateway),
  gatewayOrderIdIndex: uniqueIndex('idx_orders_gateway_order_id').on(table.gatewayOrderId),
  createdAtIndex: uniqueIndex('idx_orders_created_at').on(table.createdAt),
  emailStatusIndex: uniqueIndex('idx_orders_email_status').on(table.email, table.status),
  statusCreatedAtIndex: uniqueIndex('idx_orders_status_created_at').on(table.status, table.createdAt),
}))

// Deliveries - 发货记录表
export const deliveries = sqliteTable('deliveries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  deliveryType: text('delivery_type').notNull(), // text, download, hybrid
  content: text('content'), // 文本内容（卡密、许可证等）
  downloadUrl: text('download_url'), // 完整的下载URL
  downloadToken: text('download_token'), // 下载token
  expiresAt: text('expires_at'), // 下载链接过期时间
  downloadCount: integer('download_count').default(0), // 下载次数
  maxDownloads: integer('max_downloads').default(3), // 最大下载次数
  fileSize: integer('file_size'), // 文件大小（字节）
  fileName: text('file_name'), // 文件名
  isActive: integer('is_active', { mode: 'boolean' }).default(true), // 是否有效（退款后会失效）
  deliveryMethod: text('delivery_method').default('email'), // email, api, manual
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
})

// Downloads - 下载日志表
export const downloads = sqliteTable('downloads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  deliveryId: integer('delivery_id').notNull().references(() => deliveries.id, { onDelete: 'cascade' }),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  referer: text('referer'), // 来源页面
  downloadStatus: text('download_status').default('success'), // success, failed, partial
  bytesDownloaded: integer('bytes_downloaded'), // 实际下载字节数
  downloadTimeMs: integer('download_time_ms'), // 下载耗时（毫秒）
  downloadedAt: text('downloaded_at').default(sql`CURRENT_TIMESTAMP`),
})

// Payments raw - 支付回调日志表（幂等与验签记录）
export const paymentsRaw = sqliteTable('payments_raw', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gateway: text('gateway').notNull(), // alipay, creem, stripe
  gatewayOrderId: text('gateway_order_id'),
  gatewayTransactionId: text('gateway_transaction_id'), // 网关交易ID（可能与order_id不同）
  signatureValid: integer('signature_valid', { mode: 'boolean' }).default(false), // 签名是否有效
  signatureMethod: text('signature_method'), // 签名方法：RSA2, HMAC等
  payload: text('payload').notNull(), // 回调原始payload
  processed: integer('processed', { mode: 'boolean' }).default(false), // 是否已处理
  processingAttempts: integer('processing_attempts').default(0), // 处理尝试次数
  errorMessage: text('error_message'), // 处理错误信息
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  processedAt: text('processed_at'), // 处理完成时间
}, (table) => ({
  // 优化Webhook查询和幂等性检查的索引
  gatewayIndex: uniqueIndex('idx_payments_raw_gateway').on(table.gateway),
  gatewayOrderIdIndex: uniqueIndex('idx_payments_raw_gateway_order_id').on(table.gatewayOrderId),
  processedIndex: uniqueIndex('idx_payments_raw_processed').on(table.processed),
  createdAtIndex: uniqueIndex('idx_payments_raw_created_at').on(table.createdAt),
  gatewayProcessedIndex: uniqueIndex('idx_payments_raw_gateway_processed').on(table.gateway, table.processed),
  gatewayOrderIdProcessedIndex: uniqueIndex('idx_payments_raw_gateway_order_id_processed').on(table.gatewayOrderId, table.processed),
}))

// Inventory text - 文本库存表（可用于卡密池）
export const inventoryText = sqliteTable('inventory_text', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  batchName: text('batch_name'), // 批次名称（用于库存管理）
  priority: integer('priority').default(0), // 优先级，数字越大优先级越高
  isUsed: integer('is_used', { mode: 'boolean' }).default(false), // 是否已使用
  usedOrderId: text('used_order_id').references(() => orders.id), // 使用的订单ID
  usedAt: text('used_at'), // 使用时间
  expiresAt: text('expires_at'), // 过期时间
  metadata: text('metadata'), // 额外元数据（JSON格式）
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  createdBy: text('created_by'), // 创建者
})

// Settings - 系统配置项表
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
  dataType: text('data_type').default('string'), // string, number, boolean, json
  description: text('description'),
  isPublic: integer('is_public', { mode: 'boolean' }).default(false), // 是否可公开访问
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
  updatedBy: text('updated_by'), // 更新者
})

// Admin logs - 管理员操作日志表
export const adminLogs = sqliteTable('admin_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  adminEmail: text('admin_email').notNull(),
  action: text('action').notNull(), // create, update, delete, view, export
  resourceType: text('resource_type').notNull(), // order, product, inventory, setting, delivery
  resourceId: text('resource_id'), // 资源ID
  oldValues: text('old_values'), // 修改前的值（JSON）
  newValues: text('new_values'), // 修改后的值（JSON）
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  success: integer('success', { mode: 'boolean' }).default(true),
  errorMessage: text('error_message'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
})

// Files - 文件存储表（用于下载文件管理）
export const files = sqliteTable('files', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fileName: text('file_name').notNull(), // 存储的文件名
  originalName: text('original_name').notNull(), // 原始文件名
  filePath: text('file_path').notNull(), // 文件路径
  fileSize: integer('file_size').notNull(), // 文件大小（字节）
  mimeType: text('mime_type'), // MIME类型
  checksum: text('checksum'), // 文件校验和
  isActive: integer('is_active', { mode: 'boolean' }).default(true), // 是否有效
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  createdBy: text('created_by'), // 创建者
})

// Config - 系统配置管理表（扩展settings表，支持更多配置选项）
export const config = sqliteTable('config', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  groupKey: text('group_key').notNull(), // 配置分组，如 'payment', 'security', 'email'
  configKey: text('config_key').notNull(), // 配置键名
  configValue: text('config_value'), // 配置值
  dataType: text('data_type').default('string'), // string, number, boolean, json
  isEncrypted: integer('is_encrypted', { mode: 'boolean' }).default(false), // 是否加密存储
  isPublic: integer('is_public', { mode: 'boolean' }).default(false), // 是否可公开访问
  description: text('description'), // 配置描述
  defaultValue: text('default_value'), // 默认值
  validationRule: text('validation_rule'), // 验证规则（JSON格式）
  version: integer('version').default(1), // 配置版本
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
  updatedBy: text('updated_by'), // 更新者
}, (table) => ({
  // 确保每个分组内配置键唯一
  uniqueGroupKey: uniqueIndex('unique_group_config_key').on(table.groupKey, table.configKey),
}))

// Audit logs - 安全审计日志表（扩展adminLogs表，记录所有安全相关事件）
export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventType: text('event_type').notNull(), // security, admin, payment, webhook, download
  eventCategory: text('event_category').notNull(), // auth, access, validation, error, suspicious
  severity: text('severity').notNull().default('info'), // info, warning, error, critical
  userId: text('user_id'), // 用户ID（如果适用）
  userEmail: text('user_email'), // 用户邮箱
  ipAddress: text('ip_address'), // IP地址
  userAgent: text('user_agent'), // 用户代理
  requestPath: text('request_path'), // 请求路径
  requestMethod: text('request_method'), // 请求方法
  resourceType: text('resource_type'), // 资源类型
  resourceId: text('resource_id'), // 资源ID
  action: text('action'), // 执行的动作
  result: text('result'), // 结果：success, failure, blocked
  details: text('details'), // 详细信息（JSON格式）
  metadata: text('metadata'), // 额外元数据（JSON格式）
  riskScore: integer('risk_score').default(0), // 风险评分（0-100）
  sessionId: text('session_id'), // 会话ID
  traceId: text('trace_id'), // 跟踪ID
  tags: text('tags'), // 标签（逗号分隔）
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  // 优化常用查询的索引
  eventTypeIndex: uniqueIndex('idx_audit_event_type').on(table.eventType),
  severityIndex: uniqueIndex('idx_audit_severity').on(table.severity),
  createdAtIndex: uniqueIndex('idx_audit_created_at').on(table.createdAt),
  ipAddressIndex: uniqueIndex('idx_audit_ip_address').on(table.ipAddress),
}))

// Rate limits - API限流表
export const rateLimits = sqliteTable('rate_limits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  limitKey: text('limit_key').notNull(), // 限流键，可以是IP、用户ID等
  limitType: text('limit_type').notNull(), // ip, user, api_key, global
  resourceType: text('resource_type'), // API类型或资源类型
  windowSize: integer('window_size').notNull(), // 时间窗口（秒）
  maxRequests: integer('max_requests').notNull(), // 最大请求次数
  currentRequests: integer('current_requests').default(0), // 当前请求次数
  blockedUntil: text('blocked_until'), // 封禁结束时间
  isWhitelist: integer('is_whitelist', { mode: 'boolean' }).default(false), // 是否在白名单
  violationCount: integer('violation_count').default(0), // 违规次数
  lastViolationAt: text('last_violation_at'), // 最后违规时间
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  // 优化限流查询的索引
  limitKeyIndex: uniqueIndex('idx_rate_limit_key').on(table.limitKey),
  limitTypeIndex: uniqueIndex('idx_rate_limit_type').on(table.limitType),
  blockedUntilIndex: uniqueIndex('idx_rate_blocked_until').on(table.blockedUntil),
}))

// Security tokens - 安全令牌管理表
export const securityTokens = sqliteTable('security_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tokenType: text('token_type').notNull(), // jwt, download, api_key, reset, verification
  tokenId: text('token_id').notNull(), // 令牌ID或指纹
  tokenValue: text('token_value'), // 令牌值（加密存储）
  tokenHash: text('token_hash'), // 令牌哈希（用于验证）
  associatedId: text('associated_id'), // 关联的ID（用户ID、订单ID等）
  associatedType: text('associated_type'), // 关联类型（user, order, admin）
  purpose: text('purpose'), // 令牌用途
  permissions: text('permissions'), // 权限列表（JSON格式）
  metadata: text('metadata'), // 元数据（JSON格式）
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  expiresAt: text('expires_at'), // 过期时间
  lastUsedAt: text('last_used_at'), // 最后使用时间
  usageCount: integer('usage_count').default(0), // 使用次数
  maxUsage: integer('max_usage'), // 最大使用次数
  ipAddress: text('ip_address'), // 创建时的IP地址
  userAgent: text('user_agent'), // 创建时的用户代理
  revokedAt: text('revoked_at'), // 撤销时间
  revokedBy: text('revoked_by'), // 撤销者
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  createdBy: text('created_by'), // 创建者
}, (table) => ({
  // 优化令牌查询的索引
  tokenIdIndex: uniqueIndex('idx_security_token_id').on(table.tokenId),
  tokenTypeIndex: uniqueIndex('idx_security_token_type').on(table.tokenType),
  associatedIdIndex: uniqueIndex('idx_security_associated_id').on(table.associatedId),
  expiresAtIndex: uniqueIndex('idx_security_expires_at').on(table.expiresAt),
}))

// Types - TypeScript 类型定义
export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
export type ProductPrice = typeof productPrices.$inferSelect
export type NewProductPrice = typeof productPrices.$inferInsert
export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
export type Delivery = typeof deliveries.$inferSelect
export type NewDelivery = typeof deliveries.$inferInsert
export type Download = typeof downloads.$inferSelect
export type NewDownload = typeof downloads.$inferInsert
export type PaymentRaw = typeof paymentsRaw.$inferSelect
export type NewPaymentRaw = typeof paymentsRaw.$inferInsert
export type InventoryText = typeof inventoryText.$inferSelect
export type NewInventoryText = typeof inventoryText.$inferInsert
export type Setting = typeof settings.$inferSelect
export type NewSetting = typeof settings.$inferInsert
export type AdminLog = typeof adminLogs.$inferSelect
export type NewAdminLog = typeof adminLogs.$inferInsert
export type File = typeof files.$inferSelect
export type NewFile = typeof files.$inferInsert
export type Config = typeof config.$inferSelect
export type NewConfig = typeof config.$inferInsert
export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
export type RateLimit = typeof rateLimits.$inferSelect
export type NewRateLimit = typeof rateLimits.$inferInsert
export type SecurityToken = typeof securityTokens.$inferSelect
export type NewSecurityToken = typeof securityTokens.$inferInsert

// 枚举类型定义
export const DeliveryType = {
  TEXT: 'text',
  DOWNLOAD: 'download',
  HYBRID: 'hybrid',
} as const

export const OrderStatus = {
  PENDING: 'pending',
  PAID: 'paid',
  REFUNDED: 'refunded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  DELIVERED: 'delivered',
} as const

export const Gateway = {
  ALIPAY: 'alipay',
  CREEM: 'creem',
  STRIPE: 'stripe',
} as const

export const Currency = {
  CNY: 'CNY',
  USD: 'USD',
  EUR: 'EUR',
  JPY: 'JPY',
} as const

export const DownloadStatus = {
  SUCCESS: 'success',
  FAILED: 'failed',
  PARTIAL: 'partial',
} as const

export const SettingDataType = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  JSON: 'json',
} as const

export const AdminAction = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  VIEW: 'view',
  EXPORT: 'export',
} as const

export const ResourceType = {
  ORDER: 'order',
  PRODUCT: 'product',
  INVENTORY: 'inventory',
  SETTING: 'setting',
  DELIVERY: 'delivery',
} as const

export const DeliveryMethod = {
  EMAIL: 'email',
  API: 'api',
  MANUAL: 'manual',
} as const

// Security related enums
export const ConfigGroup = {
  PAYMENT: 'payment',
  SECURITY: 'security',
  EMAIL: 'email',
  DOWNLOAD: 'download',
  SYSTEM: 'system',
} as const

export const ConfigDataType = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  JSON: 'json',
} as const

export const AuditEventType = {
  SECURITY: 'security',
  ADMIN: 'admin',
  PAYMENT: 'payment',
  WEBHOOK: 'webhook',
  DOWNLOAD: 'download',
} as const

export const AuditEventCategory = {
  AUTH: 'auth',
  ACCESS: 'access',
  VALIDATION: 'validation',
  ERROR: 'error',
  SUSPICIOUS: 'suspicious',
} as const

export const AuditSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
} as const

export const RateLimitType = {
  IP: 'ip',
  USER: 'user',
  API_KEY: 'api_key',
  GLOBAL: 'global',
} as const

export const TokenType = {
  JWT: 'jwt',
  DOWNLOAD: 'download',
  API_KEY: 'api_key',
  RESET: 'reset',
  VERIFICATION: 'verification',
} as const

export const AssociatedType = {
  USER: 'user',
  ORDER: 'order',
  ADMIN: 'admin',
} as const