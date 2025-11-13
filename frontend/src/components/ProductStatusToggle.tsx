import React from 'react'

interface ProductStatusToggleProps {
  isActive: boolean
  productId: number
  productName: string
  onToggle: (productId: number, isActive: boolean) => void
  disabled?: boolean
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const ProductStatusToggle: React.FC<ProductStatusToggleProps> = ({
  isActive,
  productId,
  productName,
  onToggle,
  disabled = false,
  loading = false,
  size = 'md',
  className = ''
}) => {
  const handleClick = () => {
    if (!disabled && !loading) {
      onToggle(productId, !isActive)
    }
  }

  // 按钮基础样式
  const baseStyles = 'inline-flex items-center gap-2 font-medium rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2'

  // 尺寸样式
  const sizeStyles = {
    sm: 'text-xs px-2 py-1 focus:ring-offset-1',
    md: 'text-sm px-3 py-1.5 focus:ring-offset-2',
    lg: 'text-base px-4 py-2 focus:ring-offset-2'
  }

  // 状态样式
  const getStatusStyles = () => {
    if (isActive) {
      // 下架按钮样式（红色/橙色）
      return 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 focus:ring-red-500'
    } else {
      // 上架按钮样式（绿色/蓝色）
      return 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 focus:ring-green-500'
    }
  }

  // 禁用样式
  const disabledStyles = disabled || loading
    ? 'opacity-50 cursor-not-allowed'
    : 'cursor-pointer'

  const finalClassName = `${baseStyles} ${sizeStyles[size]} ${getStatusStyles()} ${disabledStyles} ${className}`

  // 按钮文本
  const buttonText = isActive ? '下架' : '上架'

  // 按钮图标
  const ButtonIcon = () => {
    if (loading) {
      return (
        <svg
          className={`animate-spin ${size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'}`}
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
      )
    }

    if (isActive) {
      // 下架图标
      return (
        <svg
          className={`w-3 h-3 ${size === 'lg' ? 'w-4 h-4' : ''}`}
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
      )
    }

    // 上架图标
    return (
      <svg
        className={`w-3 h-3 ${size === 'lg' ? 'w-4 h-4' : ''}`}
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
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      className={finalClassName}
      title={isActive ? `下架商品: ${productName}` : `上架商品: ${productName}`}
      aria-label={`${buttonText}商品: ${productName}`}
    >
      <ButtonIcon />
      <span>{buttonText}</span>
    </button>
  )
}

export default ProductStatusToggle