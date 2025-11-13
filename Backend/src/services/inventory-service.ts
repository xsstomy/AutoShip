import { db, schema, withTransaction } from '../db'
import { eq, and, desc, asc, count, like, isNull } from 'drizzle-orm'
import { validateInventoryText, validateInventoryTextUpdate } from '../db/validation'
import { randomUUID } from 'crypto'

// 库存服务类
export class InventoryService {
  /**
   * 添加库存文本
   */
  async addInventoryItem(inventoryData: any) {
    const validatedData = validateInventoryText(inventoryData)

    const item = await db.insert(schema.inventoryText)
      .values(validatedData)
      .returning()

    return item[0]
  }

  /**
   * 批量添加库存
   */
  async addInventoryBatch(productId: number, contents: string[], options: any = {}) {
    const { batchName, createdBy, priority = 0, expiresAt } = options

    return await withTransaction(async () => {
      const items = []

      for (const content of contents) {
        const item = await db.insert(schema.inventoryText)
          .values({
            productId,
            content: content.trim(),
            batchName: batchName || `batch_${Date.now()}`,
            priority,
            expiresAt,
            createdBy,
          })
          .returning()

        items.push(item[0])
      }

      return items
    })
  }

  /**
   * 获取可用库存
   */
  async getAvailableInventory(productId: number, limit = 1) {
    const items = await db.select()
      .from(schema.inventoryText)
      .where(and(
        eq(schema.inventoryText.productId, productId),
        eq(schema.inventoryText.isUsed, false),
        // 检查过期时间
        isNull(schema.inventoryText.expiresAt) || `${schema.inventoryText.expiresAt} > datetime('now')`
      ))
      .orderBy(desc(schema.inventoryText.priority), asc(schema.inventoryText.createdAt))
      .limit(limit)

    return items
  }

  /**
   * 分配库存给订单
   */
  async allocateInventory(productId: number, orderId: string, quantity = 1) {
    return await withTransaction(async () => {
      const availableItems = await this.getAvailableInventory(productId, quantity)

      if (availableItems.length < quantity) {
        throw new Error(`Insufficient inventory. Required: ${quantity}, Available: ${availableItems.length}`)
      }

      const allocatedItems = []

      for (const item of availableItems) {
        const updatedItem = await db.update(schema.inventoryText)
          .set({
            isUsed: true,
            usedOrderId: orderId,
            usedAt: new Date().toISOString(),
          })
          .where(eq(schema.inventoryText.id, item.id))
          .returning()

        allocatedItems.push(updatedItem[0])
      }

      return allocatedItems
    })
  }

  /**
   * 释放库存（将已使用的库存重新标记为可用）
   */
  async releaseInventory(orderId: string) {
    return await withTransaction(async () => {
      const result = await db.update(schema.inventoryText)
        .set({
          isUsed: false,
          usedOrderId: null,
          usedAt: null,
        })
        .where(eq(schema.inventoryText.usedOrderId, orderId))
        .returning()

      return result
    })
  }

  /**
   * 获取库存详情
   */
  async getInventoryById(inventoryId: number) {
    const item = await db.select()
      .from(schema.inventoryText)
      .where(eq(schema.inventoryText.id, inventoryId))
      .limit(1)

    return item[0] || null
  }

  /**
   * 获取产品库存统计（别名方法，为了兼容性）
   */
  async getProductInventoryStats(productId: number) {
    return this.getInventoryStats(productId)
  }

  /**
   * 获取最近入库的库存项
   */
  async getRecentInventoryItems(productId: number, limit = 10) {
    const items = await db.select()
      .from(schema.inventoryText)
      .where(eq(schema.inventoryText.productId, productId))
      .orderBy(desc(schema.inventoryText.createdAt))
      .limit(limit)

    return items
  }

