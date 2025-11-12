import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// Products
export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  templateText: text('template_text'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
})

// Product prices
export const productPrices = sqliteTable('product_prices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id),
  currency: text('currency').notNull(),
  price: real('price').notNull(),
})

// Orders
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(), // UUID
  productId: integer('product_id').notNull().references(() => products.id),
  email: text('email').notNull(),
  gateway: text('gateway').notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').notNull(),
  status: text('status').notNull().default('pending'),
  gatewayOrderId: text('gateway_order_id'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
})

// Deliveries
export const deliveries = sqliteTable('deliveries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: text('order_id').notNull().references(() => orders.id),
  deliveryType: text('delivery_type').notNull(), // text, download
  content: text('content'),
  downloadToken: text('download_token'),
  expiresAt: text('expires_at'),
  downloadCount: integer('download_count').default(0),
  maxDownloads: integer('max_downloads').default(3),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
})

// Downloads
export const downloads = sqliteTable('downloads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  deliveryId: integer('delivery_id').notNull().references(() => deliveries.id),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  downloadedAt: text('downloaded_at').default(sql`CURRENT_TIMESTAMP`),
})

// Payments raw
export const paymentsRaw = sqliteTable('payments_raw', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gateway: text('gateway').notNull(),
  gatewayOrderId: text('gateway_order_id'),
  signatureValid: integer('signature_valid', { mode: 'boolean' }).default(false),
  payload: text('payload').notNull(),
  processed: integer('processed', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
})

// Inventory text
export const inventoryText = sqliteTable('inventory_text', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id),
  content: text('content').notNull(),
  isUsed: integer('is_used', { mode: 'boolean' }).default(false),
  usedOrderId: text('used_order_id').references(() => orders.id),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  usedAt: text('used_at'),
})

// Settings
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
  description: text('description'),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
})

// Types
export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
export type ProductPrice = typeof productPrices.$inferSelect
export type Order = typeof orders.$inferSelect
export type Delivery = typeof deliveries.$inferSelect
