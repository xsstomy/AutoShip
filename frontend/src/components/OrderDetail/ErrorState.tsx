import { useEffect } from 'react';

/**
 * 错误状态组件属性
 */
interface ErrorStateProps {
  error: string;
  onRetry?: () => void;
  showRetry?: boolean;
  showHomeLink?: boolean;
  className?: string;
}

/**
 * 错误状态展示组件
 */
export function ErrorState({
  error,
  onRetry,
  showRetry = true,
  showHomeLink = true,
  className = ''
}: ErrorStateProps) {
  // 获取错误图标和标题
  const getErrorInfo = (errorMessage: string) => {
    if (errorMessage.includes('不存在') || errorMessage.includes('404')) {
      return {
        icon: '🔍',
        title: '订单不存在',
        description: '请检查订单号是否正确，或联系客服获取帮助。'
      };
    }

    if (errorMessage.includes('无权访问') || errorMessage.includes('403')) {
      return {
        icon: '🔒',
        title: '访问受限',
        description: '您无权访问此订单，请确认这是您的订单。'
      };
    }

    if (errorMessage.includes('网络') || errorMessage.includes('连接')) {
      return {
        icon: '🌐',
        title: '网络连接失败',
        description: '请检查您的网络连接，稍后重试。'
      };
    }

    return {
      icon: '⚠️',
      title: '加载失败',
      description: errorMessage || '发生了未知错误，请稍后重试。'
    };
  };

  const errorInfo = getErrorInfo(error);

  useEffect(() => {
    // 错误发生时滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [error]);

  return (
    <div className={`min-h-[60vh] flex items-center justify-center px-4 ${className}`}>
      <div className="text-center max-w-md w-full">
        {/* 错误图标 */}
        <div className="text-6xl mb-4">{errorInfo.icon}</div>

        {/* 错误标题 */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {errorInfo.title}
        </h2>

        {/* 错误描述 */}
        <p className="text-gray-600 mb-8">
          {errorInfo.description}
        </p>

        {/* 操作按钮 */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {showRetry && onRetry && (
            <button
              onClick={onRetry}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              🔄 重新加载
            </button>
          )}

          {showHomeLink && (
            <a
              href="/"
              className="px-6 py-3 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              🏠 返回首页
            </a>
          )}
        </div>

        {/* 联系客服信息 */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-2">
            需要帮助？请联系客服：
          </p>
          <p className="text-sm text-gray-800">
            📧 support@example.com
          </p>
        </div>
      </div>
    </div>
  );
}