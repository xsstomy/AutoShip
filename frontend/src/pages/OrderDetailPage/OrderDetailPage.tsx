import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { OrderInfo } from '../../components/OrderDetail/OrderInfo';
import { DeliveryContent } from '../../components/OrderDetail/DeliveryContent';
import { ErrorState } from '../../components/OrderDetail/ErrorState';
import { LoadingSkeleton } from '../../components/OrderDetail/LoadingSkeleton';
import { getOrderDetail } from '../../services/orderApi';
import type { OrderDetail } from '../../types/order';

/**
 * 订单详情页组件
 */
export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [state, setState] = useState({
    loading: true,
    error: null as string | null,
    order: null as OrderDetail | null
  });

  // 加载订单详情
  const loadOrderDetail = async () => {
    if (!orderId) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: '订单ID不能为空'
      }));
      return;
    }

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const order = await getOrderDetail(orderId);

      setState({
        loading: false,
        error: null,
        order
      });
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : '加载订单详情失败',
        order: null
      });
    }
  };

  // 页面加载时获取订单详情
  useEffect(() => {
    loadOrderDetail();
  }, [orderId]);

  // 更新页面标题
  useEffect(() => {
    if (state.order) {
      document.title = `订单详情 - ${state.order.productName}`;
    } else {
      document.title = '订单详情';
    }

    return () => {
      document.title = 'AutoShip - 自动发货系统';
    };
  }, [state.order]);

  // 加载状态
  if (state.loading) {
    return <LoadingSkeleton />;
  }

  // 错误状态
  if (state.error) {
    return (
      <ErrorState
        error={state.error}
        onRetry={loadOrderDetail}
      />
    );
  }

  // 正常显示订单详情
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">订单详情</h1>
          <p className="text-gray-600 mt-2">
            查看您的订单信息和商品发货状态
          </p>
        </div>

        {/* 订单信息 */}
        <OrderInfo
          order={state.order!}
          className="mb-6"
        />

        {/* 发货内容 - 只有已发货的订单才显示 */}
        {state.order?.status === 'delivered' && state.order?.delivery && (
          <DeliveryContent
            delivery={state.order.delivery}
            className="mb-6"
          />
        )}

        {/* 其他状态提示 */}
        {state.order?.status !== 'delivered' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  订单状态提醒
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  {state.order?.status === 'pending' && (
                    <p>您的订单正在等待支付，请尽快完成支付以便我们为您发货。</p>
                  )}
                  {state.order?.status === 'paid' && (
                    <p>支付已完成，我们正在为您准备商品，请耐心等待发货通知。</p>
                  )}
                  {state.order?.status === 'cancelled' && (
                    <p>此订单已被取消，如有疑问请联系客服。</p>
                  )}
                  {state.order?.status === 'refunded' && (
                    <p>此订单已退款，退款将在1-3个工作日内到账。</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 帮助信息 */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 mb-4">
            需要帮助？请联系客服：
          </p>
          <a
            href="mailto:support@example.com"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            📧 support@example.com
          </a>
        </div>
      </div>
    </div>
  );
}