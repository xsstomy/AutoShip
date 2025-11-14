/**
 * 支付页面主组件
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { PaymentGateway } from '../../types/payment';
import { useOrderInfo } from '../../hooks/useOrderInfo';
import { usePaymentStatus } from '../../hooks/usePaymentStatus';
import PaymentSummary from './PaymentSummary';
import PaymentMethods from './PaymentMethods';
import PaymentRedirect from './PaymentRedirect';
import PaymentStatusComponent from './PaymentStatus';

/**
 * 支付页面组件属性
 */
interface PaymentPageProps {}

/**
 * 支付页面组件
 */
const PaymentPage: React.FC<PaymentPageProps> = () => {
  const navigate = useNavigate();
  const params = useParams();

  // 获取订单ID
  const orderId = params.orderId || new URLSearchParams(window.location.search).get('orderId');

  // 使用自定义 hooks
  const { orderInfo, isLoading, error, refetch } = useOrderInfo(orderId);

  // 支付相关状态
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway>('alipay');
  const [paymentStarted, setPaymentStarted] = useState(false);

  // 支付状态轮询
  const {
    status: paymentStatus,
    isLoading: isStatusLoading,
    error: statusError,
    elapsedTime,
    startPolling,
    stopPolling,
    checkStatus,
    reset: resetStatusPolling,
  } = usePaymentStatus({
    orderId: orderId || '',
    pollInterval: 3000, // 3秒轮询间隔
    maxPollTime: 15 * 60 * 1000, // 15分钟超时
    autoStart: false, // 手动启动轮询
    onStatusChange: (status) => {
      console.log('Payment status changed:', status);
    },
    onSuccess: () => {
      console.log('Payment successful!');
      // 3秒后跳转到订单详情页
      setTimeout(() => {
        navigate(`/order/${orderId}`);
      }, 3000);
    },
    onFailure: () => {
      console.log('Payment failed');
      setPaymentStarted(false);
      stopPolling();
    },
    onTimeout: () => {
      console.log('Payment polling timeout');
      setPaymentStarted(false);
      stopPolling();
    },
    onError: (error) => {
      console.error('Payment status polling error:', error);
    },
  });

  /**
   * 返回商品页面
   */
  const handleBackToProducts = () => {
    navigate('/');
  };

  /**
   * 重新加载订单信息
   */
  const handleReload = () => {
    refetch();
  };

  /**
   * 处理支付开始
   */
  const handlePaymentStart = () => {
    setPaymentStarted(true);
    // 延迟1秒后开始轮询，给支付页面跳转留出时间
    setTimeout(() => {
      startPolling();
    }, 1000);
  };

  /**
   * 处理支付错误
   */
  const handlePaymentError = (error: string) => {
    console.error('Payment error:', error);
    setPaymentStarted(false);
  };

  /**
   * 处理重新支付
   */
  const handleRetryPayment = () => {
    setPaymentStarted(false);
    resetStatusPolling();
  };

  /**
   * 手动刷新支付状态
   */
  const handleRefreshStatus = () => {
    checkStatus();
  };

  // 页面加载完成后，如果订单状态是待支付，自动开始状态监控
  useEffect(() => {
    if (orderInfo && orderInfo.status === 'pending' && !paymentStarted) {
      // 不自动开始轮询，等用户点击支付按钮
    }
  }, [orderInfo, paymentStarted]);

  /**
   * 渲染加载状态
   */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载订单信息...</p>
        </div>
      </div>
    );
  }

  /**
   * 渲染错误状态
   */
  if (error || !orderInfo || !orderId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">加载失败</h2>
            <p className="text-gray-600 mb-6">{error || '订单信息不存在'}</p>
            <div className="space-y-3">
              <button
                onClick={handleReload}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                重新加载
              </button>
              <button
                onClick={handleBackToProducts}
                className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                返回商品页面
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const canPay = orderInfo.status === 'pending' && !paymentStarted;

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* 页面标题 */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">确认支付</h1>
          <p className="text-gray-600 text-sm sm:text-base">
            {paymentStarted ? '正在处理您的支付' : '请选择支付方式完成订单'}
          </p>
        </div>

        {/* 订单信息展示 */}
        <PaymentSummary orderInfo={orderInfo} isLoading={isLoading} />

        {/* 支付状态展示 */}
        {(paymentStarted || paymentStatus || statusError) && (
          <div className="mb-4 sm:mb-6">
            <PaymentStatusComponent
              status={paymentStatus}
              isLoading={isStatusLoading}
              error={statusError}
              elapsedTime={elapsedTime}
              onRefresh={handleRefreshStatus}
              onRetry={handleRetryPayment}
              showRefreshButton={!paymentStarted && paymentStatus === 'pending'}
              showRetryButton={paymentStatus === 'failed' || paymentStatus === 'cancelled'}
            />
          </div>
        )}

        {/* 支付方式选择 */}
        {!paymentStarted && (
          <div className="mb-4 sm:mb-6">
            <PaymentMethods
              selectedGateway={selectedGateway}
              onGatewayChange={setSelectedGateway}
              disabled={!canPay}
              orderCurrency={orderInfo?.currency as 'CNY' | 'USD' | undefined}
            />
          </div>
        )}

        {/* 支付按钮 */}
        {!paymentStarted && (
          <PaymentRedirect
            orderId={orderId}
            gateway={selectedGateway}
            amount={orderInfo.price}
            currency={orderInfo.currency}
            onPaymentStart={handlePaymentStart}
            onPaymentError={handlePaymentError}
            disabled={!canPay}
          />
        )}

        {/* 支付进行中的提示 */}
        {paymentStarted && !paymentStatus && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">正在处理支付</h3>
            <p className="text-blue-700 mb-4 text-sm sm:text-base">
              请在{selectedGateway === 'alipay' ? '支付宝' : '支付平台'}页面完成支付操作
            </p>
            <p className="text-blue-600 text-xs sm:text-sm">
              支付完成后本页面将自动更新，请勿关闭此窗口
            </p>
          </div>
        )}

        {/* 底部操作 */}
        <div className="mt-6 sm:mt-8 text-center">
          <button
            onClick={handleBackToProducts}
            className="text-gray-600 hover:text-gray-800 text-sm underline"
          >
            返回商品页面
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;