import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'
import { eq, and, desc, asc, like, count } from 'drizzle-orm'

// 数据库连接配置
const DATABASE_URL = process.env.DATABASE_URL || './database.db'

// 创建数据库连接
export const sqlite = new Database(DATABASE_URL)

// 配置数据库性能优化
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('synchronous = NORMAL')
sqlite.pragma('cache_size = 1000000')
sqlite.pragma('temp_store = MEMORY')
sqlite.pragma('mmap_size = 268435456') // 256MB

// 创建Drizzle实例
export const db = drizzle(sqlite, { schema })

// 数据库初始化函数
export async function initializeDatabase() {
  try {
    console.log('🗄️  Initializing database...')

    // 启用外键约束
    sqlite.pragma('foreign_keys = ON')

    // 检查并创建所有表
    await ensureTablesExist()

    console.log('✅ Database initialized successfully')

    return true
  } catch (error) {
    console.error('❌ Failed to initialize database:', error)
    throw error
  }
}

// 确保所有必要的表存在
async function ensureTablesExist() {
  console.log('📋 Checking database tables...')

  // 检查 products 表是否存在
  const tablesExist = await checkTablesExist()

  if (!tablesExist.allTablesExist) {
    console.log('📦 Creating missing tables...')
    await createAllTables()
    console.log('✅ All tables created successfully')
  } else {
    console.log('✅ All tables already exist')
  }
}

// 检查表是否存在
async function checkTablesExist(): Promise<{ allTablesExist: boolean; missingTables: string[] }> {
  const requiredTables = [
    'products',
    'product_prices',
    'orders',
    'deliveries',
    'downloads',
    'payments_raw',
    'inventory_text',
    'settings',
    'admin_logs',
    'files',
    'config',
    'audit_logs',
    'rate_limits',
    'security_tokens'
  ]

  const missingTables: string[] = []

  for (const tableName of requiredTables) {
    try {
      sqlite.prepare(`SELECT 1 FROM ${tableName} LIMIT 1`).get()
    } catch (error: any) {
      if (error.code === 'SQLITE_ERROR' && error.message.includes('no such table')) {
        missingTables.push(tableName)
      }
    }
  }

  return {
    allTablesExist: missingTables.length === 0,
    missingTables
  }
}

// 创建所有表
async function createAllTables() {
  // 根据 schema.ts 中的定义创建所有表

  // Products 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      template_text TEXT,
      delivery_type TEXT NOT NULL DEFAULT 'text',
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  // Product Prices 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS product_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      currency TEXT NOT NULL,
      price REAL NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      UNIQUE(product_id, currency)
    );
  `)

  // Orders 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      product_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      gateway TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      gateway_order_id TEXT,
      gateway_data TEXT,
      notes TEXT,
      customer_ip TEXT,
      customer_user_agent TEXT,
      paid_at DATETIME,
      delivered_at DATETIME,
      refunded_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `)

  // Deliveries 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      delivery_type TEXT NOT NULL,
      content TEXT,
      download_url TEXT,
      download_token TEXT,
      expires_at DATETIME,
      download_count INTEGER DEFAULT 0,
      max_downloads INTEGER DEFAULT 3,
      file_size INTEGER,
      file_name TEXT,
      is_active INTEGER DEFAULT 1,
      delivery_method TEXT DEFAULT 'email',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
  `)

  // Downloads 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS downloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery_id INTEGER NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      referer TEXT,
      download_status TEXT DEFAULT 'success',
      bytes_downloaded INTEGER,
      download_time_ms INTEGER,
      downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE
    );
  `)

  // Payments Raw 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS payments_raw (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gateway TEXT NOT NULL,
      gateway_order_id TEXT,
      gateway_transaction_id TEXT,
      signature_valid INTEGER DEFAULT 0,
      signature_method TEXT,
      payload TEXT NOT NULL,
      processed INTEGER DEFAULT 0,
      processing_attempts INTEGER DEFAULT 0,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME
    );
  `)

  // Inventory Text 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS inventory_text (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      batch_name TEXT,
      priority INTEGER DEFAULT 0,
      is_used INTEGER DEFAULT 0,
      used_order_id TEXT,
      used_at DATETIME,
      expires_at DATETIME,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (used_order_id) REFERENCES orders(id)
    );
  `)

  // Settings 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      data_type TEXT DEFAULT 'string',
      description TEXT,
      is_public INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT
    );
  `)

  // Admin Logs 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS admin_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_email TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      old_values TEXT,
      new_values TEXT,
      ip_address TEXT,
      user_agent TEXT,
      success INTEGER DEFAULT 1,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  // Files 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT,
      checksum TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT
    );
  `)

  // Config 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_key TEXT NOT NULL,
      config_key TEXT NOT NULL,
      config_value TEXT,
      data_type TEXT DEFAULT 'string',
      is_encrypted INTEGER DEFAULT 0,
      is_public INTEGER DEFAULT 0,
      description TEXT,
      default_value TEXT,
      validation_rule TEXT,
      version INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT,
      UNIQUE(group_key, config_key)
    );
  `)

  // Audit Logs 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      event_category TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      user_id TEXT,
      user_email TEXT,
      ip_address TEXT,
      user_agent TEXT,
      request_path TEXT,
      request_method TEXT,
      resource_type TEXT,
      resource_id TEXT,
      action TEXT,
      result TEXT,
      details TEXT,
      metadata TEXT,
      risk_score INTEGER DEFAULT 0,
      session_id TEXT,
      trace_id TEXT,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  // Rate Limits 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      limit_key TEXT NOT NULL,
      limit_type TEXT NOT NULL,
      resource_type TEXT,
      window_size INTEGER NOT NULL,
      max_requests INTEGER NOT NULL,
      current_requests INTEGER DEFAULT 0,
      blocked_until DATETIME,
      is_whitelist INTEGER DEFAULT 0,
      violation_count INTEGER DEFAULT 0,
      last_violation_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  // Security Tokens 表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS security_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_type TEXT NOT NULL,
      token_id TEXT NOT NULL,
      token_value TEXT,
      token_hash TEXT,
      associated_id TEXT,
      associated_type TEXT,
      purpose TEXT,
      permissions TEXT,
      metadata TEXT,
      is_active INTEGER DEFAULT 1,
      expires_at DATETIME,
      last_used_at DATETIME,
      usage_count INTEGER DEFAULT 0,
      max_usage INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      revoked_at DATETIME,
      revoked_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT
    );
  `)

  // 创建索引（用于性能优化）
  createIndexes()
}

