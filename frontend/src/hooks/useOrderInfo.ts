/**
 * 订单信息获取自定义 Hook
 */

import { useState, useEffect, useCallback } from 'react';
import type { OrderInfo } from '../types/payment';
import { getOrderInfo, isValidOrderId } from '../utils/payment-api';

/**
 * Hook 返回值类型
 */
interface UseOrderInfoReturn {
  orderInfo: OrderInfo | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  clearError: () => void;
}

/**
 * 订单信息获取 Hook
 * @param orderId 订单 ID
 * @returns 订单信息和相关状态
 */
export const useOrderInfo = (orderId: string | null): UseOrderInfoReturn => {
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 获取订单信息
   */
  const fetchOrderInfo = useCallback(async () => {
    if (!orderId) {
      setError('订单ID不能为空');
      return;
    }

    if (!isValidOrderId(orderId)) {
      setError('无效的订单ID格式');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const data = await getOrderInfo(orderId);
      setOrderInfo(data);
    } catch (err) {
      console.error('Failed to fetch order info:', err);
      const errorMessage = err instanceof Error ? err.message : '获取订单信息失败';
      setError(errorMessage);
      setOrderInfo(null);
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  /**
   * 清除错误信息
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * 手动重新获取订单信息
   */
  const refetch = useCallback(async () => {
    await fetchOrderInfo();
  }, [fetchOrderInfo]);

  // 当 orderId 变化时自动获取订单信息
  useEffect(() => {
    if (orderId) {
      fetchOrderInfo();
    }
  }, [orderId, fetchOrderInfo]);

  return {
    orderInfo,
    isLoading,
    error,
    refetch,
    clearError,
  };
};