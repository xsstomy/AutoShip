import type { Order } from '../../types/orderAdmin';

interface OrderDetailProps {
  order: Order;
  onClose: () => void;
}

export function OrderDetail({ order, onClose }: OrderDetailProps) {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">订单详情</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      <div className="space-y-6">
        {/* 基本信息 */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">基本信息</h3>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">订单ID</dt>
              <dd className="mt-1 text-sm text-gray-900">{order.id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">商品名称</dt>
              <dd className="mt-1 text-sm text-gray-900">{order.product?.name || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">用户邮箱</dt>
              <dd className="mt-1 text-sm text-gray-900">{order.email}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">订单状态</dt>
              <dd className="mt-1 text-sm text-gray-900">{order.status}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">支付金额</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {order.amount.toFixed(2)} {order.currency}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">支付方式</dt>
              <dd className="mt-1 text-sm text-gray-900">{order.gateway}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">创建时间</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(order.createdAt).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">更新时间</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(order.updatedAt).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>

        {/* 支付信息 */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">支付信息</h3>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">网关订单ID</dt>
              <dd className="mt-1 text-sm text-gray-900">{order.gatewayOrderId || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">支付时间</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {order.paidAt ? new Date(order.paidAt).toLocaleString() : '-'}
              </dd>
            </div>
          </dl>
        </div>

        {/* 发货信息 */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">发货信息</h3>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">发货时间</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">退款时间</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {order.refundedAt ? new Date(order.refundedAt).toLocaleString() : '-'}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
