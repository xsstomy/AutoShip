import type { Currency } from './product';

/**
 * 订单状态类型
 */
export type OrderStatus = 'pending' | 'paid' | 'delivered' | 'cancelled' | 'refunded';

/**
 * 支付网关类型
 */
export type PaymentGateway = 'alipay' | 'creem' | 'paypal';

/**
 * 订单创建请求接口
 */
export interface OrderCreateRequest {
  productId: string;           // 商品 ID
  productName: string;         // 商品名称
  price: number;              // 价格
  currency: Currency;         // 货币类型
  email: string;              // 邮箱地址
  gateway: PaymentGateway;    // 支付网关
}

/**
 * 订单接口
 */
export interface Order {
  id: string;                 // 订单 ID (UUID)
  productId: string;         // 商品 ID
  email: string;             // 邮箱地址
  gateway: PaymentGateway;   // 支付网关
  amount: number;            // 订单金额
  currency: Currency;        // 货币类型
  status: OrderStatus;       // 订单状态
  gatewayOrderId?: string;   // 支付网关订单 ID
  createdAt: string;         // 创建时间
  updatedAt: string;         // 更新时间
}

/**
 * 订单创建响应接口
 */
export interface OrderCreateResponse {
  success: boolean;          // 创建是否成功
  order?: Order;             // 订单信息
  paymentUrl?: string;       // 支付页面 URL
  error?: string;            // 错误信息
}

/**
 * API 响应基础接口
 */
export interface ApiResponse<T = any> {
  success: boolean;          // 请求是否成功
  data?: T;                 // 响应数据
  error?: string;           // 错误信息
  message?: string;         // 响应消息
}

/**
 * 下单页面表单数据接口
 */
export interface CheckoutFormData {
  email: string;            // 邮箱地址
}

/**
 * 下单页面状态接口
 */
export interface CheckoutPageState {
  loading: boolean;         // 加载状态
  error: string | null;     // 错误信息
  order: Order | null;      // 订单信息
  formData: CheckoutFormData; // 表单数据
  formErrors: {
    email?: string;         // 邮箱错误信息
  };
}

/**
 * 商品查询参数接口（从商品详情页传递）
 */
export interface ProductQueryParams {
  productId: string;        // 商品 ID
  productName: string;      // 商品名称
  price: string;            // 价格（字符串格式）
  currency: Currency;       // 货币类型
}