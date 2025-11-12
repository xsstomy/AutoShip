import { db, schema, withTransaction } from '../db'
import { eq, and, desc, asc } from 'drizzle-orm'
import { OrderStatus, DeliveryType } from '../db/schema'
import { orderService } from './order-service'
import { inventoryService } from './inventory-service'
import { randomUUID } from 'crypto'

// 事务服务类 - 处理复杂的业务逻辑事务
export class TransactionService {
  /**
   * 创建订单并分配库存
   */
  async createOrderWithInventory(orderData: any) {
    return await withTransaction(async () => {
      // 1. 创建订单
      const order = await orderService.createOrder(orderData)

      // 2. 如果产品需要库存，分配库存
      const product = await db.select()
        .from(schema.products)
        .where(eq(schema.products.id, orderData.productId))
        .limit(1)

      if (product.length === 0) {
        throw new Error('Product not found')
      }

      const productInfo = product[0]

      // 3. 检查是否需要分配库存
      if (productInfo.deliveryType === DeliveryType.TEXT || productInfo.deliveryType === DeliveryType.HYBRID) {
        try {
          // 尝试分配库存
          const allocatedInventory = await inventoryService.allocateInventory(
            orderData.productId,
            order.id,
            1
          )

          // 4. 创建发货记录
          const delivery = await db.insert(schema.deliveries)
            .values({
              orderId: order.id,
              deliveryType: productInfo.deliveryType,
              content: allocatedInventory[0]?.content || productInfo.templateText,
              isActive: true,
              createdAt: new Date().toISOString(),
            })
            .returning()

          return {
            order,
            delivery: delivery[0],
            allocatedInventory: allocatedInventory[0],
          }
        } catch (inventoryError) {
          // 如果库存不足，使用模板内容
          console.warn('Inventory allocation failed, using template:', inventoryError)

          const delivery = await db.insert(schema.deliveries)
            .values({
              orderId: order.id,
              deliveryType: productInfo.deliveryType,
              content: productInfo.templateText,
              isActive: true,
              createdAt: new Date().toISOString(),
            })
            .returning()

          return {
            order,
            delivery: delivery[0],
            allocatedInventory: null,
          }
        }
      }

      return { order }
    })
  }

  /**
   * 处理支付成功 - 更新订单状态并创建发货记录
   */
  async processPaymentSuccess(orderId: string, gatewayData?: any) {
    return await withTransaction(async () => {
      // 1. 获取订单信息
      const order = await orderService.getOrderById(orderId)
      if (!order) {
        throw new Error('Order not found')
      }

      if (order.status !== OrderStatus.PENDING) {
        throw new Error(`Order is not pending. Current status: ${order.status}`)
      }

      // 2. 更新订单状态为已支付
      const updatedOrder = await orderService.updateOrderStatus(orderId, OrderStatus.PAID, {
        gatewayData: JSON.stringify(gatewayData),
        paidAt: new Date().toISOString(),
      })

      if (!updatedOrder) {
        throw new Error('Failed to update order status')
      }

      // 3. 获取产品信息
      const product = await db.select()
        .from(schema.products)
        .where(eq(schema.products.id, order.productId))
        .limit(1)

      if (product.length === 0) {
        throw new Error('Product not found')
      }

      const productInfo = product[0]

      // 4. 创建发货记录
      let delivery = null

      if (productInfo.deliveryType === DeliveryType.DOWNLOAD || productInfo.deliveryType === DeliveryType.HYBRID) {
        // 生成下载链接
        const downloadToken = randomUUID().replace(/-/g, '') // 32字符token
        const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() // 72小时后过期

        const deliveryResult = await db.insert(schema.deliveries)
          .values({
            orderId: orderId,
            deliveryType: productInfo.deliveryType,
            downloadToken,
            expiresAt,
            maxDownloads: 3,
            isActive: true,
            createdAt: new Date().toISOString(),
          })
          .returning()

        delivery = deliveryResult[0]
      }

      // 5. 如果是文本发货，分配库存或使用模板
      if (productInfo.deliveryType === DeliveryType.TEXT || productInfo.deliveryType === DeliveryType.HYBRID) {
        let content = productInfo.templateText

        try {
          // 尝试分配库存
          const allocatedInventory = await inventoryService.allocateInventory(
            order.productId,
            orderId,
            1
          )

          content = allocatedInventory[0]?.content || productInfo.templateText
        } catch (inventoryError) {
          console.warn('Inventory allocation failed, using template:', inventoryError)
        }

        const deliveryResult = await db.insert(schema.deliveries)
          .values({
            orderId: orderId,
            deliveryType: productInfo.deliveryType,
            content,
            isActive: true,
            createdAt: new Date().toISOString(),
          })
          .returning()

        delivery = deliveryResult[0]
      }

      // 6. 更新订单状态为已发货
      await orderService.updateOrderStatus(orderId, OrderStatus.DELIVERED, {
        deliveredAt: new Date().toISOString(),
        skipDeliveredAt: true, // 避免重复设置
      })

      return {
        order: updatedOrder,
        delivery,
      }
    })
  }

