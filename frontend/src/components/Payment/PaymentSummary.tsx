/**
 * 订单摘要展示组件
 */

import React from 'react';
import type { OrderInfo } from '../../types/payment';
import { formatCurrency } from '../../utils/payment-api';

/**
 * 组件属性
 */
interface PaymentSummaryProps {
  orderInfo: OrderInfo;
  isLoading?: boolean;
}

/**
 * 订单摘要组件
 */
const PaymentSummary: React.FC<PaymentSummaryProps> = ({
  orderInfo,
  isLoading = false
}) => {
  /**
   * 获取订单状态显示文本
   */
  const getOrderStatusText = (status: string): string => {
    const statusMap: Record<string, string> = {
      pending: '待支付',
      paid: '已支付',
      failed: '支付失败',
      cancelled: '已取消',
      refunded: '已退款',
    };
    return statusMap[status] || status;
  };

  /**
   * 获取订单状态颜色
   */
  const getOrderStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      pending: 'text-yellow-600 bg-yellow-50',
      paid: 'text-green-600 bg-green-50',
      failed: 'text-red-600 bg-red-50',
      cancelled: 'text-gray-600 bg-gray-50',
      refunded: 'text-blue-600 bg-blue-50',
    };
    return colorMap[status] || 'text-gray-600 bg-gray-50';
  };

  /**
   * 渲染加载状态
   */
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2 mt-4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">订单信息</h2>

      <div className="space-y-4">
        {/* 订单基本信息 */}
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-gray-600 text-sm flex-shrink-0">订单编号：</span>
            <span className="font-mono text-sm text-gray-900 break-all ml-2">
              {orderInfo.id}
            </span>
          </div>

          <div className="flex justify-between items-start">
            <span className="text-gray-600 text-sm flex-shrink-0">商品名称：</span>
            <span className="font-medium text-gray-900 text-right break-all ml-2">
              {orderInfo.productName}
            </span>
          </div>

          <div className="flex justify-between items-start">
            <span className="text-gray-600 text-sm flex-shrink-0">邮箱地址：</span>
            <span className="font-medium text-gray-900 text-right break-all ml-2">
              {orderInfo.email}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-600 text-sm">创建时间：</span>
            <span className="text-gray-900 text-sm ml-2">
              {new Date(orderInfo.createdAt).toLocaleString('zh-CN')}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-600 text-sm">订单状态：</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getOrderStatusColor(orderInfo.status)}`}>
              {getOrderStatusText(orderInfo.status)}
            </span>
          </div>
        </div>

        {/* 分隔线 */}
        <div className="border-t pt-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">支付金额：</span>
            <div className="text-right">
              <span className="text-2xl font-bold text-blue-600">
                {formatCurrency(orderInfo.price, orderInfo.currency)}
              </span>
              <div className="text-xs text-gray-500 mt-1">
                {orderInfo.currency === 'CNY' ? '人民币' : '美元'}
              </div>
            </div>
          </div>
        </div>

        {/* 支付提示 */}
        {orderInfo.status !== 'pending' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-yellow-800">
                该订单当前状态为「{getOrderStatusText(orderInfo.status)}」，{orderInfo.status === 'paid' ? '请查看订单详情' : '无法进行支付'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentSummary;