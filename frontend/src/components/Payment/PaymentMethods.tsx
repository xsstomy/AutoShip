/**
 * 支付方式选择组件
 */

import React from 'react';
import type { PaymentGateway } from '../../types/payment';
import type { Currency } from '../../types/product';

/**
 * 支付方式配置
 */
interface PaymentMethodConfig {
  id: PaymentGateway;
  name: string;
  displayName: string;
  description: string;
  icon: string;
  iconBg: string;
  recommended?: boolean;
  features: readonly string[];
}

/**
 * 组件属性
 */
interface PaymentMethodsProps {
  selectedGateway: PaymentGateway;
  onGatewayChange: (gateway: PaymentGateway) => void;
  disabled?: boolean;
  orderCurrency?: Currency;  // 新增：订单货币，用于筛选支付方式
}

/**
 * 支付方式配置常量
 */
const PAYMENT_METHOD_CONFIGS = {
  alipay: {
    id: 'alipay' as const,
    name: 'alipay',
    displayName: '支付宝',
    description: '安全便捷的移动支付',
    icon: '支',
    iconBg: 'bg-blue-500',
    recommended: true,
    features: ['扫码支付', '账户余额支付', '银行卡支付']
  },
  creem: {
    id: 'creem' as const,
    name: 'creem',
    displayName: 'Creem',
    description: '国际支付解决方案',
    icon: 'C',
    iconBg: 'bg-green-500',
    recommended: true,
    features: ['国际信用卡', 'PayPal', '加密货币']
  }
} as const;

/**
 * 根据货币获取支付方式配置
 */
function getPaymentMethodsByCurrency(orderCurrency?: Currency): PaymentMethodConfig[] {
  // 基础支付方式配置
  const baseMethods: PaymentMethodConfig[] = [
    PAYMENT_METHOD_CONFIGS.alipay,
    PAYMENT_METHOD_CONFIGS.creem
  ];

  // 根据订单货币筛选
  if (orderCurrency === 'CNY') {
    return baseMethods.filter(m => m.id === 'alipay');
  }
  if (orderCurrency === 'USD') {
    return baseMethods.filter(m => m.id === 'creem');
  }

  // 如果没有指定货币，返回所有支付方式
  return baseMethods;
}

/**
 * 支付方式选择组件
 */
const PaymentMethods: React.FC<PaymentMethodsProps> = ({
  selectedGateway,
  onGatewayChange,
  disabled = false,
  orderCurrency
}) => {
  // 根据订单货币获取支付方式配置
  const paymentMethods = getPaymentMethodsByCurrency(orderCurrency);

  // 使用 ref 跟踪用户是否手动选择过
  const userSelectedRef = React.useRef(false);

  // 自动选中推荐的支付方式（仅在初始化时）
  React.useEffect(() => {
    if (orderCurrency && paymentMethods.length > 0 && !userSelectedRef.current) {
      const recommendedMethod = paymentMethods.find(m => m.recommended);
      if (recommendedMethod && selectedGateway !== recommendedMethod.id) {
        console.log(`[PaymentMethods] 自动选中推荐支付方式: ${recommendedMethod.displayName}`);
        onGatewayChange(recommendedMethod.id);
      }
    }
  }, [orderCurrency, paymentMethods.length]); // 移除selectedGateway避免循环

  // 当用户手动选择时，标记为已选择
  React.useEffect(() => {
    userSelectedRef.current = true;
  }, [selectedGateway]);

  /**
   * 处理支付方式选择
   */
  const handleGatewaySelect = (gateway: PaymentGateway) => {
    if (!disabled) {
      onGatewayChange(gateway);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">选择支付方式</h2>
        <div className="text-sm text-gray-500">
          {orderCurrency ? `仅显示 ${orderCurrency} 支付方式` : '支持多种支付方式'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {paymentMethods.map((method) => (
          <div
            key={method.id}
            className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
              disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:border-gray-300'
            } ${
              selectedGateway === method.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200'
            }`}
            onClick={() => handleGatewaySelect(method.id)}
          >
            {/* 推荐标识 */}
            {method.recommended && (
              <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                推荐
              </div>
            )}

            {/* 支付方式头部 */}
            <div className="flex items-center space-x-3 mb-3">
              <div className={`w-10 h-10 ${method.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <span className="text-white font-bold text-base">{method.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">
                  {method.displayName}
                </h3>
                <p className="text-sm text-gray-600">
                  {method.description}
                </p>
              </div>
              {/* 选中状态指示器 */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                selectedGateway === method.id
                  ? 'bg-blue-500'
                  : 'border-2 border-gray-300'
              }`}>
                {selectedGateway === method.id && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </div>

            {/* 支付方式特性 */}
            <div className="space-y-2">
              <div className="text-xs text-gray-500 mb-2">支持方式：</div>
              <div className="flex flex-wrap gap-1">
                {method.features.map((feature, index) => (
                  <span
                    key={index}
                    className={`inline-block px-2 py-1 text-xs rounded ${
                      selectedGateway === method.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>

            {/* 交互反馈 */}
            {selectedGateway === method.id && !disabled && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <div className="text-sm text-blue-700">
                  已选择 {method.displayName}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 货币限制提示 */}
      {orderCurrency && paymentMethods.length === 1 && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">支付方式已根据货币自动筛选</p>
              <p className="text-xs">
                当前订单货币为 {orderCurrency}，仅显示对应的支付方式。
                {orderCurrency === 'CNY' && ' 您可以选择支付宝进行支付。'}
                {orderCurrency === 'USD' && ' 您可以选择 Creem 进行国际支付。'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 支付安全提示 */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-gray-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="text-sm text-gray-600">
            <p className="font-medium text-gray-900 mb-1">支付安全提示</p>
            <ul className="space-y-1 text-xs">
              <li>• 所有支付交易均通过加密通道进行</li>
              <li>• 我们不会存储您的支付敏感信息</li>
              <li>• 如遇到支付问题，请联系客服</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 禁用状态提示 */}
      {disabled && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center text-sm text-yellow-800">
            <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            当前订单状态无法更改支付方式
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentMethods;