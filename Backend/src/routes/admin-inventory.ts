import { Hono } from 'hono'
import { z } from 'zod'
import { productService } from '../services/product-service'
import { inventoryService } from '../services/inventory-service'
import { adminAuth } from '../middleware/admin-jwt-auth'
import { getClientIP, sanitizeForLog } from '../utils/auth'
import { AdminEventType, AdminEventCategory } from '../db/schema'

const app = new Hono()

// 库存导入验证模式
const importInventorySchema = z.object({
  productId: z.number().int().positive(),
  content: z.string().min(1),
  batchName: z.string().optional(),
  priority: z.number().int().min(0).max(100).optional(),
})

// 批量删除验证模式
const deleteInventorySchema = z.object({
  itemIds: z.array(z.number().int().positive()).min(1),
})

// 库存扣减验证模式
const deductInventorySchema = z.object({
  productId: z.number().int().positive(),
  orderId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
})

// 库存返还验证模式
const restockSchema = z.object({
  productId: z.number().int().positive(),
  orderId: z.string().min(1),
})

/**
 * 管理员权限验证中间件 - 已使用 adminAuth
 */

/**
 * 获取商品库存列表（带库存状态）
 */
app.get('/inventory', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')
    const search = c.req.query('search') || ''
    const status = c.req.query('status') || 'all'

    // 构建查询条件
    const query: any = {
      page,
      limit,
      offset: (page - 1) * limit,
    }

    if (search) {
      query.search = search
    }

    // 获取商品列表（包含价格信息）
    const productsResult = await productService.queryProducts(query)
    const { products, pagination } = productsResult

    // 为每个商品添加库存统计信息
    const productsWithInventory = await Promise.all(
      products.map(async (product) => {
        const inventoryStats = await inventoryService.getInventoryStats(product.id)

        // 计算库存状态
        let inventoryStatus = 'in_stock'
        let statusMessage = '库存充足'

        if (inventoryStats.available === 0) {
          inventoryStatus = 'out_of_stock'
          statusMessage = '已售罄'
        } else if (inventoryStats.available <= 10) {
          inventoryStatus = 'low_stock'
          statusMessage = '库存偏低'
        }

        // 根据查询参数过滤状态
        if (status !== 'all') {
          if (status === 'in_stock' && inventoryStatus !== 'in_stock') {
            return null
          }
          if (status === 'low_stock' && inventoryStatus !== 'low_stock') {
            return null
          }
          if (status === 'out_of_stock' && inventoryStatus !== 'out_of_stock') {
            return null
          }
        }

        return {
          productId: product.id,
          productName: product.name,
          productDescription: product.description,
          deliveryType: product.deliveryType,
          total: inventoryStats.total,
          available: inventoryStats.available,
          used: inventoryStats.used,
          status: inventoryStatus,
          statusMessage,
          lastUpdated: new Date().toISOString(),
        }
      })
    )

    // 过滤掉 null 值
    const filteredProducts = productsWithInventory.filter(p => p !== null)

    return c.json({
      success: true,
      data: {
        products: filteredProducts,
        pagination,
      },
    })
  } catch (error: any) {
    console.error('获取库存列表失败:', error)
    return c.json(
      { success: false, error: '获取库存列表失败' },
      500
    )
  }
})

/**
 * 获取库存详情
 */
app.get('/inventory/:productId', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const productId = parseInt(c.req.param('productId'))
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '50')
    const status = c.req.query('status') || 'all'

    if (!productId || isNaN(productId)) {
      return c.json({ success: false, error: '无效的商品ID' }, 400)
    }

    // 获取商品信息
    const products = await productService.getProductById(productId)
    if (!products) {
      return c.json({ success: false, error: '商品不存在' }, 404)
    }

    // 构建查询条件
    const query: any = {
      page,
      limit,
      offset: (page - 1) * limit,
      productId,
    }

    if (status !== 'all') {
      query.isUsed = status === 'used'
    }

    // 获取库存列表
    const inventoryResult = await inventoryService.queryInventory(query)
    const { items, pagination } = inventoryResult

    // 获取库存统计
    const stats = await inventoryService.getInventoryStats(productId)

    return c.json({
      success: true,
      data: {
        product: {
          id: products.id,
          name: products.name,
          deliveryType: products.deliveryType,
        },
        inventory: items,
        summary: {
          total: stats.total,
          available: stats.available,
          used: stats.used,
        },
        pagination,
      },
    })
  } catch (error: any) {
    console.error('获取库存详情失败:', error)
    return c.json(
      { success: false, error: '获取库存详情失败' },
      500
    )
  }
})

/**
 * 批量导入库存
 */
app.post('/inventory/import', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const body = await c.req.json()
    const { productId, content, batchName, priority } = importInventorySchema.parse(body)

    // 验证商品是否存在
    const product = await productService.getProductById(productId)
    if (!product) {
      return c.json({ success: false, error: '商品不存在' }, 404)
    }

    const importResult = await inventoryService.importInventory(productId, content, {
      batchName: batchName || `import_${Date.now()}`,
      createdBy: admin.username,
      priority: priority || 0,
    })

    // 统计结果
    const lines = content.split('\n').filter(line => line.trim().length > 0)
    const successCount = importResult.length
    const failedCount = 0 // 当前的实现不会失败（如果失败会抛出异常）

    return c.json({
      success: true,
      data: {
        success: true,
        total: lines.length,
        successCount,
        failedCount,
        errors: [],
      },
    })
  } catch (error: any) {
    console.error('导入库存失败:', error)

    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: '参数验证失败', details: error.errors },
        400
      )
    }

    return c.json(
      { success: false, error: error.message || '导入库存失败' },
      500
    )
  }
})

