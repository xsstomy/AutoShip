-- AutoShip Database Schema Enhancement Migration
-- Version: 001
-- Description: 完善数据库表结构，添加新字段、约束和索引
-- Date: 2025-11-12

-- BEGIN TRANSACTION;

-- 1. 更新 products 表
ALTER TABLE products ADD COLUMN delivery_type TEXT NOT NULL DEFAULT 'text';
ALTER TABLE products ADD COLUMN sort_order INTEGER DEFAULT 0;
-- 添加约束（SQLite不支持直接添加约束，需要重建表，这里记录约束需求）
-- delivery_type IN ('text', 'download', 'hybrid')
-- length(name) >= 1 AND length(name) <= 255
-- length(description) <= 2000
-- is_active IN (0, 1)

-- 2. 更新 product_prices 表
ALTER TABLE product_prices ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE product_prices ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE product_prices ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;
-- 添加唯一约束（需要重建表）
-- UNIQUE(product_id, currency)
-- currency IN ('CNY', 'USD', 'EUR', 'JPY')
-- price > 0
-- is_active IN (0, 1)

-- 3. 更新 orders 表
ALTER TABLE orders ADD COLUMN gateway_data TEXT;
ALTER TABLE orders ADD COLUMN notes TEXT;
ALTER TABLE orders ADD COLUMN customer_ip TEXT;
ALTER TABLE orders ADD COLUMN customer_user_agent TEXT;
ALTER TABLE orders ADD COLUMN paid_at DATETIME;
ALTER TABLE orders ADD COLUMN delivered_at DATETIME;
ALTER TABLE orders ADD COLUMN refunded_at DATETIME;
-- 添加约束
-- length(id) = 36 (UUID格式)
-- email LIKE '%@%.%' (基础邮箱格式验证)
-- gateway IN ('alipay', 'creem', 'stripe')
-- amount > 0
-- currency IN ('CNY', 'USD', 'EUR', 'JPY')
-- status IN ('pending', 'paid', 'refunded', 'failed', 'cancelled', 'delivered')

-- 4. 更新 deliveries 表
ALTER TABLE deliveries ADD COLUMN download_url TEXT;
ALTER TABLE deliveries ADD COLUMN file_size INTEGER;
ALTER TABLE deliveries ADD COLUMN file_name TEXT;
ALTER TABLE deliveries ADD COLUMN delivery_method TEXT DEFAULT 'email';
-- 添加约束
-- delivery_type IN ('text', 'download', 'hybrid')
-- download_token IS NULL OR length(download_token) >= 32
-- download_count >= 0
-- max_downloads > 0
-- is_active IN (0, 1)
-- delivery_method IN ('email', 'api', 'manual')

-- 5. 更新 downloads 表
ALTER TABLE downloads ADD COLUMN referer TEXT;
ALTER TABLE downloads ADD COLUMN download_status TEXT DEFAULT 'success';
ALTER TABLE downloads ADD COLUMN bytes_downloaded INTEGER;
ALTER TABLE downloads ADD COLUMN download_time_ms INTEGER;
-- 添加约束
-- ip_address IS NULL OR length(ip_address) >= 7
-- download_status IN ('success', 'failed', 'partial')
-- bytes_downloaded >= 0

-- 6. 更新 payments_raw 表
ALTER TABLE payments_raw ADD COLUMN gateway_transaction_id TEXT;
ALTER TABLE payments_raw ADD COLUMN signature_method TEXT;
ALTER TABLE payments_raw ADD COLUMN processing_attempts INTEGER DEFAULT 0;
ALTER TABLE payments_raw ADD COLUMN error_message TEXT;
ALTER TABLE payments_raw ADD COLUMN processed_at DATETIME;
-- 添加约束
-- gateway IN ('alipay', 'creem', 'stripe')
-- signature_valid IN (0, 1)
-- processed IN (0, 1)
-- processing_attempts >= 0

-- 7. 更新 inventory_text 表
ALTER TABLE inventory_text ADD COLUMN batch_name TEXT;
ALTER TABLE inventory_text ADD COLUMN priority INTEGER DEFAULT 0;
ALTER TABLE inventory_text ADD COLUMN expires_at DATETIME;
ALTER TABLE inventory_text ADD COLUMN metadata TEXT;
ALTER TABLE inventory_text ADD COLUMN created_by TEXT;
-- 添加复杂约束（需要重建表）
-- CHECK (
--   (is_used = 0 AND used_order_id IS NULL AND used_at IS NULL) OR
--   (is_used = 1 AND used_order_id IS NOT NULL AND used_at IS NOT NULL)
-- )
-- length(content) >= 1

-- 8. 更新 settings 表
ALTER TABLE settings ADD COLUMN data_type TEXT DEFAULT 'string';
ALTER TABLE settings ADD COLUMN is_public INTEGER DEFAULT 0;
ALTER TABLE settings ADD COLUMN updated_by TEXT;
-- 添加约束
-- length(key) >= 1 AND length(key) <= 100
-- data_type IN ('string', 'number', 'boolean', 'json')
-- length(description) <= 500
-- is_public IN (0, 1)

-- 9. 创建新表：admin_logs
CREATE TABLE IF NOT EXISTS admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  old_values TEXT,
  new_values TEXT,
  ip_address TEXT,
  user_agent TEXT,
  success INTEGER DEFAULT 1,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. 创建新表：files
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT,
  checksum TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT
);

-- 11. 创建新的索引
-- Product indexes
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_gateway_order_id ON orders(gateway_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_currency ON orders(currency);

CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_type ON deliveries(delivery_type);
CREATE INDEX IF NOT EXISTS idx_deliveries_expires_at ON deliveries(expires_at);
CREATE INDEX IF NOT EXISTS idx_deliveries_active ON deliveries(is_active);

CREATE INDEX IF NOT EXISTS idx_downloads_delivery_id ON downloads(delivery_id);
CREATE INDEX IF NOT EXISTS idx_downloads_ip_address ON downloads(ip_address);
CREATE INDEX IF NOT EXISTS idx_downloads_downloaded_at ON downloads(downloaded_at);
CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(download_status);

CREATE INDEX IF NOT EXISTS idx_inventory_used ON inventory_text(is_used);
CREATE INDEX IF NOT EXISTS idx_inventory_batch ON inventory_text(batch_name);
CREATE INDEX IF NOT EXISTS idx_inventory_priority ON inventory_text(priority DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_expires_at ON inventory_text(expires_at);

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

-- 12. 插入新的默认设置
INSERT OR IGNORE INTO settings (key, value, data_type, description, is_public)
VALUES
  ('email_from_address', 'noreply@autoship.com', 'string', '发件人邮箱地址', 0),
  ('email_from_name', 'AutoShip', 'string', '发件人名称', 0),
  ('site_name', 'AutoShip', 'string', '网站名称', 1),
  ('site_description', '自动发货数字商品平台', 'string', '网站描述', 1),
  ('max_inventory_batch_size', '1000', 'number', '单次导入库存最大数量', 0),
  ('order_timeout_hours', '24', 'number', '订单超时时间（小时）', 0),
  ('enable_order_notification', 'true', 'boolean', '是否启用订单通知', 0),
  ('enable_delivery_notification', 'true', 'boolean', '是否启用发货通知', 0),
  ('admin_session_timeout_minutes', '60', 'number', '管理员会话超时时间（分钟）', 0);

-- COMMIT;

-- 注意：由于SQLite的限制，某些约束和索引需要重建表才能完美实现
-- 建议在生产环境中使用完整的新 schema.sql 进行重建