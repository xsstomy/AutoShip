/**
 * API 配置
 * 统一管理所有 API 相关的配置
 */

/**
 * API 基础 URL
 * 优先使用环境变量 VITE_API_URL，否则使用默认值 http://localhost:3100
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3100'

/**
 * API 路径前缀
 */
export const API_PREFIX = '/api/v1'

/**
 * 完整的 API 基础路径
 */
export const API_FULL_URL = `${API_BASE_URL}${API_PREFIX}`

/**
 * 管理后台 API 路径
 */
export const ADMIN_API_URL = `${API_BASE_URL}${API_PREFIX}/admin`

/**
 * 超时配置（毫秒）
 */
export const API_TIMEOUT = {
  DEFAULT: 10000,
  LONG: 30000,
} as const
