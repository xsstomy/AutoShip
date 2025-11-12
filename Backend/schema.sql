-- AutoShip Database Schema
-- Compatible with Cloudflare D1 (SQLite)

-- Products table - 商品信息
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  template_text TEXT, -- 发货模板文本
  is_active INTEGER DEFAULT 1, -- 1=active, 0=inactive
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Product prices - 商品定价（支持多币种）
CREATE TABLE IF NOT EXISTS product_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  currency TEXT NOT NULL, -- CNY, USD
  price DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Orders - 订单记录
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, -- UUID
  product_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  gateway TEXT NOT NULL, -- alipay, creem
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, refunded, failed
  gateway_order_id TEXT, -- 第三方支付订单ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Deliveries - 发货记录
CREATE TABLE IF NOT EXISTS deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  delivery_type TEXT NOT NULL, -- text, download
  content TEXT, -- 文本内容（卡密、许可证等）
  download_token TEXT, -- 下载token
  expires_at DATETIME, -- 下载链接过期时间
  download_count INTEGER DEFAULT 0, -- 下载次数
  max_downloads INTEGER DEFAULT 3, -- 最大下载次数
  is_active INTEGER DEFAULT 1, -- 是否有效（退款后会失效）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Downloads - 下载日志
CREATE TABLE IF NOT EXISTS downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_id INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (delivery_id) REFERENCES deliveries(id)
);

-- Payments raw - 支付回调日志（幂等与验签记录）
CREATE TABLE IF NOT EXISTS payments_raw (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gateway TEXT NOT NULL,
  gateway_order_id TEXT,
  signature_valid INTEGER DEFAULT 0, -- 签名是否有效
  payload TEXT NOT NULL, -- 回调原始payload
  processed INTEGER DEFAULT 0, -- 是否已处理
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Inventory text - 文本库存（可用于卡密池）
CREATE TABLE IF NOT EXISTS inventory_text (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  is_used INTEGER DEFAULT 0, -- 是否已使用
  used_order_id TEXT, -- 使用的订单ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  used_at DATETIME,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Settings - 系统配置项
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_gateway ON orders(gateway);
CREATE INDEX IF NOT EXISTS idx_deliveries_token ON deliveries(download_token);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_text(product_id);
CREATE INDEX IF NOT EXISTS idx_payments_gateway ON payments_raw(gateway);

-- Insert default product
INSERT OR IGNORE INTO products (id, name, description) VALUES (1, '默认商品', '系统默认商品，用于测试');

-- Insert default product prices
INSERT OR IGNORE INTO product_prices (product_id, currency, price) VALUES (1, 'CNY', 9.90);
INSERT OR IGNORE INTO product_prices (product_id, currency, price) VALUES (1, 'USD', 1.39);

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value, description) VALUES
('default_gateway', 'alipay', '默认支付网关'),
('allow_gateway_param', 'true', '是否允许URL参数覆盖网关'),
('site_base_url', 'http://localhost:5173', '网站基础URL'),
('download_expire_hours', '72', '下载链接有效期（小时）'),
('max_downloads', '3', '最大下载次数');
