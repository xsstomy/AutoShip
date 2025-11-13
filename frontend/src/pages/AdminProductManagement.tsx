import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

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

export default function AdminProductManagement() {
  const { admin, token } = useAuth()
  const navigate = useNavigate()

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [savingPrice, setSavingPrice] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')

  useEffect(() => {
    if (!admin) {
      navigate('/admin/login')
      return
    }
    fetchProducts()
  }, [admin, navigate, page, filterActive])

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

      alert('价格更新成功！')
    } catch (err: any) {
      alert(err.message || '更新价格失败')
      console.error('Error saving price:', err)
    } finally {
      setSavingPrice(false)
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
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
              {error}
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
              {/* 商品列表 */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        商品信息
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        价格
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
    </div>
  )
}
