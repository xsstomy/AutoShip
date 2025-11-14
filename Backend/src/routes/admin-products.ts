import { Hono } from 'hono'
import { z } from 'zod'
import { productService } from '../services/product-service'
import { inventoryService } from '../services/inventory-service'
import { adminAuth } from '../middleware/admin-jwt-auth'
import { getClientIP, sanitizeForLog } from '../utils/auth'
import { AdminEventType, AdminEventCategory } from '../db/schema'
import { validateProduct, validateProductPrice } from '../db/validation'

const app = new Hono()

// 价格更新验证模式
const updatePriceSchema = z.object({
  prices: z.array(z.object({
    currency: z.string().min(1),
    price: z.number().positive(),
    isActive: z.boolean().optional(),
  })),
})

// 商品状态更新验证模式
const updateProductStatusSchema = z.object({
  isActive: z.boolean(),
})

// 批量状态更新验证模式
const batchUpdateStatusSchema = z.object({
  productIds: z.array(z.number().int().positive()).min(1, '至少需要选择一个商品'),
  isActive: z.boolean(),
})

// 商品创建验证模式（包含价格）
const createProductWithPricesSchema = z.object({
  name: z.string().min(1, '商品名称不能为空').max(255, '商品名称过长'),
  description: z.string().max(2000, '描述过长').optional(),
  deliveryType: z.enum(['text', 'download', 'hybrid']),
  templateText: z.string().optional(),
  prices: z.array(z.object({
    currency: z.string().min(1, '货币不能为空'),
    price: z.number().positive('价格必须大于0'),
    isActive: z.boolean().optional(),
  })).min(1, '至少需要设置一个价格'),
})


/**
 * 创建新商品
 */
app.post('/products', adminAuth, async (c) => {
  const admin = c.get('admin')
  const clientIP = getClientIP(c.req)

  try {
    const body = await c.req.json()
    const validatedData = createProductWithPricesSchema.parse(body)

    // 创建商品基本信息
    const productData = {
      name: validatedData.name,
      description: validatedData.description || '',
      deliveryType: validatedData.deliveryType,
      templateText: validatedData.templateText || '',
      isActive: true,
      sortOrder: 0,
    }

    // 创建商品
    const newProduct = await productService.createProduct(productData)

    // 设置商品价格
    const pricePromises = validatedData.prices.map(async (priceData) => {
      return productService.addProductPrice(newProduct.id, {
        currency: priceData.currency,
        price: priceData.price,
        isActive: priceData.isActive !== false,
      })
    })

    await Promise.all(pricePromises)

    // 记录管理员操作日志
    console.log(`管理员 ${admin.username} 在 ${clientIP} 创建了新商品: ${newProduct.name}`, {
      eventType: AdminEventType.PRODUCT_CREATE,
      eventCategory: AdminEventCategory.PRODUCT_MANAGEMENT,
      details: {
        productId: newProduct.id,
        productName: newProduct.name,
        deliveryType: newProduct.deliveryType,
        currencies: validatedData.prices.map(p => p.currency),
      },
    })

    // 获取创建后的完整商品信息
    const productWithPrices = await productService.getProductWithPrices(newProduct.id)

    return c.json({
      success: true,
      message: '商品创建成功',
      data: productWithPrices,
    })
  } catch (error) {
    console.error('创建商品失败:', error)

    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: '输入数据无效',
        details: error.errors,
      }, 400)
    }

    return c.json({
      success: false,
      error: '创建商品失败',
    }, 500)
  }
})

/**
 * 获取商品列表（包含价格和库存信息）
 */
app.get('/products', adminAuth, async (c) => {
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
app.get('/products/:id', adminAuth, async (c) => {
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
app.put('/products/:id/prices', adminAuth, async (c) => {
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
app.get('/products/:id/inventory', adminAuth, async (c) => {
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
app.get('/inventory/low-stock', adminAuth, async (c) => {
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
 * 更新商品状态
 */
app.patch('/products/:id/status', adminAuth, async (c) => {
  const admin = c.get('admin')
  const clientIP = getClientIP(c.req)

  try {
    const productId = parseInt(c.req.param('id'))
    const body = await c.req.json()
    const { isActive } = updateProductStatusSchema.parse(body)

    if (isNaN(productId)) {
      return c.json({ error: '无效的商品ID' }, 400)
    }

    // 验证商品是否存在
    const product = await productService.getProductById(productId)
    if (!product) {
      return c.json({ error: '商品不存在' }, 404)
    }

    // 更新商品状态
    const updatedProduct = await productService.updateProduct(productId, {
      isActive,
      updatedAt: new Date(),
    })

    // 记录管理员操作日志
    const action = isActive ? '上架' : '下架'
    console.log(`管理员 ${admin.username} 在 ${clientIP} 将商品 ${product.name} ${action}`, {
      eventType: AdminEventType.PRODUCT_UPDATE,
      eventCategory: AdminEventCategory.PRODUCT_MANAGEMENT,
      details: {
        productId,
        productName: product.name,
        action,
        newStatus: isActive,
      },
    })

    return c.json({
      success: true,
      message: `商品${action}成功`,
      data: {
        productId,
        isActive,
        productName: product.name,
      },
    })
  } catch (error) {
    console.error('更新商品状态失败:', error)

    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: '输入数据无效',
        details: error.errors,
      }, 400)
    }

    return c.json({
      success: false,
      error: '更新商品状态失败',
    }, 500)
  }
})

/**
 * 批量更新商品状态
 */
app.post('/products/batch-status', adminAuth, async (c) => {
  const admin = c.get('admin')
  const clientIP = getClientIP(c.req)

  try {
    const body = await c.req.json()
    const { productIds, isActive } = batchUpdateStatusSchema.parse(body)

    // 验证所有商品是否存在
    const products = await Promise.all(
      productIds.map(async (id) => {
        const product = await productService.getProductById(id)
        return product ? { id, name: product.name } : null
      })
    )

    const invalidProducts = products.filter(p => p === null)
    if (invalidProducts.length > 0) {
      return c.json({
        success: false,
        error: '部分商品不存在',
        details: {
          invalidIds: productIds.filter((_, index) => products[index] === null)
        }
      }, 400)
    }

    // 批量更新商品状态
    const updatePromises = productIds.map(async (productId) => {
      return productService.updateProduct(productId, {
        isActive,
        updatedAt: new Date(),
      })
    })

    const results = await Promise.allSettled(updatePromises)

    // 统计成功和失败的数量
    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    // 记录管理员操作日志
    const action = isActive ? '批量上架' : '批量下架'
    const productNames = products.filter(p => p !== null).map(p => p!.name)
    console.log(`管理员 ${admin.username} 在 ${clientIP} ${action}了 ${successful} 个商品: ${productNames.join(', ')}`, {
      eventType: AdminEventType.PRODUCT_UPDATE,
      eventCategory: AdminEventCategory.PRODUCT_MANAGEMENT,
      details: {
        productIds,
        action,
        newStatus: isActive,
        successful,
        failed,
      },
    })

    if (failed === 0) {
      return c.json({
        success: true,
        message: `${action}成功`,
        data: {
          total: productIds.length,
          successful,
          failed,
          productNames,
        },
      })
    } else {
      return c.json({
        success: false,
        message: `${action}部分成功`,
        data: {
          total: productIds.length,
          successful,
          failed,
        },
      }, 207) // 207 Multi-Status
    }
  } catch (error) {
    console.error('批量更新商品状态失败:', error)

    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: '输入数据无效',
        details: error.errors,
      }, 400)
    }

    return c.json({
      success: false,
      error: '批量更新商品状态失败',
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
