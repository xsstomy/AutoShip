/**
 * 支付网关集成自定义 Hook
 */

import { useState, useCallback, useRef } from 'react';
import type { PaymentGateway, PaymentInitResponse } from '../types/payment';
import { initPayment, generatePaymentWindowName } from '../utils/payment-api';

/**
 * Hook 返回值类型
 */
interface UsePaymentGatewayReturn {
  isLoading: boolean;
  error: string | null;
  paymentWindow: Window | null;
  initPayment: (orderId: string, gateway: PaymentGateway) => Promise<PaymentInitResponse | null>;
  closePaymentWindow: () => void;
  clearError: () => void;
}

/**
 * 支付网关 Hook
 * @returns 支付网关相关状态和方法
 */
export const usePaymentGateway = (): UsePaymentGatewayReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentWindow, setPaymentWindow] = useState<Window | null>(null);

  // 用于防止重复初始化的 ref
  const isInitializingRef = useRef(false);

  /**
   * 清除错误信息
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * 关闭支付窗口
   */
  const closePaymentWindow = useCallback(() => {
    if (paymentWindow && !paymentWindow.closed) {
      paymentWindow.close();
    }
    setPaymentWindow(null);
  }, [paymentWindow]);

  /**
   * 初始化支付
   * @param orderId 订单ID
   * @param gateway 支付网关
   * @returns 支付初始化响应
   */
  const handleInitPayment = useCallback(async (
    orderId: string,
    gateway: PaymentGateway
  ): Promise<PaymentInitResponse | null> => {
    // 防止重复初始化
    if (isInitializingRef.current) {
      console.warn('Payment initialization already in progress');
      return null;
    }

    try {
      isInitializingRef.current = true;
      setIsLoading(true);
      setError(null);

      // 关闭之前的支付窗口
      closePaymentWindow();

      console.log(`Initializing payment for order ${orderId} with gateway ${gateway}`);

      // 调用支付初始化 API
      const response = await initPayment({ orderId, gateway });

      if (!response.success) {
        throw new Error(response.error || '支付初始化失败');
      }

      if (!response.data?.paymentUrl) {
        throw new Error('支付URL获取失败');
      }

      console.log('Payment initialized successfully:', response.data);

      // 检测是否为移动设备
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

      let newWindow: Window | null = null;

      try {
        if (isMobile) {
          // 移动设备：直接跳转到支付页面
          window.location.href = response.data.paymentUrl;
          // 在移动设备上，跳转后当前页面会被替换，所以不需要返回
          return response;
        } else {
          // 桌面设备：在新窗口中打开支付页面
          const windowName = generatePaymentWindowName(gateway, orderId);
          const windowFeatures = 'width=800,height=600,scrollbars=yes,resizable=yes,location=yes,menubar=no';

          newWindow = window.open(response.data.paymentUrl, windowName, windowFeatures);

          if (!newWindow) {
            throw new Error('无法打开支付窗口，请检查浏览器弹窗设置');
          }

          setPaymentWindow(newWindow);

          // 监听支付窗口关闭事件
          const checkClosed = setInterval(() => {
            if (newWindow?.closed) {
              clearInterval(checkClosed);
              setPaymentWindow(null);
            }
          }, 1000);

          // 5分钟后自动清理监听器
          setTimeout(() => {
            clearInterval(checkClosed);
          }, 5 * 60 * 1000);
        }
      } catch (windowError) {
        console.error('Failed to open payment window:', windowError);
        // 如果打开新窗口失败，在当前窗口跳转
        window.location.href = response.data.paymentUrl;
        return response;
      }

      return response;
    } catch (err) {
      console.error('Payment initialization failed:', err);
      const errorMessage = err instanceof Error ? err.message : '支付初始化失败';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
      isInitializingRef.current = false;
    }
  }, [closePaymentWindow]);

  // 组件卸载时关闭支付窗口
  // 注意：这里需要在 useEffect 中处理清理

  return {
    isLoading,
    error,
    paymentWindow,
    initPayment: handleInitPayment,
    closePaymentWindow,
    clearError,
  };
};