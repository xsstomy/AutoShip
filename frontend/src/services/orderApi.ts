import type { OrderDetail, ApiResponse } from '../types/order';
import { API_FULL_URL } from '../config/api';

/**
 * 订单API服务
 */
export class OrderApiService {
  /**
   * 获取订单详情
   */
  static async getOrderDetail(orderId: string): Promise<OrderDetail> {
    try {
      const response = await fetch(`${API_FULL_URL}/orders/${orderId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('订单不存在');
        }
        if (response.status === 403) {
          throw new Error('无权访问此订单');
        }
        throw new Error(`获取订单详情失败: ${response.statusText}`);
      }

      const result: ApiResponse<OrderDetail> = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || '获取订单详情失败');
      }

      return result.data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('网络连接失败，请检查网络后重试');
    }
  }

  /**
   * 获取下载链接
   */
  static async getDownloadUrl(token: string): Promise<string> {
    try {
      const response = await fetch(`${API_FULL_URL}/downloads/${token}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('下载链接不存在');
        }
        if (response.status === 410) {
          throw new Error('下载链接已失效');
        }
        throw new Error(`获取下载链接失败: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || '获取下载链接失败');
      }

      return result.data.url;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('网络连接失败，请检查网络后重试');
    }
  }
}

/**
 * 导出便捷方法
 */
export const getOrderDetail = OrderApiService.getOrderDetail.bind(OrderApiService);
export const getDownloadUrl = OrderApiService.getDownloadUrl.bind(OrderApiService);