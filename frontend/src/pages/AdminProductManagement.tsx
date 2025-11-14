import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import ProductStatusBadge from '../components/ProductStatusBadge'
import ProductStatusToggle from '../components/ProductStatusToggle'
import StatusConfirmDialog from '../components/StatusConfirmDialog'
import BatchStatusConfirmDialog from '../components/BatchStatusConfirmDialog'

interface Product {
  id: number
  name: string
  description: string | null
  deliveryType: string
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
  prices: Array<{
    id: number
    currency: string
    price: number
    isActive: boolean
  }>
  inventory: {
    available: number
    total: number
    used: number
  }
  inventoryStatus: string
}

interface ProductResponse {
  success: boolean
  data: {
    products: Product[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
      hasNext: boolean
      hasPrev: boolean
    }
  }
}

interface EditPriceModalProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
  onSave: (productId: number, prices: { currency: string; price: number; isActive?: boolean }[]) => Promise<void>
}

function EditPriceModal({ product, isOpen, onClose, onSave }: EditPriceModalProps) {
  const [cnyPrice, setCnyPrice] = useState('')
  const [usdPrice, setUsdPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (product) {
      const cnyPriceData = product.prices.find((p) => p.currency === 'CNY')
      const usdPriceData = product.prices.find((p) => p.currency === 'USD')
      setCnyPrice(cnyPriceData?.price?.toString() || '')
      setUsdPrice(usdPriceData?.price?.toString() || '')
      setError('')
    }
  }, [product])

  if (!isOpen || !product) return null

  const handleSave = async () => {
    setError('')
    setLoading(true)

    try {
      // 验证价格格式
      const prices = []

      if (cnyPrice) {
        const price = parseFloat(cnyPrice)
        if (isNaN(price) || price <= 0) {
          throw new Error('CNY价格必须是正数')
        }
        prices.push({ currency: 'CNY', price, isActive: true })
      }

      if (usdPrice) {
        const price = parseFloat(usdPrice)
        if (isNaN(price) || price <= 0) {
          throw new Error('USD价格必须是正数')
        }
        prices.push({ currency: 'USD', price, isActive: true })
      }

      if (prices.length === 0) {
        throw new Error('请至少输入一个有效价格')
      }

      await onSave(product.id, prices)
      onClose()
    } catch (err: any) {
      setError(err.message || '保存失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">编辑商品价格</h3>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            商品名称
          </label>
          <p className="text-gray-900 font-medium">{product.name}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CNY 价格 (¥)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={cnyPrice}
              onChange={(e) => setCnyPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入价格"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              USD 价格 ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={usdPrice}
              onChange={(e) => setUsdPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入价格"
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface CreateProductModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (productData: {
    name: string
    description?: string
    deliveryType: string
    templateText?: string
    prices: { currency: string; price: number; isActive?: boolean }[]
  }) => Promise<void>
}

function CreateProductModal({ isOpen, onClose, onCreate }: CreateProductModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [deliveryType, setDeliveryType] = useState<'text' | 'download' | 'hybrid'>('text')
  const [templateText, setTemplateText] = useState('')
  const [cnyPrice, setCnyPrice] = useState('')
  const [usdPrice, setUsdPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const resetForm = () => {
    setName('')
    setDescription('')
    setDeliveryType('text')
    setTemplateText('')
    setCnyPrice('')
    setUsdPrice('')
    setError('')
  }

  useEffect(() => {
    if (isOpen) {
      resetForm()
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleCreate = async () => {
    setError('')
    setLoading(true)

    try {
      // 验证商品名称
      if (!name.trim()) {
        throw new Error('请输入商品名称')
      }

      // 验证价格
      const prices = []

      if (cnyPrice) {
        const price = parseFloat(cnyPrice)
        if (isNaN(price) || price <= 0) {
          throw new Error('CNY价格必须是正数')
        }
        prices.push({ currency: 'CNY', price, isActive: true })
      }

      if (usdPrice) {
        const price = parseFloat(usdPrice)
        if (isNaN(price) || price <= 0) {
          throw new Error('USD价格必须是正数')
        }
        prices.push({ currency: 'USD', price, isActive: true })
      }

      if (prices.length === 0) {
        throw new Error('请至少设置一个价格')
      }

      const productData = {
        name: name.trim(),
        description: description.trim() || undefined,
        deliveryType,
        templateText: templateText.trim() || undefined,
        prices,
      }

      await onCreate(productData)
      onClose()
    } catch (err: any) {
      setError(err.message || '创建失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">创建新商品</h3>

        <div className="space-y-4">
          {/* 商品名称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              商品名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入商品名称"
              maxLength={255}
            />
          </div>

          {/* 商品描述 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              商品描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="请输入商品描述（可选）"
              rows={3}
              maxLength={2000}
            />
          </div>

          {/* 发货类型 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              发货类型 <span className="text-red-500">*</span>
            </label>
            <select
              value={deliveryType}
              onChange={(e) => setDeliveryType(e.target.value as 'text' | 'download' | 'hybrid')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="text">文本发货</option>
              <option value="download">下载发货</option>
              <option value="hybrid">混合发货</option>
            </select>
          </div>

          {/* 模板文本 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              模板文本
            </label>
            <textarea
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="自动发货的模板文本（可选）"
              rows={4}
            />
          </div>

          {/* 价格设置 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              价格设置 <span className="text-red-500">*</span>
            </label>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">CNY 价格 (¥)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cnyPrice}
                  onChange={(e) => setCnyPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入 CNY 价格"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">USD 价格 ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={usdPrice}
                  onChange={(e) => setUsdPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入 USD 价格"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">至少需要设置一个价格</p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
          >
            {loading ? '创建中...' : '创建商品'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminProductManagement() {
  const { admin, token } = useAuth()
  const navigate = useNavigate()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [savingPrice, setSavingPrice] = useState(false)
  const [creatingProduct, setCreatingProduct] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')

  // 状态操作相关状态
  const [statusDialog, setStatusDialog] = useState<{
    isOpen: boolean
    productId: number | null
    productName: string
    isActive: boolean
  }>({
    isOpen: false,
    productId: null,
    productName: '',
    isActive: false
  })
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  // 批量选择相关状态
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const [batchDialog, setBatchDialog] = useState<{
    isOpen: boolean
    isActive: boolean
    selectedCount: number
  }>({
    isOpen: false,
    isActive: false,
    selectedCount: 0
  })

  const fetchProducts = async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      })

      if (searchTerm) {
        params.append('search', searchTerm)
      }

      if (filterActive !== 'all') {
        params.append('isActive', filterActive === 'active' ? 'true' : 'false')
      }

      const response = await fetch(`/api/v1/admin/products?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/admin/login')
          return
        }
        throw new Error('获取商品列表失败')
      }

      const data: ProductResponse = await response.json()

      if (data.success) {
        setProducts(data.data.products)
        setTotalPages(data.data.pagination.totalPages)
      } else {
        throw new Error(data.error || '获取商品列表失败')
      }
    } catch (err: any) {
      setError(err.message || '加载失败')
      console.error('Error fetching products:', err)
    } finally {
      setLoading(false)
    }
  }

  // 初始加载和页面/筛选变化时的加载
  useEffect(() => {
    if (!admin) {
      navigate('/admin/login')
      return
    }
    fetchProducts()
  }, [admin, navigate, page, filterActive])

  // 监听搜索词变化，自动触发搜索（带防抖）
  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (page === 1) {
        fetchProducts()
      } else {
        setPage(1)
      }
    }, 500)

    return () => clearTimeout(delayedSearch)
  }, [searchTerm])

  const handleEditPrice = (product: Product) => {
    setEditingProduct(product)
    setShowEditModal(true)
  }

  const handleSavePrice = async (productId: number, prices: { currency: string; price: number; isActive?: boolean }[]) => {
    setSavingPrice(true)

    try {
      const response = await fetch(`/api/v1/admin/products/${productId}/prices`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prices }),
      })

      if (!response.ok) {
        throw new Error('更新价格失败')
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || '更新价格失败')
      }

      // 刷新商品列表
      fetchProducts()

      // 显示成功消息
      setSuccessMessage('价格更新成功！')
      setTimeout(() => {
        setSuccessMessage('')
      }, 3000)
    } catch (err: any) {
      setError(err.message || '更新价格失败')
      console.error('Error saving price:', err)
    } finally {
      setSavingPrice(false)
    }
  }

  const handleCreateProduct = async (productData: {
    name: string
    description?: string
    deliveryType: string
    templateText?: string
    prices: { currency: string; price: number; isActive?: boolean }[]
  }) => {
    setCreatingProduct(true)

    try {
      const response = await fetch('/api/v1/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(productData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '创建商品失败')
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || '创建商品失败')
      }

      // 刷新商品列表
      fetchProducts()

      // 显示成功消息
      setSuccessMessage('商品创建成功！')
      setTimeout(() => {
        setSuccessMessage('')
      }, 3000)
    } catch (err: any) {
      setError(err.message || '创建商品失败')
      console.error('Error creating product:', err)
      throw err
    } finally {
      setCreatingProduct(false)
    }
  }

  // 处理状态切换
  const handleStatusToggle = (productId: number, newStatus: boolean) => {
    const product = products.find(p => p.id === productId)
    if (!product) return

    setStatusDialog({
      isOpen: true,
      productId,
      productName: product.name,
      isActive: newStatus
    })
  }

  // 确认状态更新
  const handleConfirmStatusUpdate = async () => {
    if (!statusDialog.productId) return

    setUpdatingStatus(true)

    try {
      const response = await fetch(`/api/v1/admin/products/${statusDialog.productId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isActive: statusDialog.isActive
        }),
      })

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/admin/login')
          return
        }
        throw new Error('更新商品状态失败')
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || '更新商品状态失败')
      }

      // 关闭对话框
      setStatusDialog({
        isOpen: false,
        productId: null,
        productName: '',
        isActive: false
      })

      // 显示成功消息
      setSuccessMessage(data.message || '状态更新成功')

      // 3秒后清除成功消息
      setTimeout(() => {
        setSuccessMessage('')
      }, 3000)

      // 刷新商品列表
      fetchProducts()
    } catch (err: any) {
      setError(err.message || '更新商品状态失败')
      console.error('Error updating product status:', err)
    } finally {
      setUpdatingStatus(false)
    }
  }

  // 批量选择处理函数
  const handleSelectProduct = (productId: number, checked: boolean) => {
    const newSelected = new Set(selectedProducts)
    if (checked) {
      newSelected.add(productId)
    } else {
      newSelected.delete(productId)
    }
    setSelectedProducts(newSelected)

    // 更新全选状态
    if (newSelected.size === products.length) {
      setSelectAll(true)
    } else {
      setSelectAll(false)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked)
    if (checked) {
      setSelectedProducts(new Set(products.map(p => p.id)))
    } else {
      setSelectedProducts(new Set())
    }
  }

  const handleBatchStatusToggle = (isActive: boolean) => {
    if (selectedProducts.size === 0) return

    setBatchDialog({
      isOpen: true,
      isActive,
      selectedCount: selectedProducts.size
    })
  }

  const handleConfirmBatchUpdate = async () => {
    if (selectedProducts.size === 0) return

    setUpdatingStatus(true)

    try {
      const response = await fetch('/api/v1/admin/products/batch-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productIds: Array.from(selectedProducts),
          isActive: batchDialog.isActive
        }),
      })

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/admin/login')
          return
        }
        throw new Error('批量更新商品状态失败')
      }

      const data = await response.json()

      // 关闭对话框
      setBatchDialog({
        isOpen: false,
        isActive: false,
        selectedCount: 0
      })

      // 清空选择
      setSelectedProducts(new Set())
      setSelectAll(false)

      // 显示成功消息
      setSuccessMessage(data.message || '批量操作成功')

      // 3秒后清除成功消息
      setTimeout(() => {
        setSuccessMessage('')
      }, 3000)

      // 刷新商品列表
      fetchProducts()
    } catch (err: any) {
      setError(err.message || '批量更新商品状态失败')
      console.error('Error batch updating product status:', err)
    } finally {
      setUpdatingStatus(false)
    }
  }

  const getInventoryStatusClass = (status: string) => {
    switch (status) {
      case '已售罄':
        return 'bg-red-100 text-red-800'
      case '库存紧张':
        return 'bg-orange-100 text-orange-800'
      case '库存偏低':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-green-100 text-green-800'
    }
  }

  const getInventoryStatusIcon = (status: string) => {
    switch (status) {
      case '已售罄':
        return '⛔'
      case '库存紧张':
        return '⚠️'
      case '库存偏低':
        return '📦'
      default:
        return '✅'
    }
  }

  if (!admin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="text-blue-600 hover:text-blue-800 mr-4"
              >
                ← 返回
              </button>
              <h1 className="text-xl font-semibold">商品管理</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">
                {admin.username}
              </span>
              <button
                onClick={() => navigate('/admin/login')}
                className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 text-sm"
              >
                登出
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 搜索和筛选 */}
          <div className="mb-6 bg-white p-4 rounded-lg shadow">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
              <div className="flex-1 flex space-x-4">
                <input
                  type="text"
                  placeholder="搜索商品名称..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={filterActive}
                  onChange={(e) => setFilterActive(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">全部</option>
                  <option value="active">在售</option>
                  <option value="inactive">停售</option>
                </select>
                <button
                  onClick={fetchProducts}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  搜索
                </button>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 flex items-center"
              >
                <span className="mr-2">+</span>
                添加商品
              </button>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
              {error}
            </div>
          )}

          {/* 成功消息 */}
          {successMessage && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-md">
              {successMessage}
            </div>
          )}

          {/* 加载状态 */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="mt-2 text-gray-600">加载中...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <p className="text-gray-600">暂无商品数据</p>
            </div>
          ) : (
            <>
              {/* 批量操作工具栏 */}
              {selectedProducts.size > 0 && (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-blue-900">
                        已选择 {selectedProducts.size} 个商品
                      </span>
                      <button
                        onClick={() => setSelectedProducts(new Set())}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        清除选择
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleBatchStatusToggle(true)}
                        className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        批量上架
                      </button>
                      <button
                        onClick={() => handleBatchStatusToggle(false)}
                        className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        批量下架
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 商品列表 */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectAll}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        商品信息
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        价格
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        状态
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        库存状态
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {products.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedProducts.has(product.id)}
                            onChange={(e) => handleSelectProduct(product.id, e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <div className="text-sm font-medium text-gray-900">
                              {product.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {product.description || '无描述'}
                            </div>
                            <div className="text-xs text-gray-400">
                              {product.deliveryType} · {product.isActive ? '在售' : '停售'}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col space-y-1">
                            {product.prices
                              .filter((p) => p.currency === 'CNY')
                              .map((price) => (
                                <div key={price.id} className="text-sm text-gray-900">
                                  ¥{price.price.toFixed(2)} CNY
                                </div>
                              ))}
                            {product.prices
                              .filter((p) => p.currency === 'USD')
                              .map((price) => (
                                <div key={price.id} className="text-sm text-gray-900">
                                  ${price.price.toFixed(2)} USD
                                </div>
                              ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col space-y-2">
                            <ProductStatusBadge
                              isActive={product.isActive}
                              size="sm"
                            />
                            <ProductStatusToggle
                              isActive={product.isActive}
                              productId={product.id}
                              productName={product.name}
                              onToggle={handleStatusToggle}
                              loading={updatingStatus && statusDialog.productId === product.id}
                              size="sm"
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col space-y-1">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                getInventoryStatusClass(product.inventoryStatus)
                              }`}
                            >
                              <span className="mr-1">{getInventoryStatusIcon(product.inventoryStatus)}</span>
                              {product.inventoryStatus}
                            </span>
                            <div className="text-xs text-gray-500">
                              可用: {product.inventory.available} / 总计: {product.inventory.total}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleEditPrice(product)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            编辑价格
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between bg-white p-4 rounded-lg shadow">
                  <div className="text-sm text-gray-700">
                    第 {page} 页，共 {totalPages} 页
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50"
                    >
                      上一页
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-50"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* 编辑价格模态框 */}
      <EditPriceModal
        product={editingProduct}
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setEditingProduct(null)
        }}
        onSave={handleSavePrice}
      />

      {/* 创建商品模态框 */}
      <CreateProductModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateProduct}
      />

      {/* 状态确认对话框 */}
      <StatusConfirmDialog
        isOpen={statusDialog.isOpen}
        onClose={() => setStatusDialog({
          isOpen: false,
          productId: null,
          productName: '',
          isActive: false
        })}
        onConfirm={handleConfirmStatusUpdate}
        productName={statusDialog.productName}
        isActive={statusDialog.isActive}
        loading={updatingStatus}
      />

      {/* 批量状态确认对话框 */}
      <BatchStatusConfirmDialog
        isOpen={batchDialog.isOpen}
        onClose={() => setBatchDialog({
          isOpen: false,
          isActive: false,
          selectedCount: 0
        })}
        onConfirm={handleConfirmBatchUpdate}
        selectedCount={batchDialog.selectedCount}
        isActive={batchDialog.isActive}
        loading={updatingStatus}
      />
    </div>
  )
}
