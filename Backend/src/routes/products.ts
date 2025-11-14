import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { productService } from '../services/product-service'
import { inventoryService } from '../services/inventory-service'
import { successResponse, errors } from '../utils/response'

const app = new Hono()

/**
 * 商品ID参数验证模式
 */
const productParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, '无效的商品ID').transform(Number),
})

/**
 * 计算库存状态
 */
function getInventoryStatus(count: number): string {
  if (count === 0) {
    return '已售罄'
  } else if (count > 0 && count <= 9) {
    return '库存紧张'
  } else if (count > 9 && count <= 50) {
    return '库存偏低'
  } else {
    return '库存充足'
  }
}

/**
 * 获取激活的商品列表
 * GET /api/v1/products
 */
app.get('/', async (c) => {
  try {
    // 获取激活状态的商品（已优化：避免 N+1 查询）
    const products = await productService.getActiveProductsWithDetails()

    // 为每个商品获取库存统计（每个商品1次查询，而不是2次）
    const productsWithInventory = await Promise.all(
      products.map(async (product) => {
        try {
          // 获取库存统计（已优化：单次查询获取所有统计）
          const inventoryStats = await inventoryService.getInventoryStats(product.id)

          // 计算库存状态
          const inventoryStatus = getInventoryStatus(inventoryStats.available)

          return {
            id: product.id,
            name: product.name,
            description: product.description || '',
            deliveryType: product.deliveryType,
            prices: product.prices || [],
            inventory: {
              available: inventoryStats.available,
              total: inventoryStats.total,
              used: inventoryStats.used,
            },
            inventoryStatus,
            isActive: product.isActive,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
          }
        } catch (error) {
          console.error(`获取商品 ${product.id} 库存失败:`, error)
          // 如果获取库存失败，返回基本信息
          return {
            id: product.id,
            name: product.name,
            description: product.description || '',
            deliveryType: product.deliveryType,
            prices: product.prices || [],
            inventory: {
              available: 0,
              total: 0,
              used: 0,
            },
            inventoryStatus: '库存未知',
            isActive: product.isActive,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
          }
        }
      })
    )

    return successResponse(c, {
      products: productsWithInventory,
      total: productsWithInventory.length,
    })
  } catch (error) {
    console.error('获取商品列表失败:', error)
    return errors.INTERNAL_ERROR(c, '获取商品列表失败，请稍后重试')
  }
})

/**
 * 获取单个商品详情
 * GET /api/v1/products/:id
 */
app.get('/:id', zValidator('param', productParamsSchema), async (c) => {
  try {
    const { id } = c.req.valid('param')

    // 获取商品基本信息
    const product = await productService.getProductById(id)

    if (!product) {
      return errors.PRODUCT_NOT_FOUND(c)
    }

    // 检查商品是否激活
    if (!product.isActive) {
      return errors.PRODUCT_INACTIVE(c)
    }

    try {
      // 获取商品价格
      const prices = await productService.getProductPrices(id, true)

      // 获取库存统计
      const inventoryStats = await inventoryService.getProductInventoryStats(id)

      // 计算库存状态
      const inventoryStatus = getInventoryStatus(inventoryStats.available)

      const productDetails = {
        id: product.id,
        name: product.name,
        description: product.description || '',
        deliveryType: product.deliveryType,
        templateText: product.templateText || '',
        prices: prices.map(price => ({
          currency: price.currency,
          price: price.price,
          isActive: price.isActive,
        })),
        inventory: {
          available: inventoryStats.available,
          total: inventoryStats.total,
          used: inventoryStats.used,
        },
        inventoryStatus,
        isActive: product.isActive,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      }

      return successResponse(c, productDetails)
    } catch (detailError) {
      console.error(`获取商品 ${id} 详情失败:`, detailError)
      // 返回基本信息
      return successResponse(c, {
        id: product.id,
        name: product.name,
        description: product.description || '',
        deliveryType: product.deliveryType,
        prices: [],
        inventory: {
          available: 0,
          total: 0,
          used: 0,
        },
        inventoryStatus: '库存未知',
        isActive: product.isActive,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      })
    }
  } catch (error) {
    console.error('获取商品详情失败:', error)
    return errors.INTERNAL_ERROR(c, '获取商品详情失败，请稍后重试')
  }
})

export default app