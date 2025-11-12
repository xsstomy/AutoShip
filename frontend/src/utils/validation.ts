/**
 * 输入验证和安全工具函数
 */

/**
 * 验证邮箱格式是否正确
 * @param email 邮箱地址
 * @returns 是否为有效邮箱格式
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * 验证邮箱地址并提供详细的错误信息
 * @param email 邮箱地址
 * @returns 验证结果，包含是否有效和错误信息
 */
export const validateEmail = (email: string): { isValid: boolean; error?: string } => {
  if (!email) {
    return { isValid: false, error: '请输入邮箱地址' };
  }

  if (email.trim().length === 0) {
    return { isValid: false, error: '邮箱地址不能为空' };
  }

  if (email.length > 254) {
    return { isValid: false, error: '邮箱地址过长' };
  }

  if (!isValidEmail(email)) {
    return { isValid: false, error: '请输入有效的邮箱地址' };
  }

  // 检查邮箱是否包含连续的点
  if (email.includes('..')) {
    return { isValid: false, error: '邮箱地址格式不正确' };
  }

  // 检查邮箱是否以点开始或结束
  if (email.startsWith('.') || email.endsWith('.')) {
    return { isValid: false, error: '邮箱地址格式不正确' };
  }

  return { isValid: true };
};

/**
 * 清理和格式化邮箱地址
 * @param email 邮箱地址
 * @returns 清理后的邮箱地址
 */
export const sanitizeEmail = (email: string): string => {
  return email.trim().toLowerCase();
};

/**
 * 验证商品ID是否有效
 * @param productId 商品ID
 * @returns 验证结果
 */
export const validateProductId = (productId: string): { isValid: boolean; error?: string } => {
  if (!productId) {
    return { isValid: false, error: '商品ID不能为空' };
  }

  if (productId.trim().length === 0) {
    return { isValid: false, error: '商品ID不能为空' };
  }

  // 检查是否为数字或UUID格式
  const validIdPattern = /^(\d+|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
  if (!validIdPattern.test(productId)) {
    return { isValid: false, error: '商品ID格式不正确' };
  }

  return { isValid: true };
};

/**
 * 验证价格是否有效
 * @param price 价格字符串
 * @returns 验证结果
 */
export const validatePrice = (price: string): { isValid: boolean; error?: string; value?: number } => {
  if (!price) {
    return { isValid: false, error: '价格不能为空' };
  }

  const priceNumber = parseFloat(price);

  if (isNaN(priceNumber)) {
    return { isValid: false, error: '价格格式不正确' };
  }

  if (priceNumber <= 0) {
    return { isValid: false, error: '价格必须大于0' };
  }

  if (priceNumber > 999999.99) {
    return { isValid: false, error: '价格超出范围' };
  }

  // 检查小数位数
  const decimalPlaces = (price.split('.')[1] || '').length;
  if (decimalPlaces > 2) {
    return { isValid: false, error: '价格最多保留两位小数' };
  }

  return { isValid: true, value: priceNumber };
};

/**
 * 验证货币类型是否有效
 * @param currency 货币类型
 * @returns 验证结果
 */
export const validateCurrency = (currency: string): { isValid: boolean; error?: string } => {
  if (!currency) {
    return { isValid: false, error: '货币类型不能为空' };
  }

  const validCurrencies = ['CNY', 'USD'];
  if (!validCurrencies.includes(currency.toUpperCase())) {
    return { isValid: false, error: '不支持的货币类型' };
  }

  return { isValid: true };
};

// ==================== 支付相关验证函数 ====================

/**
 * 订单 ID 验证结果
 */
interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitized?: string;
}

/**
 * 验证订单 ID 格式
 * @param orderId 订单 ID
 * @returns 验证结果
 */
