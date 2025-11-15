import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  getInventoryList,
  getInventoryDetail,
  type ProductInventory,
  type InventoryItem,
} from '../services/inventoryApi'

// 导入模态框组件
import ImportInventoryModal from '../components/InventoryManagement/ImportInventoryModal'
import InventoryDetailModal from '../components/InventoryManagement/InventoryDetailModal'
import AddInventoryModal from '../components/InventoryManagement/AddInventoryModal'

export default function AdminInventoryManagement() {
  const { admin } = useAuth()
  const navigate = useNavigate()

  const [products, setProducts] = useState<ProductInventory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // 模态框状态
  const [showImportModal, setShowImportModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductInventory | null>(null)
  const [inventoryDetail, setInventoryDetail] = useState<{
    product: any
    inventory: InventoryItem[]
    summary: any
    pagination: any
  } | null>(null)

  useEffect(() => {
    fetchInventory()
  }, [page, filterStatus])

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (page === 1) {
        fetchInventory()
      } else {
        setPage(1)
      }
    }, 500)

    return () => clearTimeout(delayedSearch)
  }, [searchTerm])

  const fetchInventory = async () => {
    setLoading(true)
    setError('')

    try {
      const params: any = {
        page,
        limit: 20,
      }

      if (searchTerm) {
        params.search = searchTerm
      }

      if (filterStatus !== 'all') {
        params.status = filterStatus
      }

      const data = await getInventoryList(params)
      setProducts(data.products)
      setTotalPages(data.pagination.totalPages)
    } catch (err: any) {
      setError(err.message || '加载失败')
      console.error('Error fetching inventory:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetail = async (product: ProductInventory) => {
    setSelectedProduct(product)
    setShowDetailModal(true)

    try {
      const data = await getInventoryDetail(product.productId, { page: 1, limit: 50 })
      setInventoryDetail(data)
    } catch (err: any) {
      alert(err.message || '获取库存详情失败')
    }
  }

  const handleImportSuccess = () => {
    setShowImportModal(false)
    fetchInventory()
  }

  const handleAddSuccess = () => {
    setShowAddModal(false)
    fetchInventory()
  }

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'in_stock':
        return 'bg-green-100 text-green-800'
      case 'low_stock':
        return 'bg-yellow-100 text-yellow-800'
      case 'out_of_stock':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in_stock':
        return '✅'
      case 'low_stock':
        return '⚠️'
      case 'out_of_stock':
        return '⛔'
      default:
        return '❓'
    }
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
              <h1 className="text-xl font-semibold">库存管理</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">
                {admin!.username}
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
          {/* Search and Filter Bar */}
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
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">全部</option>
                  <option value="in_stock">有库存</option>
                  <option value="low_stock">低库存</option>
                  <option value="out_of_stock">无库存</option>
                </select>
                <button
                  onClick={fetchInventory}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  搜索
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="mb-6 bg-white p-4 rounded-lg shadow">
            <div className="flex space-x-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm font-medium"
              >
                批量导入库存
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 text-sm font-medium"
              >
                手动添加库存
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md">
              {error}
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="mt-2 text-gray-600">加载中...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <p className="text-gray-600">暂无库存数据</p>
            </div>
          ) : (
            <>
              {/* Inventory Table */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        商品信息
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        库存数量
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        库存状态
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        最后更新
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {products.map((product) => (
                      <tr key={product.productId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <div className="text-sm font-medium text-gray-900">
                              {product.productName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {product.productDescription || '无描述'}
                            </div>
                            <div className="text-xs text-gray-400">
                              {product.deliveryType}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col space-y-1">
                            <div className="text-sm text-gray-900">
                              可用: <span className="font-medium text-green-600">{product.available}</span>
                            </div>
                            <div className="text-xs text-gray-500">
                              总计: {product.total} / 已用: {product.used}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClass(
                              product.status
                            )}`}
                          >
                            <span className="mr-1">{getStatusIcon(product.status)}</span>
                            {product.statusMessage}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(product.lastUpdated).toLocaleString('zh-CN')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleViewDetail(product)}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            查看详情
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
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

      {/* Import Inventory Modal */}
      <ImportInventoryModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={handleImportSuccess}
      />

      {/* Inventory Detail Modal */}
      <InventoryDetailModal
        product={selectedProduct}
        inventoryDetail={inventoryDetail}
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false)
          setSelectedProduct(null)
          setInventoryDetail(null)
        }}
        onDeleteSuccess={() => {
          // 先刷新列表页面数据，确保显示最新库存数量
          fetchInventory()
          // 然后刷新详情页面数据
          if (selectedProduct) {
            handleViewDetail(selectedProduct)
          }
        }}
      />

      {/* Add Inventory Modal */}
      <AddInventoryModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleAddSuccess}
      />
    </div>
  )
}
