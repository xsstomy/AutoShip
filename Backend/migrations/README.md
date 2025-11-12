# 数据库迁移指南

## 迁移文件说明

### 001_enhance_database_schema.sql
- **版本**: 001
- **日期**: 2025-11-12
- **描述**: 完善数据库表结构，添加新字段、约束和索引
- **兼容性**: SQLite + Cloudflare D1

## 运行迁移

### 开发环境
```bash
# 进入Backend目录
cd Backend

# 运行迁移
sqlite3 database.db < migrations/001_enhance_database_schema.sql
```

### Cloudflare D1
```bash
# 使用Wrangler执行迁移
npx wrangler d1 execute autoship-db --file=migrations/001_enhance_database_schema.sql
```

## 迁移内容

### 新增字段
- **products**: delivery_type, sort_order
- **product_prices**: is_active, created_at, updated_at
- **orders**: gateway_data, notes, customer_ip, customer_user_agent, paid_at, delivered_at, refunded_at
- **deliveries**: download_url, file_size, file_name, delivery_method
- **downloads**: referer, download_status, bytes_downloaded, download_time_ms
- **payments_raw**: gateway_transaction_id, signature_method, processing_attempts, error_message, processed_at
- **inventory_text**: batch_name, priority, expires_at, metadata, created_by
- **settings**: data_type, is_public, updated_by

### 新增表
- **admin_logs**: 管理员操作日志
- **files**: 文件存储管理

### 新增索引
- 所有表的关键字段索引
- 时间字段索引用于查询优化
- 状态字段索引用于筛选

### 数据完整性约束
- 字段长度限制
- 枚举值约束
- 数值范围检查
- 业务逻辑约束

## 回滚计划

如果迁移出现问题，可以通过以下步骤回滚：

1. 从备份恢复数据库
2. 手动撤销添加的字段和表
3. 恢复原始 schema.sql

## 注意事项

1. **SQLite限制**: 某些约束需要重建表才能完美实现
2. **数据备份**: 迁移前请务必备份数据库
3. **测试环境**: 建议先在测试环境验证迁移
4. **停机时间**: 可能需要短暂的停机时间

## 验证迁移

迁移完成后，请运行以下验证：

```sql
-- 检查表结构
.schema

-- 检查新字段是否添加
PRAGMA table_info(products);
PRAGMA table_info(orders);
-- ... 其他表

-- 检查索引是否创建
PRAGMA index_list(orders);

-- 检查数据完整性
SELECT COUNT(*) FROM products;
SELECT COUNT(*) FROM orders;
```

## 后续步骤

1. 更新应用程序代码以使用新字段
2. 更新TypeScript类型定义
3. 测试所有功能模块
4. 监控数据库性能