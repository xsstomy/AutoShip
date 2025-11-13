import axios, { AxiosError } from 'axios'

/**
 * API 基础配置
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

/**
 * 创建 Axios 实例
 */
const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1/admin`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * 请求拦截器 - 添加认证 token
 */
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

/**
 * 响应拦截器 - 统一错误处理
 */
apiClient.interceptors.response.use(
  (response) => {
    return response
  },
  (error: AxiosError) => {
    console.error('API Error:', error)

    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('请求超时，请稍后重试'))
    }

    if (!error.response) {
      return Promise.reject(new Error('网络连接失败，请检查网络'))
    }

    const status = error.response?.status ?? 500
    const message = (error.response?.data as any)?.error || '请求失败'

    switch (status) {
      case 400:
        return Promise.reject(new Error(`请求参数错误: ${message}`))
      case 401:
        return Promise.reject(new Error('未授权，请重新登录'))
      case 403:
        return Promise.reject(new Error('禁止访问'))
      case 404:
        return Promise.reject(new Error('请求的资源不存在'))
      case 500:
        return Promise.reject(new Error('服务器内部错误'))
      default:
        return Promise.reject(new Error(message))
    }
  }
)

/**
 * 类型定义
 */
export interface InventoryItem {
  id: number
  productId: number
  content: string
  batchName?: string
  priority: number
  isUsed: boolean
  usedOrderId?: string
  usedAt?: string
  expiresAt?: string
  createdAt: string
  createdBy?: string
}

export interface ProductInventory {
  productId: number
  productName: string
  productDescription?: string
  deliveryType: string
  total: number
  available: number
  used: number
  status: 'in_stock' | 'low_stock' | 'out_of_stock'
  statusMessage: string
  lastUpdated: string
}

export interface InventoryStats {
  totalProducts: number
  totalInventoryItems: number
  availableItems: number
  usedItems: number
  lowStockProducts: number
  outOfStockProducts: number
  recentImports: Array<{
    batchName: string
    productId: number
    productName: string
    count: number
    createdAt: string
  }>
}

export interface ImportResult {
  success: boolean
  total: number
  successCount: number
  failedCount: number
  errors: Array<{
    line: number
    content: string
    error: string
  }>
}

/**
 * 获取商品库存列表
 */
export const getInventoryList = async (params: {
  page?: number
  limit?: number
  search?: string
  status?: string
}): Promise<{
  products: ProductInventory[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}> => {
  try {
    const response = await apiClient.get('/inventory', { params })
    if (!response.data.success) {
      throw new Error(response.data.error || '获取库存列表失败')
    }
    return response.data.data
  } catch (error) {
    console.error('获取库存列表失败:', error)
    throw error
  }
}

/**
 * 获取库存详情
 */
export const getInventoryDetail = async (
  productId: number,
  params?: {
    page?: number
    limit?: number
    status?: string
  }
): Promise<{
  product: {
    id: number
    name: string
    deliveryType: string
  }
  inventory: InventoryItem[]
  summary: {
    total: number
    available: number
    used: number
  }
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}> => {
  try {
    const response = await apiClient.get(`/inventory/${productId}`, { params })
    if (!response.data.success) {
      throw new Error(response.data.error || '获取库存详情失败')
    }
    return response.data.data
  } catch (error) {
    console.error('获取库存详情失败:', error)
    throw error
  }
}

/**
 * 批量导入库存
 */
export const importInventory = async (data: {
  productId: number
  content: string
  batchName?: string
  priority?: number
}): Promise<ImportResult> => {
  try {
    const response = await apiClient.post('/inventory/import', data)
    if (!response.data.success) {
      throw new Error(response.data.error || '导入库存失败')
    }
    return response.data.data
  } catch (error) {
    console.error('导入库存失败:', error)
    throw error
  }
}

/**
 * 添加库存
 */
export const addInventory = async (data: {
  productId: number
  content: string
  batchName?: string
  priority?: number
}): Promise<{ count: number }> => {
  try {
    const response = await apiClient.post('/inventory', data)
    if (!response.data.success) {
      throw new Error(response.data.error || '添加库存失败')
    }
    return response.data.data
  } catch (error) {
    console.error('添加库存失败:', error)
    throw error
  }
}

/**
 * 删除库存项
 */
export const deleteInventoryItems = async (
  productId: number,
  itemIds: number[]
): Promise<{ deletedCount: number }> => {
  try {
    const response = await apiClient.delete(`/inventory/${productId}/items`, {
      data: { itemIds },
    })
    if (!response.data.success) {
      throw new Error(response.data.error || '删除库存失败')
    }
    return response.data.data
  } catch (error) {
    console.error('删除库存失败:', error)
    throw error
  }
}

/**
 * 获取库存统计
 */
export const getInventoryStats = async (): Promise<InventoryStats> => {
  try {
    const response = await apiClient.get('/inventory/stats')
    if (!response.data.success) {
      throw new Error(response.data.error || '获取库存统计失败')
    }
    return response.data.data
  } catch (error) {
    console.error('获取库存统计失败:', error)
    throw error
  }
}

/**
 * 扣减库存（下单时调用）
 */
export const deductInventory = async (data: {
  productId: number
  orderId: string
  quantity: number
}): Promise<{ items: InventoryItem[] }> => {
  try {
    const response = await apiClient.post('/inventory/deduct', data)
    if (!response.data.success) {
      throw new Error(response.data.error || '扣减库存失败')
    }
    return response.data.data
  } catch (error) {
    console.error('扣减库存失败:', error)
    throw error
  }
}

/**
 * 返还库存（退款时调用）
 */
export const restockInventory = async (data: {
  productId: number
  orderId: string
}): Promise<{ restockedCount: number }> => {
  try {
    const response = await apiClient.post('/inventory/restock', data)
    if (!response.data.success) {
      throw new Error(response.data.error || '返还库存失败')
    }
    return response.data.data
  } catch (error) {
    console.error('返还库存失败:', error)
    throw error
  }
}