/**
 * 添加库存
 */
app.post('/inventory', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const body = await c.req.json()
    const { productId, content, batchName, priority } = importInventorySchema.parse(body)

    // 验证商品是否存在
    const product = await productService.getProductById(productId)
    if (!product) {
      return c.json({ success: false, error: '商品不存在' }, 404)
    }

    const lines = content.split('\n').filter(line => line.trim().length > 0)

    if (lines.length === 0) {
      return c.json({ success: false, error: '没有有效的库存内容' }, 400)
    }

    const result = await inventoryService.addInventoryBatch(productId, lines, {
      batchName: batchName || `manual_${Date.now()}`,
      createdBy: admin.username,
      priority: priority || 0,
    })

    return c.json({
      success: true,
      data: {
        count: result.length,
      },
    })
  } catch (error: any) {
    console.error('添加库存失败:', error)

    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: '参数验证失败', details: error.errors },
        400
      )
    }

    return c.json(
      { success: false, error: error.message || '添加库存失败' },
      500
    )
  }
})

/**
 * 删除库存项
 */
app.delete('/inventory/:productId/items', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const productId = parseInt(c.req.param('productId'))
    const body = await c.req.json()
    const { itemIds } = deleteInventorySchema.parse(body)

    if (!productId || isNaN(productId)) {
      return c.json({ success: false, error: '无效的商品ID' }, 400)
    }

    let deletedCount = 0

    // 逐个删除库存项（确保只能删除未使用的）
    for (const itemId of itemIds) {
      const deleted = await inventoryService.deleteInventoryItem(itemId)
      if (deleted) {
        deletedCount++
      }
    }

    return c.json({
      success: true,
      data: {
        deletedCount,
      },
    })
  } catch (error: any) {
    console.error('删除库存失败:', error)

    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: '参数验证失败', details: error.errors },
        400
      )
    }

    return c.json(
      { success: false, error: error.message || '删除库存失败' },
      500
    )
  }
})

/**
 * 获取库存统计
 */
app.get('/inventory/stats', adminAuth, async (c) => {
  try {
    // 获取所有商品
    const allProducts = await productService.queryProducts({ page: 1, limit: 1000 })

    let totalInventoryItems = 0
    let availableItems = 0
    let usedItems = 0
    let lowStockProducts = 0
    let outOfStockProducts = 0
    const recentImports: any[] = []

    // 为每个商品计算库存统计
    for (const product of allProducts.products) {
      const stats = await inventoryService.getInventoryStats(product.id)

      totalInventoryItems += stats.total
      availableItems += stats.available
      usedItems += stats.used

      if (stats.available === 0) {
        outOfStockProducts++
      } else if (stats.available <= 10) {
        lowStockProducts++
      }
    }

    // 获取最近的导入记录
    const recentInventory = await inventoryService.queryInventory({
      page: 1,
      limit: 10,
      expiredOnly: false,
    })

    // 按批次分组最近的导入
    const batchMap = new Map<string, any>()
    for (const item of recentInventory.items) {
      if (item.batchName && !batchMap.has(item.batchName)) {
        batchMap.set(item.batchName, {
          batchName: item.batchName,
          productId: item.productId,
          productName: item.productName || '未知商品',
          count: 0,
          createdAt: item.createdAt,
        })
      }
      if (item.batchName && batchMap.has(item.batchName)) {
        batchMap.get(item.batchName).count++
      }
    }

    // 取前5个最近的批次
    Array.from(batchMap.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .forEach(batch => recentImports.push(batch))

    return c.json({
      success: true,
      data: {
        totalProducts: allProducts.products.length,
        totalInventoryItems,
        availableItems,
        usedItems,
        lowStockProducts,
        outOfStockProducts,
        recentImports,
      },
    })
  } catch (error: any) {
    console.error('获取库存统计失败:', error)
    return c.json(
      { success: false, error: '获取库存统计失败' },
      500
    )
  }
})

/**
 * 扣减库存（下单时调用）
 */
app.post('/inventory/deduct', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const body = await c.req.json()
    const { productId, orderId, quantity } = deductInventorySchema.parse(body)

    // 检查库存是否充足
    const availableItems = await inventoryService.getAvailableInventory(productId, quantity)

    if (availableItems.length < quantity) {
      return c.json(
        {
          success: false,
          error: `库存不足。所需：${quantity}，可用：${availableItems.length}`,
        },
        400
      )
    }

    // 扣减库存
    const items = await inventoryService.allocateInventory(productId, orderId, quantity)

    return c.json({
      success: true,
      data: {
        items,
      },
    })
  } catch (error: any) {
    console.error('扣减库存失败:', error)

    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: '参数验证失败', details: error.errors },
        400
      )
    }

    return c.json(
      { success: false, error: error.message || '扣减库存失败' },
      500
    )
  }
})

/**
 * 返还库存（退款时调用）
 */
app.post('/inventory/restock', adminAuth, async (c) => {
  try {
    const admin = c.get('admin')
    const body = await c.req.json()
    const { productId, orderId } = restockSchema.parse(body)

    // 返还库存
    const items = await inventoryService.releaseInventory(orderId)

    return c.json({
      success: true,
      data: {
        restockedCount: items.length,
      },
    })
  } catch (error: any) {
    console.error('返还库存失败:', error)

    if (error instanceof z.ZodError) {
      return c.json(
        { success: false, error: '参数验证失败', details: error.errors },
        400
      )
    }

    return c.json(
      { success: false, error: error.message || '返还库存失败' },
      500
    )
  }
})

export default app
