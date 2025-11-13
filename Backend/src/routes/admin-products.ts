import { Hono } from 'hono'
import { z } from 'zod'
import { productService } from '../services/product-service'
import { inventoryService } from '../services/inventory-service'
import { verifyToken, getClientIP, sanitizeForLog } from '../utils/auth'
import { AdminEventType, AdminEventCategory } from '../db/schema'

const app = new Hono()

// 价格更新验证模式
const updatePriceSchema = z.object({
  productId: z.number().int().positive(),
  prices: z.array(z.object({
    currency: z.string().min(1),
    price: z.number().positive(),
    isActive: z.boolean().optional(),
  })),
})

/**
 * 管理员权限验证中间件
 */
async function requireAdminAuth(c: any, next: () => Promise<void>) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: '未授权访问' }, 401)
  }

  const token = authHeader.substring(7)

  try {
    const decoded = verifyToken(token)
    if (!decoded || decoded.role !== 'admin') {
      return c.json({ error: '权限不足' }, 403)
    }

    // 将管理员信息附加到上下文
    c.set('admin', decoded)
    await next()
  } catch (error) {
    return c.json({ error: '令牌无效或已过期' }, 401)
  }
}

/**
 * 获取商品列表（包含价格和库存信息）
 */
app.get('/products', requireAdminAuth, async (c) => {
  try {
    // 获取查询参数
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')
    const search = c.req.query('search') || ''
    const isActive = c.req.query('isActive')

    // 构建查询条件
    const query: any = {
      page,
      limit,
      offset: (page - 1) * limit,
    }

    if (search) {
      query.search = search
    }

    if (isActive !== undefined && isActive !== null && isActive !== '') {
      query.isActive = isActive === 'true'
    }

    // 获取商品列表（包含价格信息）
    const productsResult = await productService.queryProducts(query)
    const { products, pagination } = productsResult

    // 为每个商品添加库存统计信息
    const productsWithInventory = await Promise.all(
      products.map(async (product) => {
        // 获取库存数量
        const availableInventory = await inventoryService.getAvailableInventory(product.id, 1)
        const totalInventory = await inventoryService.getProductInventoryStats(product.id)

        // 组合商品、价格和库存信息
        const prices = await productService.getProductPrices(product.id)
        const inventoryCount = totalInventory.available

        return {
          ...product,
          prices,
          inventory: {
            available: inventoryCount,
            total: totalInventory.total,
            used: totalInventory.used,
          },
          // 计算库存状态
          inventoryStatus: getInventoryStatus(inventoryCount),
        }
      })
    )

    return c.json({
      success: true,
      data: {
        products: productsWithInventory,
        pagination,
      },
    })
  } catch (error) {
    console.error('获取商品列表失败:', error)
    return c.json({
      success: false,
      error: '获取商品列表失败',
    }, 500)
  }
})

/**
 * 获取单个商品详情（包含价格和库存信息）
 */
app.get('/products/:id', requireAdminAuth, async (c) => {
  try {
    const productId = parseInt(c.req.param('id'))

    if (isNaN(productId)) {
      return c.json({ error: '无效的商品ID' }, 400)
    }

    // 获取商品信息
    const product = await productService.getProductById(productId)
    if (!product) {
      return c.json({ error: '商品不存在' }, 404)
    }

    // 获取价格信息
    const prices = await productService.getProductPrices(productId)

    // 获取库存信息
    const inventoryStats = await inventoryService.getProductInventoryStats(productId)

    return c.json({
      success: true,
      data: {
        ...product,
        prices,
        inventory: inventoryStats,
        inventoryStatus: getInventoryStatus(inventoryStats.available),
      },
    })
  } catch (error) {
    console.error('获取商品详情失败:', error)
    return c.json({
      success: false,
      error: '获取商品详情失败',
    }, 500)
  }
})

/**
 * 更新商品价格
 */
app.put('/products/:id/prices', requireAdminAuth, async (c) => {
  const admin = c.get('admin')
  const clientIP = getClientIP(c.req)

  try {
    const body = await c.req.json()
    const { prices } = updatePriceSchema.parse(body)
    const productId = parseInt(c.req.param('id'))

    if (isNaN(productId)) {
      return c.json({ error: '无效的商品ID' }, 400)
    }

    // 验证商品是否存在
    const product = await productService.getProductById(productId)
    if (!product) {
      return c.json({ error: '商品不存在' }, 404)
    }

    // 获取现有价格
    const existingPrices = await productService.getProductPrices(productId, false)

    // 更新价格
    const updatePromises = prices.map(async (priceData) => {
      const existingPrice = existingPrices.find(
        (p) => p.currency === priceData.currency
      )

      if (existingPrice) {
        // 更新现有价格
        return productService.updateProductPrice(existingPrice.id, priceData)
      } else {
        // 添加新价格
        return productService.addProductPrice(productId, priceData)
      }
    })

    await Promise.all(updatePromises)

    // 记录管理员操作日志
    console.log(`管理员 ${admin.username} 在 ${clientIP} 更新了商品 ${product.name} 的价格`, {
      eventType: AdminEventType.PRODUCT_UPDATE,
      eventCategory: AdminEventCategory.PRODUCT_MANAGEMENT,
      details: {
        productId,
        currencies: prices.map((p) => p.currency),
      },
    })

    // 获取更新后的商品信息
    const updatedPrices = await productService.getProductPrices(productId)

    return c.json({
      success: true,
      message: '价格更新成功',
      data: {
        productId,
        prices: updatedPrices,
      },
    })
  } catch (error) {
    console.error('更新商品价格失败:', error)

    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: '输入数据无效',
        details: error.errors,
      }, 400)
    }

    return c.json({
      success: false,
      error: '更新商品价格失败',
    }, 500)
  }
})

/**
 * 获取商品库存详情
 */
app.get('/products/:id/inventory', requireAdminAuth, async (c) => {
  try {
    const productId = parseInt(c.req.param('id'))

    if (isNaN(productId)) {
      return c.json({ error: '无效的商品ID' }, 400)
    }

    // 验证商品是否存在
    const product = await productService.getProductById(productId)
    if (!product) {
      return c.json({ error: '商品不存在' }, 404)
    }

    // 获取库存统计
    const stats = await inventoryService.getProductInventoryStats(productId)

    // 获取最近入库的库存项
    const recentItems = await inventoryService.getRecentInventoryItems(productId, 10)

    return c.json({
      success: true,
      data: {
        productId,
        productName: product.name,
        stats,
        recentItems,
        inventoryStatus: getInventoryStatus(stats.available),
      },
    })
  } catch (error) {
    console.error('获取商品库存失败:', error)
    return c.json({
      success: false,
      error: '获取商品库存失败',
    }, 500)
  }
})

/**
 * 获取库存预警列表
 */
app.get('/inventory/low-stock', requireAdminAuth, async (c) => {
  try {
    // 获取所有商品
    const products = await productService.getActiveProducts()
    const lowStockProducts = []

    for (const product of products) {
      const stats = await inventoryService.getProductInventoryStats(product.id)
      const status = getInventoryStatus(stats.available)

      if (status === '库存紧张' || status === '已售罄') {
        lowStockProducts.push({
          ...product,
          inventory: stats,
          inventoryStatus: status,
        })
      }
    }

    return c.json({
      success: true,
      data: {
        products: lowStockProducts,
        count: lowStockProducts.length,
      },
    })
  } catch (error) {
    console.error('获取库存预警失败:', error)
    return c.json({
      success: false,
      error: '获取库存预警失败',
    }, 500)
  }
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

export default app
