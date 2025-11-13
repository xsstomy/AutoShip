import React, { useState, useEffect } from 'react'
import { importInventory, type ImportResult } from '../../../services/inventoryApi'

interface ImportInventoryModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface Product {
  id: number
  name: string
}

export default function ImportInventoryModal({ isOpen, onClose, onSuccess }: ImportInventoryModalProps) {
  const [productId, setProductId] = useState<number>(0)
  const [products, setProducts] = useState<Product[]>([])
  const [content, setContent] = useState('')
  const [batchName, setBatchName] = useState('')
  const [priority, setPriority] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchProducts()
      setContent('')
      setBatchName('')
      setPriority(0)
      setError('')
      setResult(null)
    }
  }, [isOpen])

  const fetchProducts = async () => {
    try {
      // 这里应该从商品管理 API 获取商品列表
      // 为了简化演示，我们使用模拟数据
      const response = await fetch('http://localhost:3000/api/v1/admin/products?page=1&limit=100', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
        },
      })
      const data = await response.json()
      if (data.success) {
        setProducts(data.data.products)
      }
    } catch (err) {
      console.error('Failed to fetch products:', err)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      setError('文件大小不能超过 10MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setContent(text)
      setError('')
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!productId) {
      setError('请选择商品')
      return
    }

    if (!content.trim()) {
      setError('请输入库存内容')
      return
    }

    setError('')
    setLoading(true)

    try {
      const result = await importInventory({
        productId,
        content: content.trim(),
        batchName: batchName.trim() || undefined,
        priority,
      })

      setResult(result)
    } catch (err: any) {
      setError(err.message || '导入失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (result) {
      onSuccess()
    } else {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">批量导入库存</h3>

        {!result ? (
          <>
            <div className="space-y-4">
              {/* 商品选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  选择商品 <span className="text-red-500">*</span>
                </label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={0}>请选择商品</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 批次名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  批次名称（可选）
                </label>
                <input
                  type="text"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例如：2024年1月批次"
                />
              </div>

              {/* 优先级 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  优先级（0-100，数字越大优先级越高）
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 文件上传 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  上传文件（可选）
                </label>
                <input
                  type="file"
                  accept=".txt,.csv"
                  onChange={handleFileUpload}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  支持格式：TXT, CSV。文件大小不超过 10MB
                </p>
              </div>

              {/* 库存内容 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  库存内容 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="每行一个库存项，例如：&#10;CARD-001-XXXXX-ABCD1234&#10;CARD-002-XXXXX-EFGH5678"
                />
              </div>

              {/* 格式说明 */}
              <div className="bg-blue-50 p-4 rounded-md">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">支持格式说明：</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• 每行一个库存项</li>
                  <li>• 支持的格式：</li>
                  <li className="ml-4">- 卡密: CARD-001-XXXXX-ABCD1234</li>
                  <li className="ml-4">- 文本: 任意文本内容</li>
                  <li className="ml-4">- 链接: https://example.com/file.zip</li>
                </ul>
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={loading || !productId || !content.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? '导入中...' : '开始导入'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* 导入结果 */}
            <div className="space-y-4">
              <div className="flex items-center justify-center">
                {result.success ? (
                  <div className="text-green-500 text-5xl">✓</div>
                ) : (
                  <div className="text-red-500 text-5xl">✗</div>
                )}
              </div>

              <div className="text-center">
                <h4 className="text-lg font-semibold text-gray-900">
                  {result.success ? '导入完成' : '导入失败'}
                </h4>
                <p className="text-sm text-gray-600 mt-2">
                  总计：{result.total} 条，成功：{result.successCount} 条，失败：{result.failedCount} 条
                </p>
              </div>

              {result.errors.length > 0 && (
                <div className="bg-red-50 p-4 rounded-md max-h-40 overflow-y-auto">
                  <h5 className="text-sm font-semibold text-red-900 mb-2">错误详情：</h5>
                  <ul className="text-sm text-red-800 space-y-1">
                    {result.errors.map((error, index) => (
                      <li key={index}>
                        第 {error.line} 行：{error.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                确定
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
