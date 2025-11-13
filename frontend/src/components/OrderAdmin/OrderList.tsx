import type { Order, Pagination } from '../../types/orderAdmin';

interface OrderListProps {
  orders: Order[];
  pagination: Pagination;
  onPageChange: (page: number) => void;
  onViewDetails: (order: Order) => void;
  onResendEmail: (order: Order) => void;
  onRefund: (order: Order) => void;
}

export function OrderList({ orders, pagination, onPageChange, onViewDetails, onResendEmail, onRefund }: OrderListProps) {
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      pending: { label: '待支付', className: 'bg-yellow-100 text-yellow-800' },
      paid: { label: '已支付', className: 'bg-green-100 text-green-800' },
      delivered: { label: '已发货', className: 'bg-blue-100 text-blue-800' },
      completed: { label: '已完成', className: 'bg-gray-100 text-gray-800' },
      refunded: { label: '已退款', className: 'bg-purple-100 text-purple-800' },
      failed: { label: '失败', className: 'bg-red-100 text-red-800' },
      cancelled: { label: '已取消', className: 'bg-gray-100 text-gray-600' },
    };

    const config = statusMap[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getGatewayLabel = (gateway: string) => {
    const gatewayMap: Record<string, string> = {
      alipay: '支付宝',
      creem: 'Creem',
    };
    return gatewayMap[gateway] || gateway;
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                订单ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                商品
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                用户邮箱
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                金额
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                支付方式
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                状态
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                创建时间
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {order.id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {order.product?.name || `-`}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {order.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {order.amount.toFixed(2)} {order.currency}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {getGatewayLabel(order.gateway)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(order.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(order.createdAt).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => onViewDetails(order)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    详情
                  </button>
                  {(order.status === 'paid' || order.status === 'delivered') && (
                    <button
                      onClick={() => onResendEmail(order)}
                      className="text-green-600 hover:text-green-900"
                    >
                      重发邮件
                    </button>
                  )}
                  {order.status === 'paid' && (
                    <button
                      onClick={() => onRefund(order)}
                      className="text-red-600 hover:text-red-900"
                    >
                      退款
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            显示 {(pagination.page - 1) * pagination.limit + 1} 到 {Math.min(pagination.page * pagination.limit, pagination.total)} 条，
            共 {pagination.total} 条
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={!pagination.hasPrev}
              className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            <span className="px-3 py-1">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={!pagination.hasNext}
              className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
