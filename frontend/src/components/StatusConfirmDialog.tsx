import React from 'react'

interface StatusConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  productName: string
  isActive: boolean
  loading?: boolean
  showDontShowAgain?: boolean
  onDontShowAgainChange?: (checked: boolean) => void
}

const StatusConfirmDialog: React.FC<StatusConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  productName,
  isActive,
  loading = false,
  showDontShowAgain = false,
  onDontShowAgainChange
}) => {
  if (!isOpen) return null

  const isActivating = isActive // 设置为激活状态（上架）
  const action = isActivating ? '上架' : '下架'
  const actionColor = isActivating ? 'green' : 'red'

  const handleConfirm = () => {
    if (!loading) {
      onConfirm()
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* 对话框头部 */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className={`flex-shrink-0 w-10 h-10 rounded-full bg-${actionColor}-100 flex items-center justify-center`}>
              {isActivating ? (
                // 上架图标
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              ) : (
                // 下架图标
                <svg
                  className="w-5 h-5 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                确认{action}商品
              </h3>
            </div>
          </div>
        </div>

        {/* 对话框内容 */}
        <div className="px-6 py-4">
          <p className="text-gray-600 mb-3">
            确定要{action}商品 <span className="font-semibold text-gray-900">"{productName}"</span> 吗？
          </p>

          {!isActivating && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
              <div className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm text-amber-800">
                    <strong>注意：</strong>下架后该商品将不在前台显示，客户将无法购买此商品。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 不再提示选项 */}
          {showDontShowAgain && onDontShowAgainChange && (
            <div className="mt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  onChange={(e) => onDontShowAgainChange(e.target.checked)}
                />
                <span className="text-sm text-gray-600">
                  不再显示此确认对话框
                </span>
              </label>
            </div>
          )}
        </div>

        {/* 对话框底部按钮 */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${actionColor}-500 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 ${
              isActivating
                ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
            }`}
          >
            {loading && (
              <svg
                className="animate-spin w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            确认{action}
          </button>
        </div>
      </div>
    </div>
  )
}

export default StatusConfirmDialog