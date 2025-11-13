import React, { useState, useEffect } from 'react'
import { getInventoryDetail, deleteInventoryItems, type ProductInventory, type InventoryItem } from '../../../services/inventoryApi'

interface InventoryDetailModalProps {
  product: ProductInventory | null
  inventoryDetail: {
    product: any
    inventory: InventoryItem[]
    summary: any
    pagination: any
  } | null
  isOpen: boolean
  onClose: () => void
  onDeleteSuccess: () => void
}

export default function InventoryDetailModal({
  product,
  inventoryDetail,
  isOpen,
  onClose,
  onDeleteSuccess,
}: InventoryDetailModalProps) {
  const [selectedItems, setSelectedItems] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (isOpen && product) {
      setSelectedItems([])
      setShowConfirm(false)
    }
  }, [isOpen, product])

  const handleSelectItem = (itemId: number) => {
    setSelectedItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    )
  }

  const handleSelectAll = () => {
    if (!inventoryDetail) return

    if (selectedItems.length === inventoryDetail.inventory.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(inventoryDetail.inventory.map((item) => item.id))
    }
  }

  const handleDelete = async () => {
    if (!product || selectedItems.length === 0) return

    setDeleteLoading(true)

    try {
      await deleteInventoryItems(product.productId, selectedItems)
      setShowConfirm(false)
      setSelectedItems([])
      onDeleteSuccess()
    } catch (err: any) {
      alert(err.message || '删除失败')
    } finally {
      setDeleteLoading(false)
    }
  }

  if (!isOpen || !product || !inventoryDetail) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <h3 className="text-lg font-semibold mb-4">库存详情 - {product.productName}</h3>

        {/* 库存统计 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-blue-600">总计</div>
            <div className="text-2xl font-bold text-blue-900">{inventoryDetail.summary.total}</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm text-green-600">可用</div>
            <div className="text-2xl font-bold text-green-900">{inventoryDetail.summary.available}</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-sm text-red-600">已用</div>
            <div className="text-2xl font-bold text-red-900">{inventoryDetail.summary.used}</div>
          </div>
        </div>

        {/* 库存列表 */}
        <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedItems.length === inventoryDetail.inventory.length && inventoryDetail.inventory.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  序号
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  库存内容
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  使用订单
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  创建时间
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {inventoryDetail.inventory.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={() => handleSelectItem(item.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{item.id}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                    {item.content}
                  </td>
                  <td className="px-4 py-3">
                    {item.isUsed ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        已使用
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        未使用
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {item.usedOrderId ? (
                      <span className="text-xs">{item.usedOrderId}</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(item.createdAt).toLocaleString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {inventoryDetail.inventory.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              暂无库存数据
            </div>
          )}
        </div>

        {/* 选中的库存项操作 */}
        {selectedItems.length > 0 && (
          <div className="mt-4 p-4 bg-yellow-50 rounded-lg flex items-center justify-between">
            <div className="text-sm text-yellow-800">
              已选择 {selectedItems.length} 项
            </div>
            <button
              onClick={() => setShowConfirm(true)}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm"
            >
              删除选中项
            </button>
          </div>
        )}

        {/* 确认删除弹窗 */}
        {showConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <h4 className="text-lg font-semibold mb-4">确认删除</h4>
              <p className="text-sm text-gray-600 mb-6">
                您确定要删除选中的 {selectedItems.length} 个库存项吗？此操作不可撤销。
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={deleteLoading}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50"
                >
                  {deleteLoading ? '删除中...' : '确认删除'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 关闭按钮 */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