  /**
   * 获取产品库存统计
   */
  async getInventoryStats(productId: number) {
    const total = await db.select({ count: count() })
      .from(schema.inventoryText)
      .where(eq(schema.inventoryText.productId, productId))

    const used = await db.select({ count: count() })
      .from(schema.inventoryText)
      .where(and(
        eq(schema.inventoryText.productId, productId),
        eq(schema.inventoryText.isUsed, true)
      ))

    const available = await db.select({ count: count() })
      .from(schema.inventoryText)
      .where(and(
        eq(schema.inventoryText.productId, productId),
        eq(schema.inventoryText.isUsed, false),
        isNull(schema.inventoryText.expiresAt) || `${schema.inventoryText.expiresAt} > datetime('now')`
      ))

    const expired = await db.select({ count: count() })
      .from(schema.inventoryText)
      .where(and(
        eq(schema.inventoryText.productId, productId),
        `${schema.inventoryText.expiresAt} <= datetime('now')`
      ))

    return {
      total: total[0].count,
      used: used[0].count,
      available: available[0].count,
      expired: expired[0].count,
      usageRate: total[0].count > 0 ? (used[0].count / total[0].count) * 100 : 0,
    }
  }

  /**
   * 查询库存
   */
  async queryInventory(query: any) {
    const { page = 1, limit = 20, productId, batchName, isUsed, expiredOnly } = query
    const offset = (page - 1) * limit

    let whereConditions = []

    if (productId) {
      whereConditions.push(eq(schema.inventoryText.productId, productId))
    }

    if (batchName) {
      whereConditions.push(like(schema.inventoryText.batchName, `%${batchName}%`))
    }

    if (isUsed !== undefined) {
      whereConditions.push(eq(schema.inventoryText.isUsed, isUsed))
    }

    if (expiredOnly) {
      whereConditions.push(`${schema.inventoryText.expiresAt} <= datetime('now')`)
    } else {
      whereConditions.push(
        isNull(schema.inventoryText.expiresAt) || `${schema.inventoryText.expiresAt} > datetime('now')`
      )
    }

    let queryBuilder = db
      .select({
        ...schema.inventoryText,
        productName: schema.products.name, // 关联产品名称
      })
      .from(schema.inventoryText)
      .leftJoin(schema.products, eq(schema.inventoryText.productId, schema.products.id))

    if (whereConditions.length > 0) {
      queryBuilder = queryBuilder.where(and(...whereConditions))
    }

    queryBuilder = queryBuilder
      .orderBy(desc(schema.inventoryText.priority), desc(schema.inventoryText.createdAt))
      .limit(limit)
      .offset(offset)

    const items = await queryBuilder

    // 获取总数
    let countQuery = db.select({ count: count() }).from(schema.inventoryText)
    if (whereConditions.length > 0) {
      countQuery = countQuery.where(and(...whereConditions))
    }

    const totalCountResult = await countQuery
    const total = totalCountResult[0].count

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      }
    }
  }

  /**
   * 按批次查询库存
   */
  async getInventoryByBatch(batchName: string) {
    return await db.select()
      .from(schema.inventoryText)
      .where(eq(schema.inventoryText.batchName, batchName))
      .orderBy(asc(schema.inventoryText.createdAt))
  }

  /**
   * 获取批次列表
   */
  async getBatchList() {
    const result = await db
      .select({
        batchName: schema.inventoryText.batchName,
        count: count(),
        usedCount: count(schema.inventoryText.id).filter(eq(schema.inventoryText.isUsed, true)),
        createdAt: schema.inventoryText.createdAt,
      })
      .from(schema.inventoryText)
      .where(eq(schema.inventoryText.batchName, schema.inventoryText.batchName))
      .groupBy(schema.inventoryText.batchName)
      .orderBy(desc(schema.inventoryText.createdAt))

    return result
  }

  /**
   * 更新库存项
   */
  async updateInventoryItem(inventoryId: number, updateData: any) {
    const validatedData = validateInventoryTextUpdate(updateData)

    const result = await db.update(schema.inventoryText)
      .set(validatedData)
      .where(eq(schema.inventoryText.id, inventoryId))
      .returning()

    return result[0] || null
  }

  /**
   * 删除库存项
   */
  async deleteInventoryItem(inventoryId: number) {
    const result = await db.delete(schema.inventoryText)
      .where(and(
        eq(schema.inventoryText.id, inventoryId),
        eq(schema.inventoryText.isUsed, false) // 只能删除未使用的库存
      ))

    return result.changes > 0
  }

  /**
   * 批量删除库存
   */
  async deleteInventoryBatch(batchName: string) {
    const result = await db.delete(schema.inventoryText)
      .where(and(
        eq(schema.inventoryText.batchName, batchName),
        eq(schema.inventoryText.isUsed, false)
      ))

    return result.changes
  }

  /**
   * 清理过期库存
   */
  async cleanupExpiredInventory() {
    const result = await db.delete(schema.inventoryText)
      .where(and(
        eq(schema.inventoryText.isUsed, false),
        `${schema.inventoryText.expiresAt} <= datetime('now')`
      ))

    return result.changes
  }

  /**
   * 导入库存（从CSV或文本）
   */
  async importInventory(productId: number, content: string, options: any = {}) {
    const { batchName, createdBy, lineSeparator = '\n', trimContent = true } = options

    // 分割内容为行
    let lines = content.split(lineSeparator)

    // 去重和清理
    if (trimContent) {
      lines = lines.map(line => line.trim()).filter(line => line.length > 0)
    }

    // 去重
    const uniqueContents = [...new Set(lines)]

    if (uniqueContents.length === 0) {
      throw new Error('No valid content found in the import data')
    }

    return await this.addInventoryBatch(productId, uniqueContents, {
      batchName: batchName || `import_${Date.now()}`,
      createdBy,
    })
  }

  /**
   * 导出库存
   */
  async exportInventory(productId: number, options: any = {}) {
    const { includeUsed = false, batchName } = options

    let whereConditions = [eq(schema.inventoryText.productId, productId)]

    if (!includeUsed) {
      whereConditions.push(eq(schema.inventoryText.isUsed, false))
    }

    if (batchName) {
      whereConditions.push(eq(schema.inventoryText.batchName, batchName))
    }

    const items = await db.select()
      .from(schema.inventoryText)
      .where(and(...whereConditions))
      .orderBy(asc(schema.inventoryText.batchName), asc(schema.inventoryText.createdAt))

    return items
  }

  /**
   * 获取库存使用历史
   */
  async getInventoryUsageHistory(productId: number, options: any = {}) {
    const { page = 1, limit = 50, startDate, endDate } = options
    const offset = (page - 1) * limit

    let whereConditions = [
      eq(schema.inventoryText.productId, productId),
      eq(schema.inventoryText.isUsed, true)
    ]

    if (startDate) {
      whereConditions.push(`${schema.inventoryText.usedAt} >= '${startDate}'`)
    }

    if (endDate) {
      whereConditions.push(`${schema.inventoryText.usedAt} <= '${endDate}'`)
    }

    let queryBuilder = db
      .select({
        ...schema.inventoryText,
        orderEmail: schema.orders.email, // 关联订单邮箱
      })
      .from(schema.inventoryText)
      .leftJoin(schema.orders, eq(schema.inventoryText.usedOrderId, schema.orders.id))

    if (whereConditions.length > 1) {
      queryBuilder = queryBuilder.where(and(...whereConditions))
    }

    const items = await queryBuilder
      .orderBy(desc(schema.inventoryText.usedAt))
      .limit(limit)
      .offset(offset)

    // 获取总数
    let countQuery = db.select({ count: count() })
      .from(schema.inventoryText)
      .where(and(...whereConditions))

    const totalCountResult = await countQuery
    const total = totalCountResult[0].count

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      }
    }
  }

  /**
   * 获取库存预警（低库存提醒）
   */
  async getLowInventoryProducts(threshold = 10) {
    const result = await db
      .select({
        productId: schema.inventoryText.productId,
        productName: schema.products.name,
        availableCount: count(schema.inventoryText.id),
      })
      .from(schema.inventoryText)
      .leftJoin(schema.products, eq(schema.inventoryText.productId, schema.products.id))
      .where(and(
        eq(schema.inventoryText.isUsed, false),
        isNull(schema.inventoryText.expiresAt) || `${schema.inventoryText.expiresAt} > datetime('now')`
      ))
      .groupBy(schema.inventoryText.productId)
      .having(count(schema.inventoryText.id) < threshold)

    return result
  }
}

// 创建库存服务实例
export const inventoryService = new InventoryService()

// 默认导出
export default inventoryService