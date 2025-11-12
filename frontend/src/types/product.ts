/**
 * 商品类型
 */
export type ProductType = 'card_key' | 'download' | 'license';

/**
 * 货币类型
 */
export type Currency = 'CNY' | 'USD';

/**
 * 商品接口
 */
export interface Product {
  id: string;                    // 商品 ID
  name: string;                  // 商品名称
  description: string;           // 商品描述
  price: number;                 // 价格（基础价格，以 CNY 为基准）
  currency: Currency;            // 基础货币类型（默认 CNY）
  image?: string;                // 商品封面图片 URL
  type: ProductType;             // 商品类型
  stock: number;                 // 库存数量
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}

/**
 * 商品列表响应接口
 */
export interface ProductListResponse {
  products: Product[];
  total: number;
}

/**
 * 商品详情响应接口
 */
export interface ProductDetailResponse {
  product: Product;
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
 * 商品卡片显示用简化接口
 */
export interface ProductCardData {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: Currency;
  image?: string;
  type: ProductType;
  stock: number;
}
