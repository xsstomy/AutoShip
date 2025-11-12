import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import type {
  ProductQueryParams,
  CheckoutPageState,
  OrderCreateRequest
} from '../../types/order';
import type { Currency } from '../../types/product';
import { createOrder } from '../../services/checkoutApi';
import { validateEmail, sanitizeEmail } from '../../utils/validation';
import { formatCurrency, convertCurrency } from '../../utils/currency';

/**
 * 下单流程页面组件
 */
const CheckoutPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // 从查询参数中获取商品信息
  const [productParams, setProductParams] = useState<ProductQueryParams | null>(null);
  const [paramsError, setParamsError] = useState<string | null>(null);

  // 页面状态
  const [state, setState] = useState<CheckoutPageState>({
    loading: false,
    error: null,
    order: null,
    formData: {
      email: '',
    },
    formErrors: {},
  });

  // 解析查询参数
  useEffect(() => {
    const productId = searchParams.get('productId');
    const productName = searchParams.get('productName');
    const price = searchParams.get('price');
    const currency = searchParams.get('currency') as Currency;

    // 验证必需的参数
    if (!productId || !productName || !price || !currency) {
      setParamsError('缺少必要的商品信息，请重新选择商品');
      return;
    }

    // 验证货币类型
    if (currency !== 'CNY' && currency !== 'USD') {
      setParamsError('不支持的货币类型');
      return;
    }

    // 解析价格
    const priceNumber = parseFloat(price);
    if (isNaN(priceNumber) || priceNumber <= 0) {
      setParamsError('商品价格格式不正确');
      return;
    }

    setProductParams({
      productId,
      productName: decodeURIComponent(productName),
      price,
      currency,
    });
  }, [searchParams]);

  // 处理邮箱输入变化
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setState(prev => ({
      ...prev,
      formData: {
        ...prev.formData,
        email: value,
      },
      formErrors: {
        ...prev.formErrors,
        email: undefined,
      },
      error: null,
    }));
  };

  // 验证邮箱输入
  const validateEmailInput = (): boolean => {
    const emailValidation = validateEmail(state.formData.email);

    if (!emailValidation.isValid) {
      setState(prev => ({
        ...prev,
        formErrors: {
          ...prev.formErrors,
          email: emailValidation.error,
        },
      }));
      return false;
    }

    return true;
  };

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 验证邮箱
    if (!validateEmailInput()) {
      return;
    }

    // 检查商品参数
    if (!productParams) {
      setState(prev => ({
        ...prev,
        error: '商品信息不完整，请重新选择商品',
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // 清理邮箱地址
      const sanitizedEmail = sanitizeEmail(state.formData.email);

      // 构建订单创建请求
      const orderRequest: OrderCreateRequest = {
        productId: productParams.productId,
        productName: productParams.productName,
        price: parseFloat(productParams.price),
        currency: productParams.currency,
        email: sanitizedEmail,
        gateway: 'creem', // 默认使用 Creem 支付网关
      };

      // 创建订单
      const response = await createOrder(orderRequest);

      if (response.success && response.order) {
        setState(prev => ({
          ...prev,
          order: response.order || null,
          loading: false,
        }));

      // TODO: 跳转到支付页面
        alert(`订单创建成功！订单ID: ${response.order?.id}\n即将跳转到支付页面...`);
        navigate(`/payment/${response.order?.id}`);
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || '订单创建失败，请稍后重试',
          loading: false,
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '网络错误，请稍后重试',
        loading: false,
      }));
    }
  };

  // 渲染参数错误状态
  if (paramsError) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">参数错误</h3>
            <p className="text-gray-600 mb-6">{paramsError}</p>
            <Link
              to="/"
              className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
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
        </div>
      </div>
    );
  }

  // 渲染加载状态
  if (!productParams) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded mb-6"></div>
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {/* 返回按钮 */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
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

      {/* 下单表单 */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* 页面标题 */}
          <div className="bg-blue-600 text-white px-6 py-4">
            <h1 className="text-2xl font-bold">确认订单</h1>
            <p className="text-blue-100 mt-1">请填写邮箱地址并确认订单信息</p>
          </div>

          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 商品信息展示 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-3">商品信息</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">商品名称:</span>
                    <span className="font-medium text-gray-900">{productParams.productName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">商品ID:</span>
                    <span className="text-gray-900">{productParams.productId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">价格:</span>
                    <span className="text-2xl font-bold text-gray-900">
                      {formatCurrency(
                        convertCurrency(
                          parseFloat(productParams.price),
                          productParams.currency,
                          productParams.currency
                        ),
                        productParams.currency
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* 邮箱输入 */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  邮箱地址 <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={state.formData.email}
                  onChange={handleEmailChange}
                  onBlur={validateEmailInput}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    state.formErrors.email
                      ? 'border-red-500'
                      : 'border-gray-300'
                  }`}
                  placeholder="请输入您的邮箱地址"
                  disabled={state.loading}
                />
                {state.formErrors.email && (
                  <p className="mt-1 text-sm text-red-600">{state.formErrors.email}</p>
                )}
                <p className="mt-1 text-sm text-gray-500">
                  购买成功后，商品信息将发送到此邮箱
                </p>
              </div>

              {/* 错误信息 */}
              {state.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <svg
                      className="w-5 h-5 text-red-500 mr-2"
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
                    <span className="text-red-700">{state.error}</span>
                  </div>
                </div>
              )}

              {/* 提交按钮 */}
              <button
                type="submit"
                disabled={state.loading || !state.formData.email.trim()}
                className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors duration-200 ${
                  state.loading || !state.formData.email.trim()
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {state.loading ? '处理中...' : '确认下单'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;