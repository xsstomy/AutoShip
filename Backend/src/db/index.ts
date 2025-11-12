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

    // 创建表（如果不存在）
    // 注意：在实际部署中，应该使用迁移脚本
    console.log('📋 Database initialized successfully')

    return true
  } catch (error) {
    console.error('❌ Failed to initialize database:', error)
    return false
  }
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
  db,
  sqlite,
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