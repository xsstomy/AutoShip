import { db, schema, withTransaction } from '../db'
import { eq, and, desc, asc, count, like, inArray, sql } from 'drizzle-orm'
import { DeliveryType, Currency } from '../db/schema'
import { validateProduct, validateProductUpdate, validateProductQuery } from '../db/validation'
import { errors } from '../utils/response'

// 产品服务类
export class ProductService {
  /**
   * 创建新产品
   */
  async createProduct(productData: any) {
    const validatedData = validateProduct(productData)

    const product = await db.insert(schema.products)
      .values(validatedData)
      .returning()

    return product[0]
  }

  /**
   * 根据ID获取产品
   */
  async getProductById(productId: number) {
    const product = await db.select()
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1)

    return product[0] || null
  }

  /**
   * 获取产品详情（包含价格信息）
   */
  async getProductWithPrices(productId: number) {
    const result = await db
      .select({
        product: schema.products,
        price: schema.productPrices,
      })
      .from(schema.products)
      .leftJoin(schema.productPrices, eq(schema.products.id, schema.productPrices.productId))
      .where(and(
        eq(schema.products.id, productId),
        eq(schema.productPrices.isActive, true)
      ))

    if (result.length === 0) {
      return null
    }

    // 组合产品和价格信息
    const product = {
      ...result[0].product,
      prices: result.map(r => r.price).filter(Boolean)
    }

    return product
  }

  /**
   * 获取所有活跃产品（包含价格信息，避免 N+1 查询）
   */
  async getActiveProducts() {
    const result = await db
      .select({
        product: schema.products,
        price: schema.productPrices,
      })
      .from(schema.products)
      .leftJoin(schema.productPrices, and(
        eq(schema.products.id, schema.productPrices.productId),
        eq(schema.productPrices.isActive, true)
      ))
      .where(eq(schema.products.isActive, true))
      .orderBy(asc(schema.products.sortOrder), asc(schema.products.createdAt))

    return this.groupProductsWithPrices(result)
  }

  /**
   * 按产品分组组合数据（私有方法）
   */
  private groupProductsWithPrices(rows: Array<{ product: any; price: any }>) {
    // 边界检查
    if (!rows || rows.length === 0) {
      return []
    }

    const productMap = new Map()

    for (const row of rows) {
      const productId = row.product.id

      if (!productMap.has(productId)) {
        productMap.set(productId, {
          ...row.product,
          prices: []
        })
      }

      if (row.price) {
        const productData = productMap.get(productId)
        productData.prices.push({
          currency: row.price.currency,
          price: row.price.price,
          isActive: row.price.isActive,
        })
      }
    }

    return Array.from(productMap.values())
  }

  /**
   * 查询产品
   */
  async queryProducts(query: any, includePrices = false) {
    const validatedQuery = validateProductQuery(query)
    const { page = 1, limit = 20, offset = 0, isActive, deliveryType, search } = validatedQuery

    let whereConditions = []

    // 构建查询条件
    if (isActive !== undefined) {
      whereConditions.push(eq(schema.products.isActive, isActive))
    }

    if (deliveryType) {
      whereConditions.push(eq(schema.products.deliveryType, deliveryType))
    }

    if (search) {
      // 使用 Drizzle ORM 的 like 操作符，避免直接使用 SQL 模板字符串
      const searchPattern = `%${search}%`
      whereConditions.push(
        like(schema.products.name, searchPattern)
      )
    }

    let products

    if (includePrices) {
      // 使用子查询先分页获取产品ID，再JOIN价格信息（避免内存分页）
      const offsetValue = offset || (page - 1) * limit

      // 先查询分页后的产品
      const paginatedProducts = await db
        .select({
          id: schema.products.id,
          name: schema.products.name,
          description: schema.products.description,
          templateText: schema.products.templateText,
          deliveryType: schema.products.deliveryType,
          isActive: schema.products.isActive,
          sortOrder: schema.products.sortOrder,
          createdAt: schema.products.createdAt,
          updatedAt: schema.products.updatedAt,
        })
        .from(schema.products)
        .where(and(...whereConditions))
        .orderBy(asc(schema.products.sortOrder), desc(schema.products.createdAt))
        .limit(limit)
        .offset(offsetValue)

      if (paginatedProducts.length === 0) {
        products = []
      } else {
        // 根据产品ID查询价格信息
        const productIds = paginatedProducts.map(p => p.id)
        const result = await db
          .select({
            product: schema.products,
            price: schema.productPrices,
          })
          .from(schema.products)
          .leftJoin(schema.productPrices, and(
            eq(schema.products.id, schema.productPrices.productId),
            eq(schema.productPrices.isActive, true)
          ))
          .where(
            inArray(schema.products.id, productIds)
          )

        // 按产品分组组合数据
        products = this.groupProductsWithPrices(result)
      }
    } else {
      // 只查询产品基本信息
      let queryBuilder = db.select().from(schema.products)

      if (whereConditions.length > 0) {
        queryBuilder = queryBuilder.where(and(...whereConditions))
      }

      queryBuilder = queryBuilder
        .orderBy(asc(schema.products.sortOrder), desc(schema.products.createdAt))
        .limit(limit)
        .offset(offset || (page - 1) * limit)

      products = await queryBuilder
    }

    // 获取总数
    let countQuery = db.select({ count: count() }).from(schema.products)
    if (whereConditions.length > 0) {
      countQuery = countQuery.where(and(...whereConditions))
    }

    const totalCountResult = await countQuery
    const total = totalCountResult[0].count

    return {
      products,
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
   * 更新产品信息
   */
  async updateProduct(productId: number, updateData: any) {
    const validatedData = validateProductUpdate(updateData)

    const result = await db.update(schema.products)
      .set({
        ...validatedData,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.products.id, productId))
      .returning()

    return result[0] || null
  }

  /**
   * 删除产品（软删除 - 设置为不活跃）
   */
  async deleteProduct(productId: number) {
    const result = await db.update(schema.products)
      .set({
        isActive: false,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.products.id, productId))
      .returning()

    return result[0] || null
  }

  /**
   * 永久删除产品
   */
  async forceDeleteProduct(productId: number) {
    return await withTransaction(async (tx) => {
      // 首先删除相关的价格记录
      await tx.delete(schema.productPrices)
        .where(eq(schema.productPrices.productId, productId))

      // 然后删除产品
      const result = await tx.delete(schema.products)
        .where(eq(schema.products.id, productId))

      return result.changes > 0
    })
  }

  /**
   * 激活/停用产品
   */
  async toggleProductStatus(productId: number, isActive: boolean) {
    const result = await db.update(schema.products)
      .set({
        isActive,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.products.id, productId))
      .returning()

    return result[0] || null
  }

  /**
   * 添加产品价格
   */
  async addProductPrice(productId: number, priceData: any) {
    const validatedData = {
      productId,
      currency: priceData.currency,
      price: priceData.price,
      isActive: priceData.isActive !== false,
    }

    const price = await db.insert(schema.productPrices)
      .values(validatedData)
      .returning()

    return price[0]
  }

  /**
   * 更新产品价格
   */
  async updateProductPrice(priceId: number, updateData: any) {
    const { currency, price, isActive } = updateData

    const result = await db.update(schema.productPrices)
      .set({
        currency,
        price,
        isActive: isActive !== false,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.productPrices.id, priceId))
      .returning()

    return result[0] || null
  }

  /**
   * 删除产品价格
   */
  async deleteProductPrice(priceId: number) {
    const result = await db.delete(schema.productPrices)
      .where(eq(schema.productPrices.id, priceId))

    return result.changes > 0
  }

  /**
   * 获取产品价格
   */
  async getProductPrice(productId: number, currency: string) {
    const price = await db.select()
      .from(schema.productPrices)
      .where(and(
        eq(schema.productPrices.productId, productId),
        eq(schema.productPrices.currency, currency),
        eq(schema.productPrices.isActive, true)
      ))
      .limit(1)

    return price[0] || null
  }

  /**
   * 获取产品所有价格
   */
  async getProductPrices(productId: number, activeOnly = true) {
    const conditions = [eq(schema.productPrices.productId, productId)]

    if (activeOnly) {
      conditions.push(eq(schema.productPrices.isActive, true))
    }

    return await db.select()
      .from(schema.productPrices)
      .where(and(...conditions))
      .orderBy(asc(schema.productPrices.currency))
  }

  /**
   * 批量更新产品排序
   */
  async updateProductSortOrder(productSortOrders: Array<{ id: number; sortOrder: number }>) {
    return await withTransaction(async (tx) => {
      if (productSortOrders.length === 0) {
        return []
      }

      // 构建 CASE WHEN 更新语句
      const caseWhenClause = productSortOrders
        .map(({ id, sortOrder }) => `WHEN id = ${id} THEN ${sortOrder}`)
        .join(' ')

      const ids = productSortOrders.map(({ id }) => id)

      // 单条 SQL 批量更新
      const result = await tx.execute(sql`
        UPDATE products
        SET sortOrder = CASE ${caseWhenClause} END,
            updatedAt = ${new Date().toISOString()}
        WHERE id = ANY(${ids})
      `)

      // 返回更新后的产品信息
      const updatedProducts = await tx.select()
        .from(schema.products)
        .where(sql`id = ANY(${ids})`)
        .orderBy(sql`array_position(ARRAY[${ids}], id)`)

      return updatedProducts
    })
  }

  /**
   * 检查产品是否存在
   */
  async productExists(productId: number) {
    const count = await this.getCount(eq(schema.products.id, productId))
    return count > 0
  }

  /**
   * 检查产品是否活跃
   */
  async isProductActive(productId: number) {
    const result = await db.select({ isActive: schema.products.isActive })
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1)

    return result[0]?.isActive || false
  }

  /**
   * 获取产品统计信息
   */
  async getProductStats() {
    // 查询总产品数
    const total = await this.getCount()

    // 查询活跃产品数
    const active = await this.getCount(eq(schema.products.isActive, true))

    // 按发货类型分组的统计
    const deliveryTypeStats = await db.select({
      deliveryType: schema.products.deliveryType,
      count: count(),
    })
      .from(schema.products)
      .groupBy(schema.products.deliveryType)

    return {
      total,
      active,
      inactive: total - active,
      byDeliveryType: deliveryTypeStats,
    }
  }

  /**
   * 公共查询方法：获取记录数
   */
  private async getCount(condition?: any) {
    let query = db.select({ count: count() }).from(schema.products)

    if (condition) {
      query = query.where(condition)
    }

    const result = await query
    return result[0].count
  }

  /**
   * 复制产品
   */
  async duplicateProduct(productId: number, newName?: string) {
    const originalProduct = await this.getProductById(productId)
    if (!originalProduct) {
      throw new Error(`PRODUCT_NOT_FOUND: Product with id ${productId} not found`)
    }

    const originalPrices = await this.getProductPrices(productId, false)

    return await withTransaction(async (tx) => {
      // 创建新产品
      const newProduct = await tx.insert(schema.products).values({
        name: newName || `${originalProduct.name} (Copy)`,
        description: originalProduct.description,
        templateText: originalProduct.templateText,
        deliveryType: originalProduct.deliveryType,
        isActive: false, // 复制的产品默认不激活
        sortOrder: originalProduct.sortOrder + 1,
      }).returning()

      // 复制价格信息
      if (originalPrices.length > 0) {
        await Promise.all(
          originalPrices.map(price =>
            tx.insert(schema.productPrices).values({
              productId: newProduct[0].id,
              currency: price.currency,
              price: price.price,
              isActive: price.isActive,
            })
          )
        )
      }

      return newProduct[0]
    })
  }
}

// 创建产品服务实例
export const productService = new ProductService()

// 默认导出
export default productService