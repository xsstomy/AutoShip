# 数据库设计技术决策

## Context
项目需要一个支持数字商品自动发货的数据库系统，涉及订单管理、支付处理、库存管理、安全下载等多个业务领域。技术栈使用 SQLite/Cloudflare D1 + Drizzle ORM + TypeScript。

## Goals / Non-Goals
- **Goals**:
  - 完整的业务数据模型，支持所有核心功能
  - 高性能查询，适合SQLite特性
  - 数据完整性和安全性
  - 类型安全的ORM集成
  - 支持多币种和多支付网关

- **Non-Goals**:
  - 复杂的关系模型（保持简单高效）
  - 实时数据处理（异步处理足够）
  - 大规模并发（SQLite限制）

## Decisions

### Decision 1: 表结构设计
- **选择**: 8个核心表：products, product_prices, orders, deliveries, downloads, payments_raw, inventory_text, settings
- **理由**:
  - 正规化设计，避免数据冗余
  - 支持多币种（product_prices表）
  - 完整的审计日志（payments_raw, downloads表）
  - 灵活的库存管理（inventory_text表）
- **替代方案**: 单一大型订单表 - 被拒绝，查询和维护复杂

### Decision 2: 主键策略
- **选择**: 订单使用UUID主键，其他表使用自增整数
- **理由**:
  - 订单ID需要对外暴露且不可猜测
  - 其他内部表使用自增ID提升性能
- **替代方案**: 全部使用UUID - 被拒绝，性能开销大

### Decision 3: 下载链接安全
- **选择**: 32位随机token + 过期时间 + 下载次数限制
- **理由**:
  - 足够的随机性防止猜测
  - 时间窗口和次数限制增强安全
- **替代方案**: 签名URL - 被拒绝，实现复杂

### Decision 4: 时间处理
- **选择**: 使用UTC时间戳，SQLite datetime类型
- **理由**:
  - 时区一致性
  - SQLite原生支持
  - 易于索引和查询
- **替代方案**: Unix时间戳 - 被拒绝，人类可读性差

## Risks / Trade-offs
- **SQLite写入并发限制** → 通过队列处理和重试机制缓解
- **缺少外键级联删除** → 应用层处理数据一致性
- **大文件存储** → 建议使用外部存储服务（如Cloudflare R2）
- **复杂查询性能** → 通过合理索引和分页解决

## Migration Plan
1. 备份现有数据
2. 执行SQL脚本添加新字段和索引
3. 运行数据迁移脚本（如需要）
4. 验证数据完整性
5. 更新应用代码使用新字段
6. 部署和监控

## Open Questions
- 是否需要添加商品分类表？
- 是否需要支持订单备注字段？
- 是否需要用户操作日志表？