// 创建索引
function createIndexes() {
  console.log('📇 Creating database indexes...')

  // Orders 索引
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_gateway ON orders(gateway);
    CREATE INDEX IF NOT EXISTS idx_orders_gateway_order_id ON orders(gateway_order_id);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_email_status ON orders(email, status);
    CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON orders(status, created_at);
  `)

  // Products 索引
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
    CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products(sort_order);
  `)

  // Product Prices 索引
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_product_prices_product ON product_prices(product_id);
    CREATE INDEX IF NOT EXISTS idx_product_prices_currency ON product_prices(currency);
    CREATE INDEX IF NOT EXISTS idx_product_prices_active ON product_prices(is_active);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_product_prices_unique_currency ON product_prices(product_id, currency);
  `)

  // Deliveries 索引
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON deliveries(order_id);
    CREATE INDEX IF NOT EXISTS idx_deliveries_type ON deliveries(delivery_type);
    CREATE INDEX IF NOT EXISTS idx_deliveries_active ON deliveries(is_active);
  `)

  // Downloads 索引
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_downloads_delivery_id ON downloads(delivery_id);
    CREATE INDEX IF NOT EXISTS idx_downloads_downloaded_at ON downloads(downloaded_at);
    CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(download_status);
  `)

  // Inventory 索引
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_text(product_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_used ON inventory_text(is_used);
    CREATE INDEX IF NOT EXISTS idx_inventory_order ON inventory_text(used_order_id);
  `)

  // Payments Raw 索引
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_payments_raw_gateway ON payments_raw(gateway);
    CREATE INDEX IF NOT EXISTS idx_payments_raw_order_id ON payments_raw(gateway_order_id);
    CREATE INDEX IF NOT EXISTS idx_payments_raw_processed ON payments_raw(processed);
  `)

  console.log('✅ All indexes created successfully')
}

// 数据库健康检查
export async function healthCheck() {
  try {
    const result = sqlite.prepare('SELECT 1 as health').get()
    return result && (result as any).health === 1
  } catch (error) {
    console.error('Database health check failed:', error)
    return false
  }
}

// 数据库统计信息
export async function getDatabaseStats() {
  try {
    const stats = {
      tables: {
        products: db.select({ count: count() }).from(schema.products).get(),
        orders: db.select({ count: count() }).from(schema.orders).get(),
        deliveries: db.select({ count: count() }).from(schema.deliveries).get(),
        downloads: db.select({ count: count() }).from(schema.downloads).get(),
        paymentsRaw: db.select({ count: count() }).from(schema.paymentsRaw).get(),
        inventoryText: db.select({ count: count() }).from(schema.inventoryText).get(),
        adminLogs: db.select({ count: count() }).from(schema.adminLogs).get(),
        files: db.select({ count: count() }).from(schema.files).get(),
      },
      databaseSize: 0, // 可以通过文件系统获取
    }

    return stats
  } catch (error) {
    console.error('Failed to get database stats:', error)
    throw error
  }
}

// 事务辅助函数
export async function withTransaction<T>(callback: () => Promise<T>): Promise<T> {
  const transaction = db.transaction(async () => {
    return await callback()
  })

  try {
    return await transaction()
  } catch (error) {
    console.error('Transaction failed:', error)
    throw error
  }
}

// 基础CRUD操作封装
export class BaseRepository<T extends Record<string, any>> {
  constructor(private table: any) {}

  async create(data: Partial<T>): Promise<T> {
    const result = await db.insert(this.table).values(data as any).returning()
    return result[0] as T
  }

  async findById(id: string | number): Promise<T | null> {
    const result = await db.select().from(this.table).where(eq(this.table.id, id)).limit(1)
    return result[0] || null
  }

  async findOne(conditions: Partial<T>): Promise<T | null> {
    let query = db.select().from(this.table)

    for (const [key, value] of Object.entries(conditions)) {
      if (value !== undefined) {
        query = query.where(eq(this.table[key], value))
      }
    }

    const result = await query.limit(1)
    return result[0] || null
  }

  async findMany(
    conditions: Partial<T> = {},
    options: {
      limit?: number
      offset?: number
      orderBy?: { field: keyof T; direction: 'asc' | 'desc' }
    } = {}
  ): Promise<T[]> {
    let query = db.select().from(this.table)

    // 应用条件
    for (const [key, value] of Object.entries(conditions)) {
      if (value !== undefined) {
        query = query.where(eq(this.table[key], value))
      }
    }

    // 应用排序
    if (options.orderBy) {
      const { field, direction } = options.orderBy
      query = query.orderBy(direction === 'asc' ? asc(this.table[field]) : desc(this.table[field]))
    }

    // 应用分页
    if (options.limit) {
      query = query.limit(options.limit)
    }

    if (options.offset) {
      query = query.offset(options.offset)
    }

    return await query
  }

  async update(id: string | number, data: Partial<T>): Promise<T | null> {
    const result = await db
      .update(this.table)
      .set(data as any)
      .where(eq(this.table.id, id))
      .returning()

    return result[0] || null
  }

  async delete(id: string | number): Promise<boolean> {
    const result = await db.delete(this.table).where(eq(this.table.id, id))
    return result.changes > 0
  }

  async count(conditions: Partial<T> = {}): Promise<number> {
    let query = db.select({ count: count() }).from(this.table)

    for (const [key, value] of Object.entries(conditions)) {
      if (value !== undefined) {
        query = query.where(eq(this.table[key], value))
      }
    }

    const result = await query.get()
    return result?.count || 0
  }
}

// 特定仓储类
export class ProductRepository extends BaseRepository<typeof schema.Product> {
  constructor() {
    super(schema.products)
  }

  async findActive() {
    return await db.select()
      .from(schema.products)
      .where(eq(schema.products.isActive, true))
      .orderBy(asc(schema.products.sortOrder))
  }

  async findWithPrices(productId?: number) {
    let query = db
      .select({
        ...schema.products,
        prices: schema.productPrices,
      })
      .from(schema.products)
      .leftJoin(schema.productPrices, eq(schema.products.id, schema.productPrices.productId))

    if (productId) {
      query = query.where(eq(schema.products.id, productId))
    }

    return await query
  }
}

export class OrderRepository extends BaseRepository<typeof schema.Order> {
  constructor() {
    super(schema.orders)
  }

  async findByEmail(email: string) {
    return await db.select()
      .from(schema.orders)
      .where(eq(schema.orders.email, email))
      .orderBy(desc(schema.orders.createdAt))
  }

  async findByStatus(status: string) {
    return await db.select()
      .from(schema.orders)
      .where(eq(schema.orders.status, status))
      .orderBy(desc(schema.orders.createdAt))
  }

  async findWithDetails(orderId: string) {
    return await db
      .select({
        order: schema.orders,
        product: schema.products,
        delivery: schema.deliveries,
      })
      .from(schema.orders)
      .leftJoin(schema.products, eq(schema.orders.productId, schema.products.id))
      .leftJoin(schema.deliveries, eq(schema.orders.id, schema.deliveries.orderId))
      .where(eq(schema.orders.id, orderId))
      .limit(1)
  }
}

export class InventoryRepository extends BaseRepository<typeof schema.InventoryText> {
  constructor() {
    super(schema.inventoryText)
  }

  async findAvailable(productId: number, limit = 1) {
    return await db.select()
      .from(schema.inventoryText)
      .where(and(
        eq(schema.inventoryText.productId, productId),
        eq(schema.inventoryText.isUsed, false)
      ))
      .orderBy(desc(schema.inventoryText.priority))
      .limit(limit)
  }

  async markAsUsed(id: number, orderId: string) {
    return await db
      .update(schema.inventoryText)
      .set({
        isUsed: true,
        usedOrderId: orderId,
        usedAt: new Date().toISOString(),
      })
      .where(eq(schema.inventoryText.id, id))
      .returning()
  }
}

// 保持原有的initDatabase函数以向后兼容
export function initDatabase() {
  initializeDatabase().then(success => {
    if (success) {
      console.log('Database initialized successfully')
    } else {
      console.error('Database initialization failed')
    }
  })
}

// 创建仓储实例
export const productRepository = new ProductRepository()
export const orderRepository = new OrderRepository()
export const inventoryRepository = new InventoryRepository()

// 导出所有必要的模块
export {
  schema,
  eq,
  and,
  desc,
  asc,
  like,
  count,
}

// 默认导出
export default {
  db,
  sqlite,
  initializeDatabase,
  initDatabase,
  healthCheck,
  getDatabaseStats,
  withTransaction,
  BaseRepository,
  productRepository,
  orderRepository,
  inventoryRepository,
  schema,
}