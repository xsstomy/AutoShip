import axios, { AxiosError } from 'axios';
import type { ProductListResponse, ProductDetailResponse } from '../types/product';
import { mockProducts } from '../mock/products';

/**
 * API 基础配置
 * 默认使用环境变量 VITE_API_URL 或回退到 localhost:3000
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * 创建 Axios 实例
 */
const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 请求拦截器 - 添加认证 token（如果需要）
 */
apiClient.interceptors.request.use(
  (config) => {
    // 可以在这里添加认证 token
    // const token = localStorage.getItem('auth_token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

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
    const message = error.response?.data?.message || '请求失败';

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
  // 开发模式下返回模拟数据
  if (import.meta.env.DEV) {
    await new Promise(resolve => setTimeout(resolve, 500)); // 模拟网络延迟
    return {
      products: mockProducts,
      total: mockProducts.length,
    };
  }

  try {
    const response = await apiClient.get<ProductListResponse>('/products');
    return response.data;
  } catch (error) {
    console.error('获取商品列表失败:', error);
    throw error;
  }
};

/**
 * 根据 ID 获取商品详情
 * @param id 商品 ID
 * @returns Promise<ProductDetailResponse>
 */
export const getProductById = async (id: string): Promise<ProductDetailResponse> => {
  // 开发模式下返回模拟数据
  if (import.meta.env.DEV) {
    await new Promise(resolve => setTimeout(resolve, 300)); // 模拟网络延迟
    const product = mockProducts.find(p => p.id === id);
    if (!product) {
      throw new Error('商品不存在');
    }
    return { product };
  }

  try {
    const response = await apiClient.get<ProductDetailResponse>(`/products/${id}`);
    return response.data;
  } catch (error) {
    console.error('获取商品详情失败:', error);
    throw error;
  }
};

/**
 * 刷新商品缓存（强制从服务器重新获取）
 * @returns Promise<ProductListResponse>
 */
export const refreshProducts = async (): Promise<ProductListResponse> => {
  try {
    const response = await apiClient.get<ProductListResponse>('/products', {
      params: { refresh: true },
    });
    return response.data;
  } catch (error) {
    console.error('刷新商品列表失败:', error);
    throw error;
  }
};
