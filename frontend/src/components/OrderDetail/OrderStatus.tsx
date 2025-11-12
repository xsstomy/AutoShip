import type { OrderStatus, OrderStatusConfig } from '../../types/order';

/**
 * 订单状态配置映射
 */
const ORDER_STATUS_CONFIG: Record<OrderStatus, OrderStatusConfig> = {
  pending: {
    label: '等待支付',
    color: 'yellow',
    icon: '⏳',
    description: '订单已创建，等待用户完成支付'
  },
  paid: {
    label: '支付成功',
    color: 'blue',
    icon: '✅',
    description: '支付已完成，正在准备发货'
  },
  delivered: {
    label: '已发货',
    color: 'green',
    icon: '📦',
    description: '商品已发货，请查收邮件或查看下方内容'
  },
  cancelled: {
    label: '已取消',
    color: 'gray',
    icon: '❌',
    description: '订单已被取消'
  },
  refunded: {
    label: '已退款',
    color: 'gray',
    icon: '💰',
    description: '订单已退款'
  }
};

/**
 * 订单状态组件属性
 */
interface OrderStatusProps {
  status: OrderStatus;
  className?: string;
}

/**
 * 订单状态展示组件
 */
export function OrderStatus({ status, className = '' }: OrderStatusProps) {
  const config = ORDER_STATUS_CONFIG[status];

  const colorClasses: Record<string, string> = {
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    green: 'bg-green-100 text-green-800 border-green-200',
    gray: 'bg-gray-100 text-gray-800 border-gray-200'
  };

  const currentColorClass = colorClasses[config.color];

  return (
    <div className={`space-y-2 ${className}`}>
      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${currentColorClass}`}>
        <span className="mr-2">{config.icon}</span>
        {config.label}
      </div>
      <p className="text-sm text-gray-600">
        {config.description}
      </p>
    </div>
  );
}