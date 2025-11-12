import React, { useState, useEffect } from 'react';
import type { Product, Currency } from '../../types/product';
import { getProducts } from '../../services/productApi';
import { getCurrencyPreference, convertCurrency } from '../../utils/currency';
import ProductCard from './ProductCard';
import CurrencyToggle from './CurrencyToggle';
import LoadingSpinner from './LoadingSpinner';

/**
 * 商品展示页面主组件
 */
const ProductDisplay: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>(getCurrencyPreference());

  // 加载商品数据
  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getProducts();
      setProducts(response.products);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '商品加载失败，请稍后重试';
      setError(errorMessage);
      console.error('加载商品失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时加载商品
  useEffect(() => {
    fetchProducts();
  }, []);

  // 处理货币切换
  const handleCurrencyChange = (newCurrency: Currency) => {
    setCurrency(newCurrency);
  };

  // 渲染错误状态
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="text-red-500 text-5xl mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">加载失败</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={fetchProducts}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
            >
              重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 页面头部 */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">商品展示</h1>
            <CurrencyToggle currentCurrency={currency} onChange={handleCurrencyChange} />
          </div>
        </div>
      </div>

      {/* 商品列表 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <LoadingSpinner size="lg" text="正在加载商品..." />
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-5xl mb-4">
              <svg
                className="w-16 h-16 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无可购买商品</h3>
            <p className="text-gray-600">敬请期待更多商品上线</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => {
              // 转换价格到当前货币
              const convertedPrice = convertCurrency(
                product.price,
                product.currency,
                currency
              );

              return (
                <ProductCard
                  key={product.id}
                  product={{
                    ...product,
                    price: convertedPrice,
                    currency: currency,
                  }}
                  currency={currency}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductDisplay;
