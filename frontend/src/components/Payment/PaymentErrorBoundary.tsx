/**
 * 支付页面错误边界组件
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * 错误边界状态
 */
interface PaymentErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

/**
 * 错误边界属性
 */
interface PaymentErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  maxRetries?: number;
}

/**
 * 支付页面错误边界组件
 */
class PaymentErrorBoundary extends Component<PaymentErrorBoundaryProps, PaymentErrorBoundaryState> {
  private retryTimeoutId: number | null = null;

  constructor(props: PaymentErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<PaymentErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // 调用错误回调
    this.props.onError?.(error, errorInfo);

    // 记录错误到控制台
    console.error('Payment Error Boundary caught an error:', error, errorInfo);
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  /**
   * 重试渲染
   */
  handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount < maxRetries) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: retryCount + 1,
      });
    }
  };

  /**
   * 返回上一页
   */
  handleGoBack = () => {
    window.history.back();
  };

  /**
   * 刷新页面
   */
  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    const { hasError, error, errorInfo, retryCount } = this.state;
    const { children, fallback, maxRetries = 3 } = this.props;

    if (hasError) {
      // 如果提供了自定义 fallback，使用它
      if (fallback) {
        return <>{fallback}</>;
      }

      // 默认错误界面
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 max-w-md w-full mx-4">
            <div className="text-center">
              {/* 错误图标 */}
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>

              {/* 错误标题 */}
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                支付页面出现问题
              </h2>

              {/* 错误信息 */}
              <p className="text-gray-600 mb-6 text-sm">
                很抱歉，支付页面遇到了一个错误。请尝试刷新页面或返回上一步。
              </p>

              {/* 重试计数 */}
              {retryCount > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="text-yellow-800 text-xs">
                    已重试 {retryCount} 次
                    {retryCount >= maxRetries && '，已达到最大重试次数'}
                  </p>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="space-y-3">
                {retryCount < maxRetries && (
                  <button
                    onClick={this.handleRetry}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    重试
                  </button>
                )}

                <button
                  onClick={this.handleRefresh}
                  className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                >
                  刷新页面
                </button>

                <button
                  onClick={this.handleGoBack}
                  className="w-full text-gray-600 hover:text-gray-800 text-sm underline"
                >
                  返回上一页
                </button>
              </div>

              {/* 开发环境下的错误详情 */}
              {import.meta.env.DEV && error && (
                <details className="mt-6 text-left">
                  <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                    错误详情 (开发模式)
                  </summary>
                  <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono text-gray-800 max-h-40 overflow-auto">
                    <div className="mb-2">
                      <strong>错误:</strong> {error.toString()}
                    </div>
                    {errorInfo && (
                      <div>
                        <strong>组件堆栈:</strong>
                        <pre className="whitespace-pre-wrap mt-1">{errorInfo.componentStack}</pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return <>{children}</>;
  }
}

export default PaymentErrorBoundary;