  /**
   * 处理退款 - 更新订单状态并失效发货记录
   */
  async processRefund(orderId: string, reason?: string) {
    return await withTransaction(async () => {
      // 1. 获取订单信息
      const order = await orderService.getOrderById(orderId)
      if (!order) {
        throw new Error('Order not found')
      }

      if (order.status !== OrderStatus.PAID && order.status !== OrderStatus.DELIVERED) {
        throw new Error(`Order cannot be refunded. Current status: ${order.status}`)
      }

      // 2. 更新订单状态为已退款
      const updatedOrder = await orderService.updateOrderStatus(orderId, OrderStatus.REFUNDED, {
        refundedAt: new Date().toISOString(),
        notes: reason ? `${order.notes || ''}\n[Refund: ${reason}]`.trim() : order.notes,
      })

      if (!updatedOrder) {
        throw new Error('Failed to update order status')
      }

      // 3. 失效发货记录
      await db.update(schema.deliveries)
        .set({
          isActive: false,
        })
        .where(eq(schema.deliveries.orderId, orderId))

      // 4. 释放库存（如果有）
      await inventoryService.releaseInventory(orderId)

      return {
        order: updatedOrder,
      }
    })
  }

  /**
   * 重新发送发货邮件
   */
  async resendDelivery(orderId: string) {
    return await withTransaction(async () => {
      // 1. 获取订单和发货信息
      const orderDetails = await orderService.getOrderWithDetails(orderId)
      if (!orderDetails) {
        throw new Error('Order not found')
      }

      if (!orderDetails.delivery) {
        throw new Error('No delivery found for this order')
      }

      // 2. 检查订单状态
      if (orderDetails.order.status !== OrderStatus.DELIVERED) {
        throw new Error(`Order is not delivered. Current status: ${orderDetails.order.status}`)
      }

      // 3. 重新生成下载token（如果是下载类型）
      if (orderDetails.delivery.deliveryType === DeliveryType.DOWNLOAD) {
        const newDownloadToken = randomUUID().replace(/-/g, '')
        const newExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

        await db.update(schema.deliveries)
          .set({
            downloadToken: newDownloadToken,
            expiresAt: newExpiresAt,
            downloadCount: 0, // 重置下载次数
          })
          .where(eq(schema.deliveries.id, orderDetails.delivery.id))
      }

      // 4. 记录重发操作日志
      await db.insert(schema.adminLogs)
        .values({
          adminEmail: 'system@autoship.com', // 应该从当前登录管理员获取
          action: 'update',
          resourceType: 'delivery',
          resourceId: orderDetails.delivery.id.toString(),
          newValues: JSON.stringify({ action: 'resend', timestamp: new Date().toISOString() }),
          success: true,
          createdAt: new Date().toISOString(),
        })

      // 5. 返回更新后的发货信息
      const updatedDelivery = await db.select()
        .from(schema.deliveries)
        .where(eq(schema.deliveries.id, orderDetails.delivery.id))
        .limit(1)

      return {
        order: orderDetails.order,
        delivery: updatedDelivery[0],
      }
    })
  }

  /**
   * 批量更新库存优先级
   */
  async batchUpdateInventoryPriority(updates: Array<{ id: number; priority: number }>) {
    return await withTransaction(async () => {
      const results = []

      for (const { id, priority } of updates) {
        const result = await db.update(schema.inventoryText)
          .set({ priority })
          .where(eq(schema.inventoryText.id, id))
          .returning()

        results.push(result[0])
      }

      return results
    })
  }

  /**
   * 批量删除过期库存
   */
  async batchDeleteExpiredInventory(productIds: number[] | null = null) {
    return await withTransaction(async () => {
      let whereConditions = [
        eq(schema.inventoryText.isUsed, false),
        `${schema.inventoryText.expiresAt} <= datetime('now')`
      ]

      if (productIds && productIds.length > 0) {
        // 构建IN条件
        const productIdList = productIds.join(',')
        whereConditions.push(`schema.inventory_text.productId IN (${productIdList})`)
      }

      const result = await db.delete(schema.inventoryText)
        .where(and(...whereConditions))

      return result.changes
    })
  }

  /**
   * 批量更新产品价格
   */
  async batchUpdateProductPrices(updates: Array<{ productId: number; currency: string; price: number }>) {
    return await withTransaction(async () => {
      const results = []

      for (const { productId, currency, price } of updates) {
        const result = await db.update(schema.productPrices)
          .set({ price, updatedAt: new Date().toISOString() })
          .where(and(
            eq(schema.productPrices.productId, productId),
            eq(schema.productPrices.currency, currency)
          ))
          .returning()

        if (result.length > 0) {
          results.push(result[0])
        } else {
          // 如果价格不存在，创建新的
          const newPrice = await db.insert(schema.productPrices)
            .values({
              productId,
              currency,
              price,
              isActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
            .returning()

          results.push(newPrice[0])
        }
      }

      return results
    })
  }
}

// 创建事务服务实例
export const transactionService = new TransactionService()

// 默认导出
export default transactionService