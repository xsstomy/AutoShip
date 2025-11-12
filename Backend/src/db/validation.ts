import { z } from 'zod'
import { DeliveryType, OrderStatus, Gateway, Currency, DownloadStatus, SettingDataType, AdminAction, ResourceType, DeliveryMethod } from './schema'

// 通用验证模式
const uuidSchema = z.string().uuid()
const emailSchema = z.string().email('Invalid email format')
const timestampSchema = z.string().datetime().optional()
const nullableTimestampSchema = z.string().datetime().nullable().optional()
const jsonSchema = z.string().optional() // JSON字符串

// 商品验证模式
export const productSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(255, 'Product name too long'),
  description: z.string().max(2000, 'Description too long').optional(),
  templateText: z.string().optional(),
  deliveryType: z.nativeEnum(DeliveryType),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
})

export const productUpdateSchema = productSchema.partial()

// 商品价格验证模式
export const productPriceSchema = z.object({
  productId: z.number().int().positive(),
  currency: z.nativeEnum(Currency),
  price: z.number().positive('Price must be positive'),
  isActive: z.boolean().default(true),
})

export const productPriceUpdateSchema = productPriceSchema.partial().omit({ productId: true })

// 订单验证模式
export const orderSchema = z.object({
  id: uuidSchema,
  productId: z.number().int().positive(),
  email: emailSchema,
  gateway: z.nativeEnum(Gateway),
  amount: z.number().positive('Amount must be positive'),
  currency: z.nativeEnum(Currency),
  status: z.nativeEnum(OrderStatus).default(OrderStatus.PENDING),
  gatewayOrderId: z.string().optional(),
  gatewayData: jsonSchema,
  notes: z.string().max(1000, 'Notes too long').optional(),
  customerIp: z.string().optional(),
  customerUserAgent: z.string().optional(),
  paidAt: nullableTimestampSchema,
  deliveredAt: nullableTimestampSchema,
  refundedAt: nullableTimestampSchema,
})

export const orderCreateSchema = orderSchema.omit({
  id: true,
  status: true,
  paidAt: true,
  deliveredAt: true,
  refundedAt: true,
}).extend({
  status: z.nativeEnum(OrderStatus).default(OrderStatus.PENDING),
})

export const orderUpdateSchema = orderSchema.partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})

// 发货记录验证模式
export const deliverySchema = z.object({
  orderId: uuidSchema,
  deliveryType: z.nativeEnum(DeliveryType),
  content: z.string().optional(),
  downloadUrl: z.string().url().optional(),
  downloadToken: z.string().min(32, 'Download token must be at least 32 characters').optional(),
  expiresAt: timestampSchema,
  downloadCount: z.number().int().min(0).default(0),
  maxDownloads: z.number().int().positive().default(3),
  fileSize: z.number().int().positive().optional(),
  fileName: z.string().optional(),
  isActive: z.boolean().default(true),
  deliveryMethod: z.nativeEnum(DeliveryMethod).default(DeliveryMethod.EMAIL),
})

export const deliveryUpdateSchema = deliverySchema.partial().omit({
  id: true,
  orderId: true,
  createdAt: true,
})

// 下载日志验证模式
export const downloadSchema = z.object({
  deliveryId: z.number().int().positive(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  referer: z.string().optional(),
  downloadStatus: z.nativeEnum(DownloadStatus).default(DownloadStatus.SUCCESS),
  bytesDownloaded: z.number().int().min(0).optional(),
  downloadTimeMs: z.number().int().min(0).optional(),
})

// 支付回调验证模式
export const paymentRawSchema = z.object({
  gateway: z.nativeEnum(Gateway),
  gatewayOrderId: z.string().optional(),
  gatewayTransactionId: z.string().optional(),
  signatureValid: z.boolean().default(false),
  signatureMethod: z.string().optional(),
  payload: z.string().min(1, 'Payload is required'),
  processed: z.boolean().default(false),
  processingAttempts: z.number().int().min(0).default(0),
  errorMessage: z.string().optional(),
  processedAt: nullableTimestampSchema,
})

export const paymentRawUpdateSchema = paymentRawSchema.partial().omit({
  id: true,
  gateway: true,
  payload: true,
  createdAt: true,
})

// 库存文本验证模式
export const inventoryTextSchema = z.object({
  productId: z.number().int().positive(),
  content: z.string().min(1, 'Content is required'),
  batchName: z.string().max(100, 'Batch name too long').optional(),
  priority: z.number().int().default(0),
  isUsed: z.boolean().default(false),
  usedOrderId: uuidSchema.optional(),
  usedAt: nullableTimestampSchema,
  expiresAt: nullableTimestampSchema,
  metadata: jsonSchema,
  createdBy: z.string().optional(),
})

export const inventoryTextUpdateSchema = inventoryTextSchema.partial().omit({
  id: true,
  productId: true,
  createdAt: true,
})

// 系统设置验证模式
export const settingSchema = z.object({
  key: z.string().min(1, 'Setting key is required').max(100, 'Key too long'),
  value: z.string(),
  dataType: z.nativeEnum(SettingDataType).default(SettingDataType.STRING),
  description: z.string().max(500, 'Description too long').optional(),
  isPublic: z.boolean().default(false),
  updatedBy: z.string().optional(),
})

export const settingUpdateSchema = settingSchema.partial().omit({
  key: true,
  updatedAt: true,
})

// 管理员日志验证模式
export const adminLogSchema = z.object({
  adminEmail: emailSchema,
  action: z.nativeEnum(AdminAction),
  resourceType: z.nativeEnum(ResourceType),
  resourceId: z.string().optional(),
  oldValues: jsonSchema,
  newValues: jsonSchema,
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  success: z.boolean().default(true),
  errorMessage: z.string().optional(),
})

// 文件验证模式
export const fileSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  originalName: z.string().min(1, 'Original name is required'),
  filePath: z.string().min(1, 'File path is required'),
  fileSize: z.number().int().positive('File size must be positive'),
  mimeType: z.string().optional(),
  checksum: z.string().optional(),
  isActive: z.boolean().default(true),
  createdBy: z.string().optional(),
})

