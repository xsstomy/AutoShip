import { useState } from 'react';
import type { OrderFilters, FilterOptions } from '../../types/orderAdmin';

interface OrderFiltersProps {
  filters: OrderFilters;
  filterOptions: FilterOptions | null;
  onApply: (filters: Partial<OrderFilters>) => void;
  onReset: () => void;
  onSearch: (search: string) => void;
}

export function OrderFilters({ filters, filterOptions, onApply, onReset }: OrderFiltersProps) {
  const [localFilters, setLocalFilters] = useState<OrderFilters>(filters);

  const handleChange = (key: keyof OrderFilters, value: string) => {
    setLocalFilters({ ...localFilters, [key]: value });
  };

  const handleApply = () => {
    onApply(localFilters);
  };

  const handleReset = () => {
    setLocalFilters({
      page: 1,
      limit: 20,
      status: '',
      gateway: '',
      dateFrom: '',
      dateTo: '',
      search: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    onReset();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 订单状态 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            订单状态
          </label>
          <select
            value={localFilters.status}
            onChange={(e) => handleChange('status', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部状态</option>
            {filterOptions?.statuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        {/* 支付方式 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            支付方式
          </label>
          <select
            value={localFilters.gateway}
            onChange={(e) => handleChange('gateway', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部支付方式</option>
            {filterOptions?.gateways.map((gateway) => (
              <option key={gateway.value} value={gateway.value}>
                {gateway.label}
              </option>
            ))}
          </select>
        </div>

        {/* 开始日期 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            开始日期
          </label>
          <input
            type="date"
            value={localFilters.dateFrom}
            onChange={(e) => handleChange('dateFrom', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 结束日期 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            结束日期
          </label>
          <input
            type="date"
            value={localFilters.dateTo}
            onChange={(e) => handleChange('dateTo', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={handleApply}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          应用筛选
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          重置
        </button>
      </div>
    </div>
  );
}
