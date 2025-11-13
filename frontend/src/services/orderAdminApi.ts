import type { OrderFilters, FilterOptions } from '../types/orderAdmin';

/**
 * 订单管理API服务
 */
export class OrderAdminApi {
  private static readonly BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

  private static getAuthHeaders() {
    const token = localStorage.getItem('admin_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }

  /**
   * 获取订单列表
   */
  static async getOrders(filters: OrderFilters) {
    const params = new URLSearchParams();

    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));
    if (filters.status) params.append('status', filters.status);
    if (filters.gateway) params.append('gateway', filters.gateway);
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);
    if (filters.search) params.append('search', filters.search);
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

    const response = await fetch(`${this.BASE_URL}/api/admin/orders?${params.toString()}`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('未授权访问，请重新登录');
      }
      if (response.status === 403) {
        throw new Error('权限不足');
      }
      throw new Error(`获取订单列表失败: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '获取订单列表失败');
    }

    return result.data;
  }

  /**
   * 获取筛选选项
   */
  static async getFilterOptions(): Promise<FilterOptions> {
    const response = await fetch(`${this.BASE_URL}/api/admin/orders/filter-options`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('获取筛选选项失败');
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '获取筛选选项失败');
    }

    return result.data;
  }

  /**
   * 重发邮件
   */
  static async resendEmail(orderId: string) {
    const response = await fetch(`${this.BASE_URL}/api/admin/orders/${orderId}/resend`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('邮件重发失败');
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '邮件重发失败');
    }

    return result.data;
  }

  /**
   * 退款
   */
  static async refundOrder(orderId: string, reason: string) {
    const response = await fetch(`${this.BASE_URL}/api/admin/orders/${orderId}/refund`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      throw new Error('退款操作失败');
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '退款操作失败');
    }

    return result.data;
  }
}

export const orderAdminApi = OrderAdminApi;