export const fileUpdateSchema = fileSchema.partial().omit({
  id: true,
  createdAt: true,
})

// 查询参数验证模式
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).optional(),
})

export const orderQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(OrderStatus).optional(),
  email: emailSchema.optional(),
  gateway: z.nativeEnum(Gateway).optional(),
  currency: z.nativeEnum(Currency).optional(),
  startDate: timestampSchema,
  endDate: timestampSchema,
  search: z.string().optional(),
})

export const productQuerySchema = paginationSchema.extend({
  isActive: z.coerce.boolean().optional(),
  deliveryType: z.nativeEnum(DeliveryType).optional(),
  search: z.string().optional(),
})

// API响应验证模式
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
})

export const paginatedResponseSchema = apiResponseSchema.extend({
  data: z.object({
    items: z.array(z.any()),
    pagination: z.object({
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
      hasNext: z.boolean(),
      hasPrev: z.boolean(),
    }),
  }),
})

// 导出所有验证函数
export const validateProduct = (data: unknown) => productSchema.parse(data)
export const validateProductUpdate = (data: unknown) => productUpdateSchema.parse(data)
export const validateProductPrice = (data: unknown) => productPriceSchema.parse(data)
export const validateOrder = (data: unknown) => orderSchema.parse(data)
export const validateOrderCreate = (data: unknown) => orderCreateSchema.parse(data)
export const validateOrderUpdate = (data: unknown) => orderUpdateSchema.parse(data)
export const validateDelivery = (data: unknown) => deliverySchema.parse(data)
export const validateDownload = (data: unknown) => downloadSchema.parse(data)
export const validatePaymentRaw = (data: unknown) => paymentRawSchema.parse(data)
export const validateInventoryText = (data: unknown) => inventoryTextSchema.parse(data)
export const validateSetting = (data: unknown) => settingSchema.parse(data)
export const validateAdminLog = (data: unknown) => adminLogSchema.parse(data)
export const validateFile = (data: unknown) => fileSchema.parse(data)
export const validatePagination = (data: unknown) => paginationSchema.parse(data)
export const validateOrderQuery = (data: unknown) => orderQuerySchema.parse(data)
export const validateProductQuery = (data: unknown) => productQuerySchema.parse(data)

// 类型导出
export type ProductInput = z.infer<typeof productSchema>
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>
export type ProductPriceInput = z.infer<typeof productPriceSchema>
export type OrderInput = z.infer<typeof orderSchema>
export type OrderCreateInput = z.infer<typeof orderCreateSchema>
export type OrderUpdateInput = z.infer<typeof orderUpdateSchema>
export type DeliveryInput = z.infer<typeof deliverySchema>
export type DownloadInput = z.infer<typeof downloadSchema>
export type PaymentRawInput = z.infer<typeof paymentRawSchema>
export type InventoryTextInput = z.infer<typeof inventoryTextSchema>
export type SettingInput = z.infer<typeof settingSchema>
export type AdminLogInput = z.infer<typeof adminLogSchema>
export type FileInput = z.infer<typeof fileSchema>
export type PaginationInput = z.infer<typeof paginationSchema>
export type OrderQueryInput = z.infer<typeof orderQuerySchema>
export type ProductQueryInput = z.infer<typeof productQuerySchema>