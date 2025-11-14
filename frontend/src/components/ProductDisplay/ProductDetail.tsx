import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { Product, Currency } from '../../types/product';
import { getProductById } from '../../services/productApi';
import { getCurrencyPreference, convertCurrency, formatCurrency } from '../../utils/currency';
import { buildCheckoutUrl } from '../../services/checkoutApi';

/**
 * 商品详情页面组件
 */
const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>(getCurrencyPreference());

  // 加载商品详情
  const fetchProduct = async (productId: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await getProductById(productId);
      setProduct(response.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '商品加载失败，请稍后重试';
      setError(errorMessage);
      console.error('加载商品详情失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时加载商品详情
  useEffect(() => {
    if (id) {
      fetchProduct(id);
    }
  }, [id]);

  // 处理货币切换
  const handleCurrencyChange = (newCurrency: Currency) => {
    setCurrency(newCurrency);
  };

  const getProductTypeText = (deliveryType: string): string => {
    switch (deliveryType) {
      case 'text':
        return '文本内容';
      case 'download':
        return '下载链接';
      case 'hybrid':
        return '混合发货';
      default:
        return deliveryType;
    }
  };

  const getProductTypeDescription = (deliveryType: string): string => {
    switch (deliveryType) {
      case 'text':
        return '购买后将通过邮件自动发送文本内容';
      case 'download':
        return '购买后将自动发送下载链接';
      case 'hybrid':
        return '购买后将自动发送文本内容和下载链接';
      default:
        return '';
    }
  };

  // 渲染错误状态
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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
              onClick={() => id && fetchProduct(id)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
            >
              重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !product) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="animate-pulse">
              <div className="h-64 bg-gray-200 rounded-lg mb-6"></div>
              <div className="h-8 bg-gray-200 rounded mb-4"></div>
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 获取当前货币的价格
  const getCurrentPrice = () => {
    const priceItem = product.prices.find(p => p.currency === currency);
    if (priceItem) {
      return priceItem.price;
    }
    // 如果没有当前货币价格，使用第一个价格并转换
    const firstPrice = product.prices[0];
    return firstPrice ? convertCurrency(firstPrice.price, firstPrice.currency, currency) : 0;
  };

  const convertedPrice = getCurrentPrice();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {/* 返回按钮 */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <Link
          to="/"
          className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors duration-200"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          返回商品列表
        </Link>
      </div>

      {/* 商品详情 */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
            {/* 商品图片 */}
            <div className="h-96 bg-gray-100 rounded-lg overflow-hidden">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <svg
                    className="w-24 h-24"
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
            <div className="flex flex-col">
              {/* 商品类型标签 */}
              <span className="inline-block px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800 w-fit mb-4">
                {getProductTypeText(product.deliveryType)}
              </span>

              {/* 商品名称 */}
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.name}</h1>

              {/* 商品描述 */}
              <p className="text-gray-600 mb-6">{product.description}</p>

              {/* 价格和货币切换 */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-medium text-gray-700">价格</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">切换货币:</span>
                    <button
                      onClick={() => handleCurrencyChange(currency === 'CNY' ? 'USD' : 'CNY')}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {currency === 'CNY' ? 'USD' : 'CNY'}
                    </button>
                  </div>
                </div>
                <div className="text-4xl font-bold text-gray-900">
                  {formatCurrency(convertedPrice, currency)}
                </div>
              </div>

              {/* 库存信息 */}
              <div className="mb-6">
                <span className="text-lg font-medium text-gray-700 block mb-2">库存状态</span>
                <span
                  className={`text-lg font-medium ${
                    product.inventory.available > 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {product.inventory.available > 0 ? `现货: ${product.inventory.available} 件` : '暂无库存'}
                </span>
              </div>

              {/* 商品类型说明 */}
              <div className="mb-6">
                <span className="text-lg font-medium text-gray-700 block mb-2">商品说明</span>
                <p className="text-gray-600">{getProductTypeDescription(product.deliveryType)}</p>
              </div>

              {/* 立即购买按钮 */}
              <button
                className={`w-full py-3 px-6 rounded-lg font-medium text-white transition-colors duration-200 ${
                  product.inventory.available > 0
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
                disabled={product.inventory.available === 0}
                onClick={() => {
                  if (product.inventory.available > 0) {
                    const checkoutUrl = buildCheckoutUrl({
                      productId: product.id,
                      productName: product.name,
                      price: convertedPrice,
                      currency: currency,
                    });
                    navigate(checkoutUrl);
                  }
                }}
              >
                {product.inventory.available > 0 ? '立即购买' : '暂无库存'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