export function validateOrderId(orderId: string): ValidationResult {
  if (!orderId) {
    return {
      isValid: false,
      error: '订单ID不能为空',
    };
  }

  // 清理输入，移除可能的危险字符
  const sanitized = orderId.trim().replace(/[<>\"']/g, '');

  if (sanitized !== orderId) {
    return {
      isValid: false,
      error: '订单ID包含非法字符',
    };
  }

  // UUID 格式验证 (简单的 v4 UUID 格式)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(sanitized)) {
    return {
      isValid: false,
      error: '订单ID格式不正确',
    };
  }

  return {
    isValid: true,
    sanitized,
  };
}

/**
 * 验证支付网关类型
 * @param gateway 支付网关
 * @returns 验证结果
 */
export function validatePaymentGateway(gateway: string): ValidationResult {
  if (!gateway) {
    return {
      isValid: false,
      error: '支付网关不能为空',
    };
  }

  const validGateways = ['alipay', 'creem'];
  if (!validGateways.includes(gateway.toLowerCase())) {
    return {
      isValid: false,
      error: '不支持的支付网关',
    };
  }

  return {
    isValid: true,
    sanitized: gateway.toLowerCase(),
  };
}

/**
 * 验证 URL 参数
 * @param url URL 字符串
 * @returns 验证结果
 */
export function validateUrl(url: string): ValidationResult {
  if (!url) {
    return {
      isValid: false,
      error: 'URL不能为空',
    };
  }

  try {
    // 尝试创建 URL 对象来验证格式
    const urlObj = new URL(url);

    // 检查协议是否为 http 或 https
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return {
        isValid: false,
        error: 'URL协议不安全',
      };
    }

    // 检查域名是否为白名单（可根据需要扩展）
    const allowedDomains = [
      'alipay.com',
      'alipayplus.com',
      'creem.io',
      // 可以根据实际需要添加更多域名
    ];

    const domain = urlObj.hostname.toLowerCase();
    const isAllowedDomain = allowedDomains.some(allowed =>
      domain === allowed || domain.endsWith(`.${allowed}`)
    );

    if (!isAllowedDomain) {
      console.warn('URL domain not in whitelist:', domain);
      // 在生产环境中，这里应该返回 false
      // return {
      //   isValid: false,
      //   error: 'URL域名不在允许列表中',
      // };
    }

    return {
      isValid: true,
      sanitized: url,
    };
  } catch {
    return {
      isValid: false,
      error: 'URL格式不正确',
    };
  }
}

/**
 * 清理和验证用户输入
 * @param input 用户输入
 * @param maxLength 最大长度限制
 * @returns 清理后的字符串
 */
export function sanitizeInput(input: string, maxLength = 1000): string {
  if (!input) return '';

  // 移除 HTML 标签和特殊字符
  let cleaned = input
    .replace(/<[^>]*>/g, '') // 移除 HTML 标签
    .replace(/[<>\"']/g, '') // 移除潜在的 HTML 字符
    .trim();

  // 限制长度
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength);
  }

  return cleaned;
}

/**
 * 创建安全的支付参数
 * @param params 原始参数
 * @returns 验证后的安全参数
 */
export function createSafePaymentParams(params: {
  orderId: string;
  gateway: string;
  amount: number;
  currency: string;
}): { isValid: boolean; error?: string; params?: any } {
  const orderIdValidation = validateOrderId(params.orderId);
  if (!orderIdValidation.isValid) {
    return {
      isValid: false,
      error: orderIdValidation.error,
    };
  }

  const gatewayValidation = validatePaymentGateway(params.gateway);
  if (!gatewayValidation.isValid) {
    return {
      isValid: false,
      error: gatewayValidation.error,
    };
  }

  const amountValidation = validatePrice(params.amount.toString());
  if (!amountValidation.isValid) {
    return {
      isValid: false,
      error: amountValidation.error,
    };
  }

  const currencyValidation = validateCurrency(params.currency);
  if (!currencyValidation.isValid) {
    return {
      isValid: false,
      error: currencyValidation.error,
    };
  }

  return {
    isValid: true,
    params: {
      orderId: orderIdValidation.sanitized,
      gateway: gatewayValidation.sanitized,
      amount: amountValidation.value,
      currency: params.currency.toUpperCase(),
    },
  };
}

/**
 * 检测是否为移动设备
 * @returns 是否为移动设备
 */
export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * 生成安全的随机字符串
 * @param length 字符串长度
 * @returns 随机字符串
 */
export function generateSecureRandom(length = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * 防抖函数
 * @param func 要防抖的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * 节流函数
 * @param func 要节流的函数
 * @param delay 延迟时间（毫秒）
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  };
}