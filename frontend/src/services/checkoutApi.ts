import type {
  OrderCreateRequest,
  OrderCreateResponse,
  Order,
  ApiResponse
} from '../types/order';
import type { Currency } from '../types/product';

/**
 * API 基础 URL
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * 创建订单
 * @param orderData 订单创建请求数据
 * @returns 订单创建响应
 */
export const createOrder = async (
  orderData: OrderCreateRequest
): Promise<OrderCreateResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/checkout/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    const data: ApiResponse<{
      order: Order;
      paymentUrl: string;
    }> = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    if (!data.success) {
      throw new Error(data.error || '订单创建失败');
    }

    return {
      success: true,
      order: data.data?.order,
      paymentUrl: data.data?.paymentUrl,
    };
  } catch (error) {
    console.error('创建订单失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络错误，请稍后重试',
    };
  }
};

/**
 * 获取订单详情
 * @param orderId 订单ID
 * @returns 订单详情
 */
export const getOrderById = async (orderId: string): Promise<Order> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/orders/${orderId}`);

    const data: ApiResponse<Order> = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    if (!data.success || !data.data) {
      throw new Error(data.error || '获取订单详情失败');
    }

    return data.data;
  } catch (error) {
    console.error('获取订单详情失败:', error);
    throw new Error(error instanceof Error ? error.message : '获取订单详情失败');
  }
};

/**
 * 验证商品是否可购买
 * @param productId 商品ID
 * @returns 验证结果
 */
export const validateProductForPurchase = async (
  productId: string
): Promise<{ valid: boolean; product?: any; error?: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/products/${productId}/validate`);

    const data: ApiResponse<{ valid: boolean; product?: any }> = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    if (!data.success) {
      throw new Error(data.error || '商品验证失败');
    }

    return {
      valid: data.data?.valid || false,
      product: data.data?.product,
    };
  } catch (error) {
    console.error('商品验证失败:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : '商品验证失败',
    };
  }
};

/**
 * 构建下单页面URL（用于从商品详情页跳转）
 * @param params 商品参数
 * @returns 下单页面URL
 */
export const buildCheckoutUrl = (params: {
  productId: string;
  productName: string;
  price: number;
  currency: Currency;
}): string => {
  const { productId, productName, price, currency } = params;

  // URL编码商品名称
  const encodedProductName = encodeURIComponent(productName);

  return `/checkout?productId=${productId}&productName=${encodedProductName}&price=${price}&currency=${currency}`;
};