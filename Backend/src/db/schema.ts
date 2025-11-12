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
})

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
})

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