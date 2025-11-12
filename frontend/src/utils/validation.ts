/**
 * 邮箱验证工具函数
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