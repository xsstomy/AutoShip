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
        const windowName = generatePaymentWindowName(gateway, orderId);
        const windowFeatures = 'width=800,height=600,scrollbars=yes,resizable=yes,location=yes,menubar=no';

        // 创建新窗口
        const newWindow = window.open('', windowName, windowFeatures);

        if (!newWindow) {
          throw new Error('无法打开支付窗口，请检查浏览器弹窗设置');
        }

        // 直接写入支付宝返回的HTML表单到新窗口
        // 支付宝的HTML表单可能需要手动提交
        console.log('[PaymentGateway] Opening payment window with HTML form', {
          windowName,
          htmlLength: response.data.paymentUrl.length,
          htmlStartsWithForm: response.data.paymentUrl.trim().startsWith('<form'),
          hasSubmitScript: response.data.paymentUrl.includes('submit') || response.data.paymentUrl.includes('autoSubmit')
        });

        // 写入HTML内容到新窗口
        // 如果HTML不包含完整的HTML结构，添加包装
        const htmlContent = response.data.paymentUrl.trim().startsWith('<!DOCTYPE') ||
                           response.data.paymentUrl.trim().startsWith('<html')
          ? response.data.paymentUrl
          : `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>支付宝支付</title>
            </head>
            <body>
              ${response.data.paymentUrl}
            </body>
            </html>
          `;

        newWindow.document.open();
        newWindow.document.write(htmlContent);
        newWindow.document.close();

        // 等待窗口加载完成后，查找并提交表单
        setTimeout(() => {
          try {
            const forms = newWindow.document.forms;
            if (forms.length > 0) {
              const form = forms[0];
              console.log('[PaymentGateway] Submitting payment form, form details:', {
                formCount: forms.length,
                formAction: form.action,
                formMethod: form.method,
                inputCount: form.elements.length
              });
              // 提交表单
              form.submit();
              console.log('[PaymentGateway] Payment form submitted successfully');
            } else {
              console.error('[PaymentGateway] No form found in payment window');
            }
          } catch (error) {
            console.error('[PaymentGateway] Error submitting payment form:', error);
          }
        }, 100); // 延迟100ms确保HTML已解析

        console.log('[PaymentGateway] HTML form written to payment window successfully');
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

        return response;
      } else {
        // 如果是标准URL，按照原有逻辑处理
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );

        let newWindow: Window | null = null;

        try {
          if (isMobile) {
            // 移动设备：直接跳转到支付页面
            window.location.href = response.data.paymentUrl;
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