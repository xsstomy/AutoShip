import { db, schema, withTransaction } from '../db'
import { eq, and, desc, asc, count, like } from 'drizzle-orm'
import { DeliveryType, Currency } from '../db/schema'
import { validateProduct, validateProductUpdate, validateProductQuery } from '../db/validation'

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
   * 获取所有活跃产品
   */
  async getActiveProducts() {
    const products = await db.select()
      .from(schema.products)
      .where(eq(schema.products.isActive, true))
      .orderBy(asc(schema.products.sortOrder), asc(schema.products.createdAt))

    // 为每个产品获取价格信息
    const productsWithPrices = await Promise.all(
      products.map(async (product) => {
        const prices = await db.select()
          .from(schema.productPrices)
          .where(and(
            eq(schema.productPrices.productId, product.id),
            eq(schema.productPrices.isActive, true)
          ))

        return {
          ...product,
          prices
        }
      })
    )

    return productsWithPrices
  }

  /**
   * 查询产品
   */
  async queryProducts(query: any) {
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
      whereConditions.push(
        like(schema.products.name, `%${search}%`)
      )
    }

    let queryBuilder = db.select().from(schema.products)

    if (whereConditions.length > 0) {
      queryBuilder = queryBuilder.where(and(...whereConditions))
    }

    queryBuilder = queryBuilder
      .orderBy(asc(schema.products.sortOrder), desc(schema.products.createdAt))
      .limit(limit)
      .offset(offset || (page - 1) * limit)

    const products = await queryBuilder

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
    // 首先删除相关的价格记录
    await db.delete(schema.productPrices)
      .where(eq(schema.productPrices.productId, productId))

    // 然后删除产品
    const result = await db.delete(schema.products)
      .where(eq(schema.products.id, productId))

    return result.changes > 0
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
    let query = db.select()
      .from(schema.productPrices)
      .where(eq(schema.productPrices.productId, productId))

    if (activeOnly) {
      query = query.where(eq(schema.productPrices.isActive, true))
    }

    return await query.orderBy(asc(schema.productPrices.currency))
  }

  /**
   * 批量更新产品排序
   */
  async updateProductSortOrder(productSortOrders: Array<{ id: number; sortOrder: number }>) {
    return await withTransaction(async () => {
      const results = []

      for (const { id, sortOrder } of productSortOrders) {
        const result = await db.update(schema.products)
          .set({
            sortOrder,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.products.id, id))
          .returning()

        results.push(result[0])
      }

      return results
    })
  }

  /**
   * 检查产品是否存在
   */
  async productExists(productId: number) {
    const result = await db.select({ count: count() })
      .from(schema.products)
      .where(eq(schema.products.id, productId))

    return result[0].count > 0
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
    // 总产品数
    const totalProducts = await db.select({ count: count() })
      .from(schema.products)

    // 活跃产品数
    const activeProducts = await db.select({ count: count() })
      .from(schema.products)
      .where(eq(schema.products.isActive, true))

    // 按发货类型分组
    const deliveryTypeStats = await db.select({
      deliveryType: schema.products.deliveryType,
      count: count(),
    })
      .from(schema.products)
      .groupBy(schema.products.deliveryType)

    return {
      total: totalProducts[0].count,
      active: activeProducts[0].count,
      inactive: totalProducts[0].count - activeProducts[0].count,
      byDeliveryType: deliveryTypeStats,
    }
  }

  /**
   * 复制产品
   */
  async duplicateProduct(productId: number, newName?: string) {
    const originalProduct = await this.getProductById(productId)
    if (!originalProduct) {
      throw new Error('Product not found')
    }

    const originalPrices = await this.getProductPrices(productId)

    return await withTransaction(async () => {
      // 创建新产品
      const newProduct = await this.createProduct({
        name: newName || `${originalProduct.name} (Copy)`,
        description: originalProduct.description,
        templateText: originalProduct.templateText,
        deliveryType: originalProduct.deliveryType,
        isActive: false, // 复制的产品默认不激活
        sortOrder: originalProduct.sortOrder + 1,
      })

      // 复制价格信息
      if (originalPrices.length > 0) {
        await Promise.all(
          originalPrices.map(price =>
            this.addProductPrice(newProduct.id, {
              currency: price.currency,
              price: price.price,
              isActive: price.isActive,
            })
          )
        )
      }

      return newProduct
    })
  }
}

// 创建产品服务实例
export const productService = new ProductService()

// 默认导出
export default productService