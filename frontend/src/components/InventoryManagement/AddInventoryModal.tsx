import React, { useState, useEffect } from 'react'
import { addInventory } from '../../services/inventoryApi'

interface AddInventoryModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface Product {
  id: number
  name: string
}

export default function AddInventoryModal({ isOpen, onClose, onSuccess }: AddInventoryModalProps) {
  const [productId, setProductId] = useState<number>(0)
  const [products, setProducts] = useState<Product[]>([])
  const [content, setContent] = useState('')
  const [batchName, setBatchName] = useState('')
  const [priority, setPriority] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetchProducts()
      setContent('')
      setBatchName('')
      setPriority(0)
      setError('')
      setSuccess('')
      setProductId(0)
    }
  }, [isOpen])

  const fetchProducts = async () => {
    try {
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

  const handleAdd = async () => {
    if (!productId) {
      setError('请选择商品')
      return
    }

    if (!content.trim()) {
      setError('请输入库存内容')
      return
    }

    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const result = await addInventory({
        productId,
        content: content.trim(),
        batchName: batchName.trim() || undefined,
        priority,
      })

      // 显示成功消息
      setSuccess(`成功添加 ${result.count} 项库存`)

      // 2秒后自动关闭模态框
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 2000)

    } catch (err: any) {
      // 改进错误处理，提供更友好的错误信息
      let errorMessage = '添加失败'

      if (err.message.includes('413')) {
        errorMessage = '文件过大，请选择小于10MB的文件'
      } else if (err.message.includes('400')) {
        errorMessage = '请求参数错误，请检查输入'
      } else if (err.message.includes('401')) {
        errorMessage = '登录已过期，请重新登录'
      } else if (err.message.includes('404')) {
        errorMessage = '商品不存在，请重新选择'
      } else if (err.message) {
        errorMessage = err.message
      }

      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handlePreview = () => {
    const lines = content.split('\n').filter(line => line.trim().length > 0)
    return lines.length
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">添加库存</h3>

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
              placeholder="例如：手动添加批次"
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
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                库存内容 <span className="text-red-500">*</span>
              </label>
              <span className="text-xs text-gray-500">
                将添加 {handlePreview()} 项
              </span>
            </div>
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

          {/* 预览 */}
          {handlePreview() > 0 && (
            <div className="bg-gray-50 p-4 rounded-md">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">预览（最多显示5项）：</h4>
              <ul className="text-sm text-gray-700 space-y-1 max-h-32 overflow-y-auto">
                {content
                  .split('\n')
                  .filter((line) => line.trim().length > 0)
                  .slice(0, 5)
                  .map((line, index) => (
                    <li key={index} className="truncate">
                      {index + 1}. {line.trim()}
                    </li>
                  ))}
                {handlePreview() > 5 && (
                  <li className="text-gray-500">
                    ...还有 {handlePreview() - 5} 项
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* 成功提示 */}
        {success && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
            ✅ {success}
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            ❌ {error}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={loading || success}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleAdd}
            disabled={loading || success || !productId || !content.trim()}
            className={`px-4 py-2 rounded-md disabled:opacity-50 ${
              success
                ? 'bg-green-600 text-white'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            {loading
              ? '添加中...'
              : success
                ? '✓ 添加成功'
                : '添加库存'
            }
          </button>
        </div>
      </div>
    </div>
  )
}
