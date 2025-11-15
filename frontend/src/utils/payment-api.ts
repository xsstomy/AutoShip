/**
 * 支付相关 API 调用工具函数
 */

import type { OrderInfo, PaymentInitRequest, PaymentInitResponse, PaymentStatusResponse } from '../types/payment';
import type { Currency } from '../types/product';
import { API_FULL_URL } from '../config/api';

/**
 * 支付网关信息（与后端 GatewayInfo 对应）
 */
export interface PaymentGatewayInfo {
  id: string;
  name: string;
  displayName: string;
  supportedCurrencies: Currency[];
  recommendedCurrency: Currency;
  isEnabled: boolean;
}

/**
 * 通用 API 请求处理
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    const response = await fetch(`${API_FULL_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network request failed');
  }
}

/**
 * 获取订单信息
 */
export async function getOrderInfo(orderId: string): Promise<OrderInfo> {
  const response = await apiRequest<{ success: boolean; data: OrderInfo }>(`/orders/${orderId}`);
  if (!response.success || !response.data) {
    throw new Error('获取订单信息失败');
  }
  return response.data;
}

/**
 * 初始化支付
 */
export async function initPayment(request: PaymentInitRequest): Promise<PaymentInitResponse> {
  // 注意：这个API可能不需要，因为订单创建时已经生成了支付链接
  // 这里暂时使用重试支付API来获取新的支付链接
  const response = await apiRequest<{ success: boolean; data: any }>(`/checkout/payments/${request.orderId}/retry`, {
    method: 'POST',
  });
  if (!response.success || !response.data) {
    throw new Error('初始化支付失败');
  }
  return {
    success: true,
    data: {
      paymentUrl: response.data.paymentUrl,
      gatewayOrderId: response.data.gatewayOrderId,
      expiresAt: response.data.expiresAt,
    }
  };
}

/**
 * 查询支付状态
 */
export async function getPaymentStatus(orderId: string): Promise<PaymentStatusResponse> {
  const response = await apiRequest<{ success: boolean; data: any }>(`/checkout/payments/${orderId}/status`);
  if (!response.success || !response.data) {
    throw new Error('查询支付状态失败');
  }
  return {
    success: true,
    data: {
      status: response.data.status,
      gatewayOrderId: response.data.gatewayOrderId,
      paidAt: response.data.paidAt,
      failedReason: response.data.failedReason,
    }
  };
}

/**
 * 重试支付
 */
export async function retryPayment(orderId: string): Promise<PaymentInitResponse> {
  const response = await apiRequest<{ success: boolean; data: any }>(`/checkout/payments/${orderId}/retry`, {
    method: 'POST',
  });
  if (!response.success || !response.data) {
    throw new Error('重试支付失败');
  }
  return {
    success: true,
    data: {
      paymentUrl: response.data.paymentUrl,
      gatewayOrderId: response.data.gatewayOrderId,
      expiresAt: response.data.expiresAt,
    }
  };
}

/**
 * 验证订单 ID 格式
 */
export function isValidOrderId(orderId: string): boolean {
  // 支持两种格式：
  // 1. UUID 格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  // 2. ORDER 格式：ORDER + 14位时间戳 + 4位随机数
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const orderRegex = /^ORDER\d{18}$/; // ORDER + 14位时间戳

  return uuidRegex.test(orderId) || orderRegex.test(orderId);
}

/**
 * 从 URL 获取订单 ID
 */
export function getOrderIdFromUrl(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('orderId');

  if (!orderId || !isValidOrderId(orderId)) {
    return null;
  }

  return orderId;
}

/**
 * 格式化货币显示
 */
export function formatCurrency(amount: number, currency: string): string {
  const formatter = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: currency === 'CNY' ? 'CNY' : 'USD',
    minimumFractionDigits: 2,
  });

  return formatter.format(amount);
}

/**
 * 生成支付窗口名称
 */
export function generatePaymentWindowName(gateway: string, orderId: string): string {
  return `payment_${gateway}_${orderId}`;
}

/**
 * 货币相关常量
 */
const DEFAULT_CURRENCY = 'CNY';

/**
 * 获取可用的支付网关列表
 * @returns 网关列表，如果失败返回空数组
 */
export async function getAvailableGateways(): Promise<PaymentGatewayInfo[]> {
  try {
    const response = await apiRequest<{
      success: boolean;
      data: {
        gateways: PaymentGatewayInfo[];
        currencyGatewayMap: Record<string, string[]>;
      };
    }>('/checkout/payments/gateways');

    if (!response.success || !response.data) {
      throw new Error(`API返回错误: ${response.success ? '未知错误' : '请求失败'}`);
    }

    console.log('[payment-api] 获取到支付网关:', response.data.gateways.length, '个');
    return response.data.gateways;
  } catch (error) {
    // 分类错误类型
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('[payment-api] 网络错误 - 无法连接到服务器:', error);
    } else if (error instanceof Error) {
      console.error('[payment-api] 获取支付网关失败:', error.message);
    } else {
      console.error('[payment-api] 获取支付网关失败:', error);
    }

    // 降级：返回空数组，调用方应处理此情况
    return [];
  }
}

/**
 * 根据网关列表推荐货币
 * @param gateways 支付网关列表
 * @returns 推荐的货币
 */
export function getRecommendedCurrency(gateways: PaymentGatewayInfo[]): Currency {
  if (gateways.length === 0) {
    console.warn(`[payment-api] 无可用网关，使用默认货币 ${DEFAULT_CURRENCY}`);
    return DEFAULT_CURRENCY; // 保守默认
  }

  if (gateways.length === 1) {
    const recommendedCurrency = gateways[0].recommendedCurrency;
    console.log(`[payment-api] 单网关 "${gateways[0].id}"，推荐货币: ${recommendedCurrency}`);
    return recommendedCurrency;
  }

  // 多网关：优先推荐 CNY（国内用户友好）
  const alipayGateway = gateways.find(g => g.id === 'alipay');
  if (alipayGateway) {
    console.log(`[payment-api] 多网关环境，优先推荐 ${DEFAULT_CURRENCY}（支付宝）`);
    return DEFAULT_CURRENCY;
  }

  const recommendedCurrency = gateways[0].recommendedCurrency;
  console.log(`[payment-api] 多网关环境，无支付宝，推荐: ${recommendedCurrency}`);
  return recommendedCurrency;
}

/**
 * 根据货币获取对应的支付网关
 * @param gateways 支付网关列表
 * @param currency 货币类型
 * @returns 匹配的支付网关列表
 */
export function getGatewaysByCurrency(
  gateways: PaymentGatewayInfo[],
  currency: Currency
): PaymentGatewayInfo[] {
  const matchingGateways = gateways.filter(gateway =>
    gateway.supportedCurrencies.includes(currency)
  );

  console.log(`[payment-api] 货币 ${currency} 匹配 ${matchingGateways.length} 个网关:`, matchingGateways.map(g => g.id));
  return matchingGateways;
}