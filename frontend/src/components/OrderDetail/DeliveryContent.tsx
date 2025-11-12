import { useState } from 'react';
import type { DeliveryContent } from '../../types/order';
import { DownloadLink } from './DownloadLink';

/**
 * 发货内容组件属性
 */
interface DeliveryContentProps {
  delivery: DeliveryContent;
  className?: string;
}

/**
 * 发货内容展示组件
 */
export function DeliveryContent({ delivery, className = '' }: DeliveryContentProps) {
  const [copied, setCopied] = useState(false);

  // 处理文本内容复制
  const handleCopyContent = async () => {
    if (!delivery.content) return;

    try {
      await navigator.clipboard.writeText(delivery.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 文本内容展示
  if (delivery.type === 'text' && delivery.content) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          📋 商品内容
        </h3>

        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            您的数字商品内容如下，请妥善保存：
          </p>

          <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm font-medium text-gray-700">激活码/许可证</span>
              <button
                onClick={handleCopyContent}
                className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
              >
                {copied ? '✓ 已复制' : '📋 一键复制'}
              </button>
            </div>

            <div className="font-mono text-sm text-gray-900 break-all bg-white p-3 rounded border border-gray-300">
              {delivery.content}
            </div>
          </div>

          {copied && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded-md text-sm">
              ✓ 内容已复制到剪贴板
            </div>
          )}
        </div>
      </div>
    );
  }

  // 下载文件展示
  if (delivery.type === 'download' && delivery.downloadUrl) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          📁 商品下载
        </h3>

        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            您的数字商品已准备就绪，请点击下方按钮下载：
          </p>

          <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-medium text-gray-900">{delivery.fileName || '数字商品文件'}</h4>
                {delivery.fileSize && (
                  <p className="text-sm text-gray-500">{formatFileSize(delivery.fileSize)}</p>
                )}
              </div>
            </div>

            <DownloadLink url={delivery.downloadUrl} fileName={delivery.fileName} />
          </div>

          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-md text-sm">
            <p className="font-medium mb-1">📌 下载说明：</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>下载链接有效期为72小时</li>
              <li>每个链接最多可下载3次</li>
              <li>请及时下载并妥善保存文件</li>
              <li>如有问题请联系客服
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return null;
}