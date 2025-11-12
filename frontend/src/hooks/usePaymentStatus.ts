/**
 * 支付状态查询自定义 Hook
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { PaymentStatus, PaymentStatusResponse } from '../types/payment';
import { getPaymentStatus } from '../utils/payment-api';

/**
 * Hook 配置选项
 */
interface UsePaymentStatusOptions {
  orderId: string;
  pollInterval?: number; // 轮询间隔，默认3秒
  maxPollTime?: number; // 最大轮询时间，默认15分钟
  autoStart?: boolean; // 是否自动开始轮询
  onStatusChange?: (status: PaymentStatus, response: PaymentStatusResponse) => void;
  onSuccess?: (response: PaymentStatusResponse) => void;
  onFailure?: (response: PaymentStatusResponse) => void;
  onTimeout?: () => void;
  onError?: (error: string) => void;
}

/**
 * Hook 返回值类型
 */
interface UsePaymentStatusReturn {
  status: PaymentStatus | null;
  isLoading: boolean;
  error: string | null;
  isPolling: boolean;
  elapsedTime: number; // 已轮询时间（秒）
  lastResponse: PaymentStatusResponse | null;
  startPolling: () => void;
  stopPolling: () => void;
  checkStatus: () => Promise<void>;
  reset: () => void;
}

/**
 * 支付状态轮询 Hook
 */
export const usePaymentStatus = ({
  orderId,
  pollInterval = 3000,
  maxPollTime = 15 * 60 * 1000, // 15分钟
  autoStart = false,
  onStatusChange,
  onSuccess,
  onFailure,
  onTimeout,
  onError,
}: UsePaymentStatusOptions): UsePaymentStatusReturn => {
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [lastResponse, setLastResponse] = useState<PaymentStatusResponse | null>(null);

  // 使用 useRef 来存储轮询相关状态，避免闭包问题
  const pollIntervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedTimeRef = useRef<number | null>(null);
  const isPollingRef = useRef(false);

  /**
   * 检查支付状态
   */
  const checkStatus = useCallback(async () => {
    if (!orderId) {
      const errorMsg = '订单ID不能为空';
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await getPaymentStatus(orderId);
      setLastResponse(response);

      if (!response.success) {
        throw new Error(response.error || '查询支付状态失败');
      }

      if (!response.data?.status) {
        throw new Error('支付状态数据异常');
      }

      const newStatus = response.data.status;
      const oldStatus = status;

      // 更新状态
      setStatus(newStatus);

      // 触发状态变化回调
      if (newStatus !== oldStatus) {
        console.log(`Payment status changed from ${oldStatus} to ${newStatus}`);
        onStatusChange?.(newStatus, response);
      }

      // 处理不同的支付状态
      switch (newStatus) {
        case 'paid':
          console.log('Payment successful!');
          onSuccess?.(response);
          stopPolling();
          break;

        case 'failed':
        case 'cancelled':
          console.log(`Payment ${newStatus}`);
          onFailure?.(response);
          stopPolling();
          break;

        case 'pending':
        case 'processing':
          // 继续轮询
          break;

        default:
          console.warn('Unknown payment status:', newStatus);
          break;
      }
    } catch (err) {
      console.error('Failed to check payment status:', err);
      const errorMsg = err instanceof Error ? err.message : '查询支付状态失败';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [orderId, status, onStatusChange, onSuccess, onFailure, onError]);

  /**
   * 开始轮询
   */
  const startPolling = useCallback(() => {
    if (!orderId) {
      const errorMsg = '订单ID不能为空';
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    if (isPollingRef.current) {
      console.warn('Polling already in progress');
      return;
    }

    console.log('Starting payment status polling for order:', orderId);
    setIsPolling(true);
    isPollingRef.current = true;
    startTimeRef.current = Date.now();
    setElapsedTime(0);

    // 立即检查一次状态
    checkStatus();

    // 设置定时轮询
    pollIntervalRef.current = setInterval(() => {
      checkStatus();
    }, pollInterval);

    // 设置计时器更新
    elapsedTimeRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setElapsedTime(Math.floor(elapsed / 1000));

      // 检查是否超时
      if (elapsed >= maxPollTime) {
        console.log('Payment polling timeout');
        stopPolling();
        onTimeout?.();
      }
    }, 1000);
  }, [orderId, pollInterval, maxPollTime, checkStatus, onTimeout, onError]);

  /**
   * 停止轮询
   */
  const stopPolling = useCallback(() => {
    console.log('Stopping payment status polling');

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (elapsedTimeRef.current) {
      clearInterval(elapsedTimeRef.current);
      elapsedTimeRef.current = null;
    }

    setIsPolling(false);
    isPollingRef.current = false;
  }, []);

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    stopPolling();
    setStatus(null);
    setIsLoading(false);
    setError(null);
    setElapsedTime(0);
    setLastResponse(null);
    startTimeRef.current = 0;
  }, [stopPolling]);

  
  // 自动开始轮询
  useEffect(() => {
    if (autoStart && orderId && !isPollingRef.current) {
      startPolling();
    }

    return () => {
      // 组件卸载时清理轮询
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (elapsedTimeRef.current) {
        clearInterval(elapsedTimeRef.current);
      }
    };
  }, [autoStart, orderId, startPolling]);

  // 监听页面可见性变化，页面可见时继续轮询
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isPollingRef.current && status === 'pending') {
        // 页面重新可见时，立即检查一次状态
        checkStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkStatus, status]);

  return {
    status,
    isLoading,
    error,
    isPolling,
    elapsedTime,
    lastResponse,
    startPolling,
    stopPolling,
    checkStatus,
    reset,
  };
};