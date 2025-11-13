/**
 * 支付跳转处理组件
 */

import React, { useCallback } from 'react';
import type { PaymentGateway } from '../../types/payment';
import { usePaymentGateway } from '../../hooks/usePaymentGateway';
import { formatCurrency } from '../../utils/payment-api';

/**
 * 组件属性
 */
interface PaymentRedirectProps {
  orderId: string;
  gateway: PaymentGateway;
  amount: number;
  currency: string;
  onPaymentStart?: () => void;
  onPaymentError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * 支付跳转组件
 */
const PaymentRedirect: React.FC<PaymentRedirectProps> = ({
  orderId,
  gateway,
  amount,
  currency,
  onPaymentStart,
  onPaymentError,
  disabled = false,
  className = ''
}) => {
  const { isLoading, error, initPayment, clearError } = usePaymentGateway();

  /**
   * 获取支付网关显示名称
   */
  const getGatewayDisplayName = (gateway: PaymentGateway): string => {
    const gatewayNames: Record<PaymentGateway, string> = {
      alipay: '支付宝'
    };
    return gatewayNames[gateway] || gateway;
  };

  /**
   * 获取支付按钮文本
   */
  const getPaymentButtonText = (): string => {
    if (isLoading) {
      return '正在跳转...';
    }
    return `使用${getGatewayDisplayName(gateway)}支付 ${formatCurrency(amount, currency)}`;
  };

  /**
   * 处理支付按钮点击
   */
  const handlePaymentClick = useCallback(async () => {
    if (disabled || isLoading) {
      return;
    }

    try {
      clearError();
      onPaymentStart?.();

      const response = await initPayment(orderId, gateway);

      if (!response) {
        // 如果响应为空，说明可能是移动设备跳转了，或者发生了错误
        // 错误处理已经在 usePaymentGateway 中完成
        return;
      }

      console.log('Payment redirect successful:', response);
    } catch (err) {
      console.error('Payment redirect failed:', err);
      const errorMessage = err instanceof Error ? err.message : '支付跳转失败';
      onPaymentError?.(errorMessage);
    }
  }, [disabled, isLoading, orderId, gateway, initPayment, clearError, onPaymentStart, onPaymentError]);

  /**
   * 渲染支付引导信息
   */
  const renderPaymentGuide = () => {
    if (isLoading) {
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-blue-800">
              正在跳转到{getGatewayDisplayName(gateway)}支付页面，请稍候...
            </span>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 支付引导信息 */}
      {renderPaymentGuide()}

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">支付失败</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              {/* 支付宝网关错误提示 */}
              {(error.includes('Bad Gateway') || error.includes('502')) && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs">
                  <p className="font-semibold text-yellow-800">💡 提示：支付宝网关暂时不可用</p>
                  <ul className="mt-2 text-yellow-700 space-y-1 list-disc list-inside">
                    <li>这是支付宝沙箱环境的临时问题</li>
                    <li>请等待几分钟后重试</li>
                    <li>或联系支付宝开放平台确认应用状态</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 支付按钮 */}
      <button
        onClick={handlePaymentClick}
        disabled={disabled || isLoading}
        className={`w-full py-3 px-6 rounded-lg font-semibold transition-all transform ${
          disabled || isLoading
            ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] shadow-md hover:shadow-lg'
        }`}
      >
        <div className="flex items-center justify-center">
          {isLoading && (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
          )}
          <span>{getPaymentButtonText()}</span>
        </div>
      </button>

      {/* 支付提示 */}
      <div className="text-center text-sm text-gray-500 space-y-1">
        <p>点击支付按钮后将跳转到{getGatewayDisplayName(gateway)}支付页面</p>
        <p>支付完成后请返回本页面查看订单状态</p>
      </div>

      {/* 安全提示 */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="text-sm text-gray-600">
            <p className="font-medium text-gray-900 mb-1">安全支付保障</p>
            <ul className="space-y-1 text-xs">
              <li>• 支付过程采用SSL加密技术</li>
              <li>• 支付信息不会在本网站存储</li>
              <li>• 支持{getGatewayDisplayName(gateway)}的安全验证机制</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentRedirect;