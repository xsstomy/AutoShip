import { useState } from 'react';
import type { Order } from '../../types/orderAdmin';

interface ConfirmDialogProps {
  type: 'resend' | 'refund';
  order: Order;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}

export function ConfirmDialog({ type, order, onConfirm, onCancel }: ConfirmDialogProps) {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (type === 'refund' && !reason.trim()) {
      alert('请输入退款原因');
      return;
    }
    onConfirm(type === 'refund' ? reason : undefined);
  };

  const title = type === 'resend' ? '重发邮件' : '订单退款';
  const message = type === 'resend'
    ? `确定要重新发送订单发货邮件给 ${order.email} 吗？`
    : `确定要对订单 ${order.id} 执行退款操作吗？此操作不可撤销。`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <p className="text-gray-600 mb-4">{message}</p>

        {type === 'refund' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              退款原因 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="请输入退款原因"
              required
            />
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 text-white rounded ${
              type === 'resend'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            确认{type === 'resend' ? '重发' : '退款'}
          </button>
        </div>
      </div>
    </div>
  );
}
