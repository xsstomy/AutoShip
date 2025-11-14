/**
 * 商品发货类型
 */
export type DeliveryType = 'text' | 'download' | 'hybrid';

/**
 * 货币类型
 */
export type Currency = 'CNY' | 'USD';

/**
 * 商品价格接口
 */
export interface ProductPrice {
  currency: Currency;
  price: number;
  isActive: boolean;
}

/**
 * 库存信息接口
 */
export interface Inventory {
  available: number;
  total: number;
  used: number;
}

/**
 * 商品接口（匹配后端数据结构）
 */
export interface Product {
  id: number;                    // 商品 ID
  name: string;                  // 商品名称
  description: string;           // 商品描述
  deliveryType: DeliveryType;   // 发货类型
  templateText?: string;         // 模板文本
  prices: ProductPrice[];        // 价格列表
  inventory: Inventory;          // 库存信息
  inventoryStatus: string;       // 库存状态文本
  isActive: boolean;             // 是否激活
  createdAt: string;             // 创建时间
  updatedAt: string;             // 更新时间
}

/**
 * 商品列表响应接口
 */
export interface ProductListResponse {
  success: boolean;
  data: {
    products: Product[];
    total: number;
  };
}

/**
 * 商品详情响应接口
 */
export interface ProductDetailResponse {
  success: boolean;
  data: Product;
}

/**
 * 货币转换选项
 */
export interface CurrencyConversion {
  from: Currency;
  to: Currency;
  rate: number;  // 汇率（1 CNY = ? USD）
}

/**
 * 货币显示选项
 */
export interface CurrencyDisplay {
  currency: Currency;
  symbol: string;
  label: string;
}

/**
 * API错误响应接口
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
}

/**
 * 商品卡片显示用简化接口
 */
export interface ProductCardData {
  id: number;
  name: string;
  description: string;
  prices: ProductPrice[];
  inventory: Inventory;
  inventoryStatus: string;
  deliveryType: DeliveryType;
  image?: string;
  isActive: boolean;
}

/**
 * 商品显示选项
 */
export interface ProductDisplayOptions {
  showInventory: boolean;
  showPrices: boolean;
  showDescription: boolean;
  currency?: Currency;
}
