# 库存管理数据模型设计

## 概述

基于现有的 `inventoryText` 表结构，库存管理模块使用该表作为核心存储。每个 `inventoryText` 记录代表一个库存项（卡密、文本、下载链接等）。

## 数据库表结构

### 现有表：inventory_text
```sql
CREATE TABLE inventory_text (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  batch_name TEXT,
  priority INTEGER DEFAULT 0,
  is_used BOOLEAN DEFAULT FALSE,
  used_order_id TEXT REFERENCES orders(id),
  used_at TEXT,
  expires_at TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT
);
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 库存项唯一标识 |
| product_id | INTEGER | 关联的商品ID |
| content | TEXT | 库存内容（卡密/文本/链接） |
| batch_name | TEXT | 批次名称（用于批量导入管理） |
| priority | INTEGER | 优先级（数字越大优先级越高） |
| is_used | BOOLEAN | 是否已使用 |
| used_order_id | TEXT | 使用的订单ID |
| used_at | TEXT | 使用时间（ISO 8601格式） |
| expires_at | TEXT | 过期时间（ISO 8601格式） |
| metadata | TEXT | 额外元数据（JSON格式） |
| created_at | TEXT | 创建时间（ISO 8601格式） |
| created_by | TEXT | 创建者（管理员用户名或ID） |

## 数据模型

### 1. InventoryItem（库存项）
```typescript
interface InventoryItem {
  id: number
  productId: number
  content: string
  batchName?: string
  priority: number
  isUsed: boolean
  usedOrderId?: string
  usedAt?: string
  expiresAt?: string
  metadata?: Record<string, any>
  createdAt: string
  createdBy?: string
}
```

### 2. ProductInventorySummary（商品库存摘要）
```typescript
interface ProductInventorySummary {
  productId: number
  productName: string
  productDescription?: string
  deliveryType: string
  total: number
  available: number
  used: number
  status: 'in_stock' | 'low_stock' | 'out_of_stock'
  statusMessage: string
  lastUpdated: string
}
```

### 3. ImportResult（导入结果）
```typescript
interface ImportResult {
  success: boolean
  total: number
  successCount: number
  failedCount: number
  errors: Array<{
    line: number
    content: string
    error: string
  }>
}
```

### 4. InventoryStatistics（库存统计）
```typescript
interface InventoryStatistics {
  totalProducts: number
  totalInventoryItems: number
  availableItems: number
  usedItems: number
  lowStockProducts: number
  outOfStockProducts: number
  recentImports: Array<{
    batchName: string
    productId: number
    productName: string
    count: number
    createdAt: string
  }>
}
```

## API 设计

### 1. 获取商品库存列表
```
GET /api/v1/admin/inventory
```

**查询参数：**
- `page` (number, optional): 页码，默认 1
- `limit` (number, optional): 每页数量，默认 20
- `search` (string, optional): 搜索关键词（商品名称）
- `status` (string, optional): 库存状态过滤
  - `all`: 全部（默认）
  - `in_stock`: 有库存
  - `low_stock`: 低库存（<10）
  - `out_of_stock`: 无库存

**响应：**
```typescript
{
  success: boolean
  data: {
    products: ProductInventorySummary[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
      hasNext: boolean
      hasPrev: boolean
    }
  }
}
```

### 2. 获取库存详情
```
GET /api/v1/admin/inventory/:productId
```

**查询参数：**
- `page` (number, optional): 页码，默认 1
- `limit` (number, optional): 每页数量，默认 50
- `status` (string, optional): 状态过滤
  - `all`: 全部（默认）
  - `available`: 可用
  - `used`: 已使用

**响应：**
```typescript
{
  success: boolean
  data: {
    product: {
      id: number
      name: string
      deliveryType: string
    }
    inventory: InventoryItem[]
    summary: {
      total: number
      available: number
      used: number
    }
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
}
```

### 3. 批量导入库存
```
POST /api/v1/admin/inventory/import
```

**请求体：**
```typescript
{
  productId: number
  content: string // 每行一个库存项
  batchName?: string
  priority?: number
}
```

**响应：**
```typescript
{
  success: boolean
  data: ImportResult
}
```

### 4. 添加库存
```
POST /api/v1/admin/inventory
```

**请求体：**
```typescript
{
  productId: number
  content: string // 支持多行
  batchName?: string
  priority?: number
}
```

**响应：**
```typescript
{
  success: boolean
  data: {
    count: number // 添加的库存项数量
  }
}
```

### 5. 删除库存项
```
DELETE /api/v1/admin/inventory/:productId/items
```

**请求体：**
```typescript
{
  itemIds: number[]
}
```

**响应：**
```typescript
{
  success: boolean
  data: {
    deletedCount: number
  }
}
```

### 6. 获取库存统计
```
GET /api/v1/admin/inventory/stats
```

**响应：**
```typescript
{
  success: boolean
  data: InventoryStatistics
}
```

### 7. 扣减库存（下单时调用）
```
POST /api/v1/admin/inventory/deduct
```

**请求体：**
```typescript
{
  productId: number
  orderId: string
  quantity: number
}
```

**响应：**
```typescript
{
  success: boolean
  data: {
    items: InventoryItem[] // 扣减的库存项
  }
}
```

### 8. 返还库存（退款时调用）
```
POST /api/v1/admin/inventory/restock
```

**请求体：**
```typescript
{
  productId: number
  orderId: string
}
```

**响应：**
```typescript
{
  success: boolean
  data: {
    restockedCount: number
  }
}
```

## 库存状态计算逻辑

### 1. 库存状态定义
- **in_stock**: 可用库存 > 10
- **low_stock**: 0 < 可用库存 <= 10
- **out_of_stock**: 可用库存 = 0

### 2. 库存统计查询
```sql
-- 获取商品库存摘要
SELECT
  p.id as product_id,
  p.name,
  p.description,
  p.delivery_type,
  COUNT(it.id) as total,
  SUM(CASE WHEN it.is_used = 0 THEN 1 ELSE 0 END) as available,
  SUM(CASE WHEN it.is_used = 1 THEN 1 ELSE 0 END) as used,
  MAX(it.created_at) as last_updated
FROM products p
LEFT JOIN inventory_text it ON p.id = it.product_id
GROUP BY p.id, p.name, p.description, p.delivery_type
ORDER BY p.sort_order ASC, p.name ASC;
```

### 3. 库存扣减算法
```sql
-- 扣减库存（优先使用优先级高的，过期时间早的）
UPDATE inventory_text
SET
  is_used = 1,
  used_order_id = ?,
  used_at = CURRENT_TIMESTAMP
WHERE
  product_id = ?
  AND is_used = 0
  AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
ORDER BY priority DESC, created_at ASC
LIMIT ?;
```

## 批量导入格式

### 1. 支持的文件格式
- **CSV**: 每行一个库存项，无表头
- **TXT**: 纯文本，每行一个库存项
- **JSON**: 数组格式，每个元素一个库存项

### 2. 文件内容示例

**TXT/CSV 格式：**
```
CARD-001-XXXXX-ABCD1234
CARD-002-XXXXX-EFGH5678
CARD-003-XXXXX-IJKL9012
下载链接：https://example.com/file1.zip
下载链接：https://example.com/file2.zip
许可证：ABCD-EFGH-IJKL-MNOP
```

**JSON 格式：**
```json
[
  "CARD-001-XXXXX-ABCD1234",
  "CARD-002-XXXXX-EFGH5678",
  "CARD-003-XXXXX-IJKL9012"
]
```

### 3. 重复数据处理
- 默认跳过重复内容（相同 product_id 和 content）
- 可配置是否允许重复
- 重复数据不会更新现有记录

## 事务处理

### 1. 库存扣减事务
```sql
BEGIN TRANSACTION;

-- 检查库存是否充足
SELECT COUNT(*) as available
FROM inventory_text
WHERE product_id = ? AND is_used = 0;

-- 扣减库存
UPDATE inventory_text
SET is_used = 1, used_order_id = ?, used_at = CURRENT_TIMESTAMP
WHERE product_id = ?
  AND is_used = 0
ORDER BY priority DESC, created_at ASC
LIMIT ?;

COMMIT;
```

### 2. 库存返还事务
```sql
BEGIN TRANSACTION;

-- 返还库存
UPDATE inventory_text
SET
  is_used = 0,
  used_order_id = NULL,
  used_at = NULL
WHERE product_id = ? AND used_order_id = ?;

COMMIT;
```

## 性能优化

### 1. 索引优化
```sql
-- 产品库存查询索引
CREATE INDEX idx_inventory_product_id ON inventory_text(product_id);
CREATE INDEX idx_inventory_product_used ON inventory_text(product_id, is_used);

-- 批次管理索引
CREATE INDEX idx_inventory_batch_name ON inventory_text(batch_name);

-- 过期时间索引
CREATE INDEX idx_inventory_expires ON inventory_text(expires_at);

-- 创建时间索引
CREATE INDEX idx_inventory_created_at ON inventory_text(created_at);
```

### 2. 查询优化
- 分页查询限制单页数量（建议 max 100）
- 使用索引优化常用查询
- 避免 N+1 查询问题
- 大批量导入使用异步处理

### 3. 缓存策略
- 商品库存摘要缓存（5分钟）
- 库存统计信息缓存（10分钟）
- 热点商品库存实时更新

## 安全考虑

### 1. 数据校验
- 库存内容长度限制（max 1000 字符）
- 批次名称长度限制（max 100 字符）
- 防止 SQL 注入（使用参数化查询）
- 防止 XSS 攻击（输出转义）

### 2. 权限控制
- 库存管理 API 需管理员权限
- 操作记录到 admin_logs 表
- 敏感操作需要二次确认

### 3. 数据保护
- 卡密等敏感数据加密存储
- 导出功能需要特殊权限
- 定期清理过期库存项

## 扩展性考虑

### 1. 多类型库存支持
- 当前的 inventory_text 表支持文本、卡密、链接
- 如需支持文件类型，可扩展 files 表关联

### 2. 批次管理增强
- 可添加批次信息表（batch_info）
- 支持批次导入时间、导入人、备注等

### 3. 库存预警
- 可添加库存阈值配置表
- 支持低库存自动通知

### 4. 多仓库支持
- 可添加仓库表（warehouses）
- 扩展 inventory_text 表支持多仓库
