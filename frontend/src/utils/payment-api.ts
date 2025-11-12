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
  return apiRequest<OrderInfo>(`/orders/${orderId}`);
}

/**
 * 初始化支付
 */
export async function initPayment(request: PaymentInitRequest): Promise<PaymentInitResponse> {
  return apiRequest<PaymentInitResponse>(`/payment/init/${request.orderId}`, {
    method: 'POST',
    body: JSON.stringify({ gateway: request.gateway }),
  });
}

/**
 * 查询支付状态
 */
export async function getPaymentStatus(orderId: string): Promise<PaymentStatusResponse> {
  return apiRequest<PaymentStatusResponse>(`/payment/status/${orderId}`);
}

/**
 * 重试支付
 */
export async function retryPayment(orderId: string): Promise<PaymentInitResponse> {
  return apiRequest<PaymentInitResponse>(`/payment/retry/${orderId}`, {
    method: 'POST',
  });
}

/**
 * 验证订单 ID 格式
 */
export function isValidOrderId(orderId: string): boolean {
  // 简单的 UUID 格式验证
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(orderId);
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