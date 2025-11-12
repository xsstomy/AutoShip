-- AutoShip Database Schema
-- Compatible with Cloudflare D1 (SQLite)

-- Products table - 商品信息
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK (length(name) >= 1 AND length(name) <= 255),
  description TEXT CHECK (length(description) <= 2000),
  template_text TEXT, -- 发货模板文本
  delivery_type TEXT NOT NULL DEFAULT 'text' CHECK (delivery_type IN ('text', 'download', 'hybrid')),
  is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER DEFAULT 0, -- 排序字段
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Product prices - 商品定价（支持多币种）
CREATE TABLE IF NOT EXISTS product_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('CNY', 'USD', 'EUR', 'JPY')),
  price DECIMAL(10,2) NOT NULL CHECK (price > 0),
  is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE(product_id, currency) -- 确保每个商品每种货币只有一个价格
);

-- Orders - 订单记录
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY CHECK (length(id) = 36), -- UUID格式
  product_id INTEGER NOT NULL,
  email TEXT NOT NULL CHECK (email LIKE '%@%.%'), -- 基础邮箱格式验证
  gateway TEXT NOT NULL CHECK (gateway IN ('alipay', 'creem', 'stripe')),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency IN ('CNY', 'USD', 'EUR', 'JPY')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'refunded', 'failed', 'cancelled', 'delivered')),
  gateway_order_id TEXT, -- 第三方支付订单ID
  gateway_data TEXT, -- 支付网关返回的额外数据（JSON格式）
  notes TEXT, -- 订单备注
  customer_ip TEXT, -- 客户IP地址
  customer_user_agent TEXT, -- 客户浏览器信息
  paid_at DATETIME, -- 支付时间
  delivered_at DATETIME, -- 发货时间
  refunded_at DATETIME, -- 退款时间
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Deliveries - 发货记录
CREATE TABLE IF NOT EXISTS deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  delivery_type TEXT NOT NULL CHECK (delivery_type IN ('text', 'download', 'hybrid')),
  content TEXT, -- 文本内容（卡密、许可证等）
  download_url TEXT, -- 完整的下载URL
  download_token TEXT CHECK (download_token IS NULL OR length(download_token) >= 32), -- 下载token
  expires_at DATETIME, -- 下载链接过期时间
  download_count INTEGER DEFAULT 0 CHECK (download_count >= 0), -- 下载次数
  max_downloads INTEGER DEFAULT 3 CHECK (max_downloads > 0), -- 最大下载次数
  file_size INTEGER, -- 文件大小（字节）
  file_name TEXT, -- 文件名
  is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)), -- 是否有效（退款后会失效）
  delivery_method TEXT DEFAULT 'email' CHECK (delivery_method IN ('email', 'api', 'manual')), -- 发货方式
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Downloads - 下载日志
CREATE TABLE IF NOT EXISTS downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_id INTEGER NOT NULL,
  ip_address TEXT CHECK (ip_address IS NULL OR length(ip_address) >= 7), -- 基础IP格式验证
  user_agent TEXT,
  referer TEXT, -- 来源页面
  download_status TEXT DEFAULT 'success' CHECK (download_status IN ('success', 'failed', 'partial')),
  bytes_downloaded INTEGER CHECK (bytes_downloaded >= 0), -- 实际下载字节数
  download_time_ms INTEGER, -- 下载耗时（毫秒）
  downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE
);

-- Payments raw - 支付回调日志（幂等与验签记录）
CREATE TABLE IF NOT EXISTS payments_raw (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gateway TEXT NOT NULL CHECK (gateway IN ('alipay', 'creem', 'stripe')),
  gateway_order_id TEXT,
  gateway_transaction_id TEXT, -- 网关交易ID（可能与order_id不同）
  signature_valid INTEGER DEFAULT 0 CHECK (signature_valid IN (0, 1)), -- 签名是否有效
  signature_method TEXT, -- 签名方法：RSA2, HMAC等
  payload TEXT NOT NULL, -- 回调原始payload
  processed INTEGER DEFAULT 0 CHECK (processed IN (0, 1)), -- 是否已处理
  processing_attempts INTEGER DEFAULT 0 CHECK (processing_attempts >= 0), -- 处理尝试次数
  error_message TEXT, -- 处理错误信息
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME -- 处理完成时间
);

-- Inventory text - 文本库存（可用于卡密池）
CREATE TABLE IF NOT EXISTS inventory_text (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  content TEXT NOT NULL CHECK (length(content) >= 1),
  batch_name TEXT, -- 批次名称（用于库存管理）
  priority INTEGER DEFAULT 0, -- 优先级，数字越大优先级越高
  is_used INTEGER DEFAULT 0 CHECK (is_used IN (0, 1)), -- 是否已使用
  used_order_id TEXT, -- 使用的订单ID
  used_at DATETIME, -- 使用时间
  expires_at DATETIME, -- 过期时间
  metadata TEXT, -- 额外元数据（JSON格式）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT, -- 创建者
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CHECK (
    (is_used = 0 AND used_order_id IS NULL AND used_at IS NULL) OR
    (is_used = 1 AND used_order_id IS NOT NULL AND used_at IS NOT NULL)
  )
);

