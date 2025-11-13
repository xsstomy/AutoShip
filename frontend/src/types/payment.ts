/**
 * 支付相关类型定义
 */

/**
 * 支付网关类型
 */
export type PaymentGateway = 'alipay';

/**
 * 订单状态
 */
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';

/**
 * 支付状态
 */
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'timeout';

/**
 * 订单信息
 */
export interface OrderInfo {
  id: string;
  productId: string;
  productName: string;
  email: string;
  price: number;
  currency: string;
  status: OrderStatus;
  gateway: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 支付初始化请求
 */
export interface PaymentInitRequest {
  orderId: string;
  gateway: PaymentGateway;
}

/**
 * 支付初始化响应
 */
export interface PaymentInitResponse {
  success: boolean;
  data?: {
    paymentUrl: string;
    gatewayOrderId: string;
    expiresAt: string;
  };
  error?: string;
}

/**
 * 支付状态查询响应
 */
export interface PaymentStatusResponse {
  success: boolean;
  data?: {
    status: PaymentStatus;
    gatewayOrderId?: string;
    paidAt?: string;
    failedReason?: string;
  };
  error?: string;
}

/**
 * 支付方式配置
 */
export interface PaymentMethod {
  id: PaymentGateway;
  name: string;
  displayName: string;
  icon: string;
  description: string;
  recommended?: boolean;
}

/**
 * 支付页面状态
 */
export interface PaymentPageState {
  orderInfo: OrderInfo | null;
  selectedGateway: PaymentGateway;
  isLoading: boolean;
  paymentStatus: PaymentStatus | null;
  error: string | null;
  paymentWindow: Window | null;
}

/**
 * API 错误响应
 */
export interface ApiError {
  code: string;
  message: string;
  details?: any;
}