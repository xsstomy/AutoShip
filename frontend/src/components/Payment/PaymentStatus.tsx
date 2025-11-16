/**
 * 支付状态展示组件
 */

import React, { useState, useEffect } from 'react';
import type { PaymentStatus } from '../../types/payment';

/**
 * 组件属性
 */
interface PaymentStatusProps {
  status: PaymentStatus | null;
  isLoading?: boolean;
  error?: string | null;
  elapsedTime?: number;
  onRefresh?: () => void;
  onRetry?: () => void;
  showRefreshButton?: boolean;
  showRetryButton?: boolean;
  className?: string;
}

/**
 * 支付状态组件
 */
const PaymentStatusDisplay: React.FC<PaymentStatusProps> = ({
  status,
  isLoading = false,
  error = null,
  elapsedTime = 0,
  onRefresh,
  onRetry,
  showRefreshButton = true,
  showRetryButton = false,
  className = ''
}) => {
  const [countdown, setCountdown] = useState(0);

  // 处理成功倒计时
  useEffect(() => {
    if (status === 'paid') {
      setCountdown(3); // 3秒倒计时
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [status]);

  /**
   * 格式化轮询时间
   */
  const formatElapsedTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  /**
   * 获取状态配置
   */
  const getStatusConfig = (status: PaymentStatus | null) => {
    const configs: Record<PaymentStatus, {
      color: string;
      bgColor: string;
      icon: React.ReactNode;
      title: string;
      description: string;
      showCountdown?: boolean;
    }> = {
      pending: {
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        icon: (
          <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ),
        title: '等待支付中',
        description: '请在支付页面完成支付操作',
      },
      processing: {
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        icon: (
          <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ),
        title: '支付处理中',
        description: '支付网关正在处理您的支付，请稍候',
      },
      paid: {
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        icon: (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        ),
        title: '支付成功',
        description: '支付已完成，正在跳转到订单详情页...',
        showCountdown: true,
      },
      failed: {
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        icon: (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        ),
        title: '支付失败',
        description: '支付过程中出现问题，请重试或选择其他支付方式',
      },
      cancelled: {
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        icon: (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        ),
        title: '支付已取消',
        description: '您已取消支付，可以重新发起支付',
      },
      timeout: {
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        icon: (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        ),
        title: '支付超时',
        description: '支付时间已超时，请重新下单',
      },
    };

    return status ? configs[status] : null;
  };

  /**
   * 渲染加载状态
   */
  if (isLoading && !status) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">正在查询支付状态...</p>
          </div>
        </div>
      </div>
    );
  }

  /**
   * 渲染错误状态
   */
  if (error && !status) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-red-800 mb-2">查询失败</h3>
            <p className="text-red-700 mb-4">{error}</p>
            <div className="flex space-x-3">
              {showRefreshButton && onRefresh && (
                <button
                  onClick={onRefresh}
                  className="bg-red-100 text-red-800 px-4 py-2 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                >
                  重新查询
                </button>
              )}
              {showRetryButton && onRetry && (
                <button
                  onClick={onRetry}
                  className="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  重新支付
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /**
   * 渲染支付状态
   */
  const statusConfig = getStatusConfig(status);

  if (!statusConfig) {
    return null;
  }

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <div className="flex items-start space-x-4">
        {/* 状态图标 */}
        <div className={`flex-shrink-0 w-12 h-12 ${statusConfig.bgColor} rounded-full flex items-center justify-center ${statusConfig.color}`}>
          {statusConfig.icon}
        </div>

        {/* 状态内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-2">
            <h3 className={`text-lg font-semibold ${statusConfig.color}`}>
              {statusConfig.title}
            </h3>
            {status === 'paid' && countdown > 0 && (
              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                {countdown}s
              </span>
            )}
          </div>

          <p className="text-gray-600 mb-4">{statusConfig.description}</p>

          {/* 轮询时间显示 */}
          {(status === 'pending' || status === 'processing') && elapsedTime > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">查询时长：</span>
                <span className="font-mono text-gray-900">{formatElapsedTime(elapsedTime)}</span>
              </div>
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min((elapsedTime % 3) / 3 * 100, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex flex-wrap gap-3">
            {showRefreshButton && (status === 'pending' || status === 'processing') && onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="flex items-center space-x-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                <span>手动刷新</span>
              </button>
            )}

            {showRetryButton && (status === 'failed' || status === 'cancelled') && onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center space-x-2 bg-green-100 text-green-800 px-4 py-2 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                <span>重新支付</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentStatusDisplay;