import React from 'react'

interface ProductStatusBadgeProps {
  isActive: boolean
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  className?: string
}

const ProductStatusBadge: React.FC<ProductStatusBadgeProps> = ({
  isActive,
  size = 'md',
  showIcon = true,
  className = ''
}) => {
  // 根据状态设置样式
  const baseStyles = 'inline-flex items-center gap-1 px-2 py-1 rounded-full font-medium'

  // 尺寸样式
  const sizeStyles = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5'
  }

  // 状态样式
  const statusStyles = isActive
    ? 'bg-green-100 text-green-800 border border-green-200'
    : 'bg-gray-100 text-gray-600 border border-gray-200'

  const finalClassName = `${baseStyles} ${sizeStyles[size]} ${statusStyles} ${className}`

  return (
    <span className={finalClassName}>
      {showIcon && (
        <span className="flex-shrink-0">
          {isActive ? (
            // 上架状态图标：眼睛或向上箭头
            <svg
              className={`w-3 h-3 ${size === 'lg' ? 'w-4 h-4' : ''}`}
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
          ) : (
            // 下架状态图标：眼睛关闭或向下箭头
            <svg
              className={`w-3 h-3 ${size === 'lg' ? 'w-4 h-4' : ''}`}
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
              <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
            </svg>
          )}
        </span>
      )}

      <span className="flex-shrink-0">
        {isActive ? '已上架' : '已下架'}
      </span>
    </span>
  )
}

export default ProductStatusBadge