import React, { useState, useEffect } from 'react';
import type { Currency } from '../../types/product';
import {
  getCurrencyPreference,
  saveCurrencyPreference,
  toggleCurrency,
} from '../../utils/currency';

interface CurrencyToggleProps {
  currentCurrency: Currency;
  onChange: (currency: Currency) => void;
}

/**
 * 货币切换组件
 */
const CurrencyToggle: React.FC<CurrencyToggleProps> = ({ currentCurrency, onChange }) => {
  const [localCurrency, setLocalCurrency] = useState<Currency>(currentCurrency);

  // 组件挂载时从本地存储读取货币偏好
  useEffect(() => {
    const storedCurrency = getCurrencyPreference();
    setLocalCurrency(storedCurrency);
  }, []);

  // 处理货币切换
  const handleToggle = () => {
    const newCurrency = toggleCurrency(localCurrency);
    setLocalCurrency(newCurrency);
    saveCurrencyPreference(newCurrency);
    onChange(newCurrency);
  };

  return (
    <div className="flex items-center space-x-2">
      <label className="text-sm font-medium text-gray-700">货币:</label>
      <button
        onClick={handleToggle}
        className="relative inline-flex items-center h-8 rounded-full w-16 bg-gray-200 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        aria-label="切换货币"
      >
        {/* 滑块背景 */}
        <span
          className={`inline-block w-8 h-8 transform bg-white rounded-full shadow-md transition-transform duration-200 ${
            localCurrency === 'USD' ? 'translate-x-8' : 'translate-x-0'
          }`}
        />
        {/* CNY 标签 */}
        <span
          className={`absolute left-2 text-xs font-medium transition-colors duration-200 ${
            localCurrency === 'CNY' ? 'text-white' : 'text-gray-500'
          }`}
        >
          ¥
        </span>
        {/* USD 标签 */}
        <span
          className={`absolute right-2 text-xs font-medium transition-colors duration-200 ${
            localCurrency === 'USD' ? 'text-white' : 'text-gray-500'
          }`}
        >
          $
        </span>
      </button>
      <span className="text-sm text-gray-600">
        {localCurrency === 'CNY' ? 'CNY' : 'USD'}
      </span>
    </div>
  );
};

export default CurrencyToggle;
