import { useState } from 'react';

/**
 * 下载链接组件属性
 */
interface DownloadLinkProps {
  url: string;
  fileName?: string;
  className?: string;
}

/**
 * 安全下载链接组件
 */
export function DownloadLink({ url, fileName, className = '' }: DownloadLinkProps) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 处理下载
  const handleDownload = async () => {
    try {
      setDownloading(true);
      setError(null);

      // 创建临时链接并触发下载
      const link = document.createElement('a');
      link.href = url;
      if (fileName) {
        link.download = fileName;
      }
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 如果不支持download属性，在新窗口打开
      if (!fileName || !link.download) {
        window.open(url, '_blank');
      }

    } catch (err) {
      console.error('下载失败:', err);
      setError('下载失败，请稍后重试');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <button
        onClick={handleDownload}
        disabled={downloading}
        className={`w-full sm:w-auto px-6 py-3 rounded-md font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
          downloading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
        }`}
      >
        {downloading ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            下载中...
          </span>
        ) : (
          <span className="flex items-center justify-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
            </svg>
            立即下载
          </span>
        )}
      </button>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-2 rounded-md text-sm">
          ❌ {error}
        </div>
      )}

      <p className="text-xs text-gray-500">
        点击按钮开始下载，如遇问题请刷新页面重试
      </p>
    </div>
  );
}