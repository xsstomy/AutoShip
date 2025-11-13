import type { OrderDetail } from '../../types/order';
import { OrderStatus } from './OrderStatus';
import { formatCurrency } from '../../utils/currency';

/**
 * 订单信息组件属性
 */
interface OrderInfoProps {
  order: OrderDetail;
  className?: string;
}

/**
 * 订单基本信息展示组件
 */
export function OrderInfo({ order, className = '' }: OrderInfoProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">订单信息</h2>

      <div className="space-y-4">
        {/* 订单ID */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-sm font-medium text-gray-500 w-24">订单号:</span>
          <span className="text-sm text-gray-900 font-mono bg-gray-50 px-2 py-1 rounded">
            {order.id}
          </span>
        </div>

        {/* 商品名称 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-sm font-medium text-gray-500 w-24">商品:</span>
          <span className="text-sm text-gray-900">{order.productName}</span>
        </div>

        {/* 订单金额 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-sm font-medium text-gray-500 w-24">金额:</span>
          <span className="text-sm text-gray-900 font-medium">
            {formatCurrency(order.amount, order.currency)}
          </span>
        </div>

        {/* 邮箱地址 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-sm font-medium text-gray-500 w-24">邮箱:</span>
          <span className="text-sm text-gray-900">{order.email}</span>
        </div>

        {/* 支付网关 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-sm font-medium text-gray-500 w-24">支付方式:</span>
          <span className="text-sm text-gray-900">
            {order.gateway === 'alipay' ? '支付宝' :
             order.gateway === 'creem' ? '支付平台' : 'PayPal'}
          </span>
        </div>

        {/* 订单状态 */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-gray-500">订单状态:</span>
          <OrderStatus status={order.status} />
        </div>

        {/* 创建时间 */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-sm font-medium text-gray-500 w-24">创建时间:</span>
          <span className="text-sm text-gray-900">{formatDate(order.createdAt)}</span>
        </div>

        {/* 更新时间 */}
        {order.updatedAt !== order.createdAt && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm font-medium text-gray-500 w-24">更新时间:</span>
            <span className="text-sm text-gray-900">{formatDate(order.updatedAt)}</span>
          </div>
        )}
      </div>
    </div>
  );
}