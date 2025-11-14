import axios, { AxiosError } from 'axios';
import type { ProductListResponse, ProductDetailResponse, ApiErrorResponse } from '../types/product';

/**
 * API 基础配置
 * 默认使用环境变量 VITE_API_URL 或回退到 localhost:3000
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * 创建 Axios 实例
 */
const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 响应拦截器 - 统一错误处理
 */
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: CustomAxiosError) => {
    console.error('API Error:', error);
    // 统一错误处理，可以根据状态码返回不同的错误信息
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('请求超时，请稍后重试'));
    }
    if (!error.response) {
      return Promise.reject(new Error('网络连接失败，请检查网络'));
    }
    const status = error.response?.status ?? 500;
    const message = (error.response?.data as any)?.message || '请求失败';

    switch (status) {
      case 400:
        return Promise.reject(new Error(`请求参数错误: ${message}`));
      case 401:
        return Promise.reject(new Error('未授权，请重新登录'));
      case 403:
        return Promise.reject(new Error('禁止访问'));
      case 404:
        return Promise.reject(new Error('请求的资源不存在'));
      case 500:
        return Promise.reject(new Error('服务器内部错误'));
      default:
        return Promise.reject(new Error(message));
    }
  }
);

/**
 * API 错误类型
 */
export interface ApiError {
  message: string;
  code?: string;
}

/**
 * 扩展 AxiosError 类型
 */
interface CustomAxiosError extends AxiosError {
  response?: AxiosError['response'];
}

/**
 * 获取商品列表
 * @returns Promise<ProductListResponse>
 */
export const getProducts = async (): Promise<ProductListResponse> => {
  try {
    const response = await apiClient.get<ProductListResponse>('/products');
    return response.data;
  } catch (error) {
    console.error('获取商品列表失败:', error);

    // 如果是API错误，返回更友好的错误信息
    if (axios.isAxiosError(error) && error.response?.data) {
      const errorData = error.response.data as ApiErrorResponse;
      throw new Error(errorData.error || '获取商品列表失败');
    }

    throw new Error('网络连接失败，请检查网络设置');
  }
};

/**
 * 根据 ID 获取商品详情
 * @param id 商品 ID
 * @returns Promise<ProductDetailResponse>
 */
export const getProductById = async (id: number): Promise<ProductDetailResponse> => {
  try {
    const response = await apiClient.get<ProductDetailResponse>(`/products/${id}`);
    return response.data;
  } catch (error) {
    console.error('获取商品详情失败:', error);

    // 如果是API错误，返回更友好的错误信息
    if (axios.isAxiosError(error) && error.response?.data) {
      const errorData = error.response.data as ApiErrorResponse;
      throw new Error(errorData.error || '获取商品详情失败');
    }

    // 处理404错误
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new Error('商品不存在或已下架');
    }

    throw new Error('网络连接失败，请检查网络设置');
  }
};

/**
 * 刷新商品缓存（强制从服务器重新获取）
 * @returns Promise<ProductListResponse>
 */
export const refreshProducts = async (): Promise<ProductListResponse> => {
  try {
    // 添加时间戳来避免浏览器缓存
    const timestamp = Date.now();
    const response = await apiClient.get<ProductListResponse>('/products', {
      params: { t: timestamp },
    });
    return response.data;
  } catch (error) {
    console.error('刷新商品列表失败:', error);
    throw new Error('刷新商品列表失败，请稍后重试');
  }
};
