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

      // 记录支付初始化成功的详细信息
      console.log('Payment initialized successfully:', {
        orderId,
        gateway,
        hasPaymentUrl: !!response.data.paymentUrl,
        paymentUrlType: response.data.paymentUrl.trim().startsWith('<form') ? 'HTML Form' : 'URL',
        paymentUrlLength: response.data.paymentUrl.length,
        gatewayOrderId: response.data.gatewayOrderId,
        expiresAt: response.data.expiresAt
      });

      // 检测是否为HTML表单
      const isHtmlForm = response.data.paymentUrl.trim().startsWith('<form');

      if (isHtmlForm) {
        // 如果返回的是HTML表单，直接在新窗口中打开
        const htmlContent =
          response.data.paymentUrl.trim().startsWith('<!DOCTYPE') ||
            response.data.paymentUrl.trim().startsWith('<html')
            ? response.data.paymentUrl
            : `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>支付宝支付</title>
          </head>
          <body>
            ${response.data.paymentUrl}
          </body>
        </html>
      `;

        // 使用当前窗口
        document.open();
        document.write(htmlContent);
        document.close();

        // 表单里一般已经带 auto submit 的脚本了，不写也可以
        return response;
      } else {
        // 不区分手机/桌面，一律当前窗口跳转
        window.location.href = response.data.paymentUrl;
        return response;
      }
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