import type { CurrencyDisplay, Currency } from '../types/product';

/**
 * 货币汇率（1 CNY = ? USD）
 * 这里使用固定汇率，实际应该从 API 获取
 */
const CNY_TO_USD_RATE = 0.14;

/**
 * 货币常量
 */
const CURRENCY_VALUES = {
  CNY: 'CNY',
  USD: 'USD',
} as const;

/**
 * 货币显示信息配置
 */
const CURRENCY_DISPLAYS: Record<Currency, CurrencyDisplay> = {
  [CURRENCY_VALUES.CNY]: {
    currency: CURRENCY_VALUES.CNY,
    symbol: '¥',
    label: 'CNY',
  },
  [CURRENCY_VALUES.USD]: {
    currency: CURRENCY_VALUES.USD,
    symbol: '$',
    label: 'USD',
  },
};

/**
 * 货币显示信息映射表
 */
export const currencyDisplayMap: Record<Currency, CurrencyDisplay> = CURRENCY_DISPLAYS;

/**
 * 转换货币
 * @param amount 金额
 * @param fromCurrency 源货币
 * @param toCurrency 目标货币
 * @returns 转换后的金额
 */
export const convertCurrency = (
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency
): number => {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  // 转换为以 CNY 为基准
  let baseAmount: number;
  if (fromCurrency === CURRENCY_VALUES.CNY) {
    baseAmount = amount;
  } else {
    // USD -> CNY
    baseAmount = amount / CNY_TO_USD_RATE;
  }

  // 从 CNY 转换为目标货币
  if (toCurrency === CURRENCY_VALUES.CNY) {
    return baseAmount;
  } else {
    // CNY -> USD
    return baseAmount * CNY_TO_USD_RATE;
  }
};

/**
 * 格式化货币显示
 * @param amount 金额
 * @param currency 货币类型
 * @returns 格式化后的货币字符串
 */
export const formatCurrency = (amount: number, currency: Currency): string => {
  const display = currencyDisplayMap[currency];
  const formattedAmount = amount.toFixed(2);
  return `${display.symbol}${formattedAmount} ${display.label}`;
};

/**
 * 获取货币显示信息
 * @param currency 货币类型
 * @returns 货币显示信息
 */
export const getCurrencyDisplay = (currency: Currency): CurrencyDisplay => {
  return currencyDisplayMap[currency];
};

/**
 * 切换货币
 * @param currentCurrency 当前货币
 * @returns 切换后的货币
 */
export const toggleCurrency = (currentCurrency: Currency): Currency => {
  return currentCurrency === CURRENCY_VALUES.CNY ? CURRENCY_VALUES.USD : CURRENCY_VALUES.CNY;
};

/**
 * 获取本地存储的货币偏好
 * @returns 货币类型
 */
export const getCurrencyPreference = (): Currency => {
  const stored = localStorage.getItem('preferred_currency');
  if (stored && (stored === CURRENCY_VALUES.CNY || stored === CURRENCY_VALUES.USD)) {
    return stored as Currency;
  }
  return CURRENCY_VALUES.CNY; // 默认人民币
};

/**
 * 保存货币偏好到本地存储
 * @param currency 货币类型
 */
export const saveCurrencyPreference = (currency: Currency): void => {
  localStorage.setItem('preferred_currency', currency);
};
