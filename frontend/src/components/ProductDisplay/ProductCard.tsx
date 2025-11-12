import React from 'react';
import { Link } from 'react-router-dom';
import type { ProductCardData, Currency } from '../../types/product';
import { formatCurrency } from '../../utils/currency';

interface ProductCardProps {
  product: ProductCardData;
  currency: Currency;
  onCurrencyChange?: (currency: Currency) => void;
}

/**
 * 商品卡片组件
 */
const ProductCard: React.FC<ProductCardProps> = ({ product, currency }) => {
  const getProductTypeText = (type: string): string => {
    switch (type) {
      case 'card_key':
        return '卡密';
      case 'download':
        return '下载链接';
      case 'license':
        return '许可证';
      default:
        return type;
    }
  };

  const getProductTypeBadgeColor = (type: string): string => {
    switch (type) {
      case 'card_key':
        return 'bg-blue-100 text-blue-800';
      case 'download':
        return 'bg-green-100 text-green-800';
      case 'license':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Link to={`/product/${product.id}`} className="block group">
      <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 h-full flex flex-col">
        {/* 商品图片 */}
        <div className="h-48 bg-gray-100 overflow-hidden">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <svg
                className="w-16 h-16"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
        </div>

        {/* 商品信息 */}
        <div className="p-4 flex-1 flex flex-col">
          {/* 商品名称和类型 */}
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors duration-200">
              {product.name}
            </h3>
            <span
              className={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ml-2 ${getProductTypeBadgeColor(
                product.type
              )}`}
            >
              {getProductTypeText(product.type)}
            </span>
          </div>

          {/* 商品描述 */}
          <p className="text-gray-600 text-sm mb-3 line-clamp-2 flex-1">
            {product.description}
          </p>

          {/* 价格和库存 */}
          <div className="flex items-center justify-between mt-auto">
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(product.price, currency)}
            </div>
            <div className="text-sm text-gray-500">
              库存: <span className={product.stock > 0 ? 'text-green-600' : 'text-red-600'}>
                {product.stock > 0 ? product.stock : '无库存'}
              </span>
            </div>
          </div>

          {/* 查看详情按钮 */}
          <div className="mt-4 w-full">
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200">
              查看详情
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
