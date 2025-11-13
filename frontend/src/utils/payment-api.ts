/**
 * 支付相关 API 调用工具函数
 */

import type { OrderInfo, PaymentInitRequest, PaymentInitResponse, PaymentStatusResponse } from '../types/payment';

/**
 * API 基础 URL
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

/**
 * 通用 API 请求处理
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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