-- Settings - 系统配置项
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY CHECK (length(key) >= 1 AND length(key) <= 100),
  value TEXT,
  data_type TEXT DEFAULT 'string' CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
  description TEXT CHECK (length(description) <= 500),
  is_public INTEGER DEFAULT 0 CHECK (is_public IN (0, 1)), -- 是否可公开访问
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT -- 更新者
);

-- 新增：管理员操作日志表
CREATE TABLE IF NOT EXISTS admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'view', 'export')),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('order', 'product', 'inventory', 'setting', 'delivery')),
  resource_id TEXT, -- 资源ID
  old_values TEXT, -- 修改前的值（JSON）
  new_values TEXT, -- 修改后的值（JSON）
  ip_address TEXT,
  user_agent TEXT,
  success INTEGER DEFAULT 1 CHECK (success IN (0, 1)),
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 新增：文件存储表（用于下载文件管理）
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT NOT NULL CHECK (length(file_name) >= 1),
  original_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0),
  mime_type TEXT,
  checksum TEXT, -- 文件校验和
  is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_gateway ON orders(gateway);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_gateway_order_id ON orders(gateway_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_currency ON orders(currency);

CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_token ON deliveries(download_token);
CREATE INDEX IF NOT EXISTS idx_deliveries_type ON deliveries(delivery_type);
CREATE INDEX IF NOT EXISTS idx_deliveries_expires_at ON deliveries(expires_at);
CREATE INDEX IF NOT EXISTS idx_deliveries_active ON deliveries(is_active);

CREATE INDEX IF NOT EXISTS idx_downloads_delivery_id ON downloads(delivery_id);
CREATE INDEX IF NOT EXISTS idx_downloads_ip_address ON downloads(ip_address);
CREATE INDEX IF NOT EXISTS idx_downloads_downloaded_at ON downloads(downloaded_at);
CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(download_status);

CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_text(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_used ON inventory_text(is_used);
CREATE INDEX IF NOT EXISTS idx_inventory_batch ON inventory_text(batch_name);
CREATE INDEX IF NOT EXISTS idx_inventory_priority ON inventory_text(priority DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_expires_at ON inventory_text(expires_at);

CREATE INDEX IF NOT EXISTS idx_payments_gateway ON payments_raw(gateway);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments_raw(gateway_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_processed ON payments_raw(processed);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments_raw(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_signature_valid ON payments_raw(signature_valid);

CREATE INDEX IF NOT EXISTS idx_product_prices_product ON product_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_currency ON product_prices(currency);
CREATE INDEX IF NOT EXISTS idx_product_prices_active ON product_prices(is_active);

CREATE INDEX IF NOT EXISTS idx_files_name ON files(file_name);
CREATE INDEX IF NOT EXISTS idx_files_active ON files(is_active);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_email ON admin_logs(admin_email);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_logs_resource_type ON admin_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at);

-- Insert default product (更新为包含新字段)
INSERT OR IGNORE INTO products (id, name, description, delivery_type, is_active, sort_order)
VALUES (1, '默认商品', '系统默认商品，用于测试', 'text', 1, 0);

-- Insert default product prices
INSERT OR IGNORE INTO product_prices (product_id, currency, price, is_active)
VALUES
  (1, 'CNY', 9.90, 1),
  (1, 'USD', 1.39, 1);

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value, data_type, description, is_public)
VALUES
  ('default_gateway', 'alipay', 'string', '默认支付网关', 0),
  ('allow_gateway_param', 'true', 'boolean', '是否允许URL参数覆盖网关', 0),
  ('site_base_url', 'http://localhost:5173', 'string', '网站基础URL', 1),
  ('download_expire_hours', '72', 'number', '下载链接有效期（小时）', 0),
  ('max_downloads', '3', 'number', '最大下载次数', 0),
  ('email_from_address', 'noreply@autoship.com', 'string', '发件人邮箱地址', 0),
  ('email_from_name', 'AutoShip', 'string', '发件人名称', 0),
  ('site_name', 'AutoShip', 'string', '网站名称', 1),
  ('site_description', '自动发货数字商品平台', 'string', '网站描述', 1),
  ('max_inventory_batch_size', '1000', 'number', '单次导入库存最大数量', 0),
  ('order_timeout_hours', '24', 'number', '订单超时时间（小时）', 0),
  ('enable_order_notification', 'true', 'boolean', '是否启用订单通知', 0),
  ('enable_delivery_notification', 'true', 'boolean', '是否启用发货通知', 0),
  ('admin_session_timeout_minutes', '60', 'number', '管理员会话超时时间（分钟）', 0);
