# database-model Specification

## Purpose
TBD - created by archiving change design-database-model. Update Purpose after archive.
## Requirements
### Requirement: 完整数据库模式设计
The system SHALL provide a complete database schema design to support all business functions of the digital goods automatic delivery system.

#### Scenario: 创建完整的数据库表结构
- **WHEN** 系统初始化时
- **THEN** 创建包含8个核心表的完整数据库结构
- **AND** 所有表都有适当的字段、类型、约束和索引
- **AND** 支持SQLite和Cloudflare D1的语法

#### Scenario: 数据完整性约束
- **WHEN** 数据插入或更新时
- **THEN** 外键约束确保引用完整性
- **AND** CHECK约束确保数据格式正确
- **AND** 默认值确保必填字段不为空

### Requirement: 多币种商品定价支持
The system SHALL support multi-currency product pricing, allowing the same product to have different prices in different currencies.

#### Scenario: 设置商品多币种价格
- **WHEN** 管理员为商品设置价格时
- **THEN** 可以为每种货币（CNY、USD等）设置独立价格
- **AND** 价格使用DECIMAL(10,2)类型确保精度
- **AND** 系统根据用户选择或地区显示相应货币价格

#### Scenario: 货币价格查询
- **WHEN** 查询商品价格时
- **THEN** 返回指定货币的价格信息
- **AND** 如果货币不存在，返回默认货币价格
- **AND** 支持货币转换和汇率计算（未来扩展）

### Requirement: 订单状态管理
系统 SHALL 支持完整的订单生命周期状态管理，包括创建、支付、发货和退款状态。

#### Scenario: 订单状态流转
- **WHEN** 订单状态发生变化时
- **THEN** 系统支持以下状态流转：
  - `pending` → `paid` (支付成功)
  - `pending` → `failed` (支付失败)
  - `paid` → `delivered` (发货完成)
  - `paid` → `refunded` (退款处理)
  - `pending` → `cancelled` (订单取消)
  - `paid` → `cancelled` (管理员取消)

#### Scenario: 订单查询和筛选
- **WHEN** 管理员查询订单时
- **THEN** 系统支持按以下条件筛选：
  - 订单ID精确匹配
  - 邮箱地址模糊匹配
  - 订单状态筛选
  - 时间范围筛选（创建时间、支付时间）
  - 支付网关筛选
  - 分页查询支持
- **AND** 返回完整的订单详情和关联信息

### Requirement: 安全下载链接管理
The system SHALL provide a secure download link mechanism to prevent unauthorized access and abuse.

#### Scenario: 生成下载链接
- **WHEN** 订单支付成功后
- **THEN** 生成唯一的32位随机token作为下载链接
- **AND** 设置72小时过期时间
- **AND** 限制最多3次下载
- **AND** 下载链接包含防篡改签名

#### Scenario: 下载链接验证
- **WHEN** 用户访问下载链接时
- **THEN** 验证token的有效性
- **AND** 检查链接是否过期
- **AND** 验证下载次数是否超限
- **AND** 记录下载日志（IP、User-Agent、时间）

### Requirement: 库存管理系统
The system SHALL provide flexible inventory management, supporting both predefined content pools and dynamic template content.

#### Scenario: 使用预定义库存
- **WHEN** 订单需要发货且存在可用库存时
- **THEN** 从inventory_text表分配一个未使用的库存项
- **AND** 将库存项标记为已使用并关联订单ID
- **AND** 减少可用库存数量

#### Scenario: 使用模板内容
- **WHEN** 预定义库存耗尽或未配置时
- **THEN** 使用商品的template_text作为发货内容
- **AND** 支持变量替换（如订单ID、邮箱等）
- **AND** 确保内容的唯一性和安全性

### Requirement: 支付回调处理
The system SHALL securely process payment gateway callback notifications to ensure transaction reliability and prevent replay attacks.

#### Scenario: 支付回调接收
- **WHEN** 收到支付网关回调时
- **THEN** 验证回调数据的签名或密钥
- **AND** 将原始回调数据保存到payments_raw表
- **AND** 标记签名验证结果和处理状态

#### Scenario: 幂等性保证
- **WHEN** 处理支付回调时
- **THEN** 检查gateway_order_id是否已处理
- **AND** 避免重复处理相同的支付通知
- **AND** 确保订单状态不会因为重复回调而异常

### Requirement: 系统配置管理
The system SHALL provide flexible configuration management, supporting runtime configuration changes without affecting system operation.

#### Scenario: 系统参数配置
- **WHEN** 管理员修改系统配置时
- **THEN** 配置项存储在settings表中
- **AND** 支持默认值和配置验证
- **AND** 配置变更立即生效（除特殊配置）

#### Scenario: 配置访问优化
- **WHEN** 应用程序访问配置时
- **THEN** 常用配置在内存中缓存
- **AND** 配置变更时自动刷新缓存
- **AND** 提供配置备份和恢复机制

### Requirement: 数据库性能优化
The system SHALL provide performance optimization specifically for SQLite characteristics, ensuring stable response under high concurrency.

#### Scenario: 查询性能优化
- **WHEN** 执行复杂查询时
- **THEN** 使用适当的索引加速查询
- **AND** 避免全表扫描和N+1查询问题
- **AND** 使用分页减少大数据集的内存占用

#### Scenario: 写入性能优化
- **WHEN** 处理大量写入时
- **THEN** 使用事务确保数据一致性
- **AND** 批量操作减少数据库连接开销
- **AND** 实现队列机制处理并发写入

### Requirement: TypeScript类型安全
The system SHALL provide complete TypeScript type definitions to ensure compile-time type checking and IDE support.

#### Scenario: 类型定义生成
- **WHEN** 数据库模式更新时
- **THEN** 自动生成或更新TypeScript类型
- **AND** 包含所有表和字段的类型信息
- **AND** 提供Insert和Select类型变体

#### Scenario: ORM集成类型
- **WHEN** 使用Drizzle ORM查询时
- **THEN** 查询构建器提供类型提示
- **AND** 查询结果具有正确的类型推断
- **AND** 运行时验证确保数据一致性

### Requirement: 订单数据模型
系统 SHALL 定义完整的订单数据表结构，支持订单生命周期管理和业务查询需求。

#### Scenario: 订单表结构定义
- **GIVEN** 数据库初始化时
- **WHEN** 创建orders表时
- **THEN** 系统创建包含以下字段的表：
  - `id` INTEGER PRIMARY KEY AUTOINCREMENT - 订单主键
  - `order_id` TEXT UNIQUE NOT NULL - 业务订单ID (格式: ORDER+时间戳+随机数)
  - `email` TEXT NOT NULL - 用户邮箱地址
  - `product_id` TEXT NOT NULL - 商品ID
  - `product_name` TEXT NOT NULL - 商品名称（冗余存储，提高查询性能）
  - `price` DECIMAL(10,2) NOT NULL - 订单金额
  - `currency` TEXT NOT NULL DEFAULT 'CNY' - 货币类型 (CNY/USD)
  - `status` TEXT NOT NULL DEFAULT 'pending' - 订单状态
  - `gateway` TEXT - 支付网关 (alipay/creem)
  - `gateway_order_id` TEXT - 支付网关订单ID
  - `gateway_data` TEXT - 支付网关原始数据JSON
  - `paid_at` DATETIME - 支付完成时间
  - `delivered_at` DATETIME - 发货完成时间
  - `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
  - `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP

#### Scenario: 订单状态枚举
- **GIVEN** 订单状态定义时
- **WHEN** 定义订单状态值时
- **THEN** 系统支持以下状态：
  - `pending` - 待支付（默认状态）
  - `paid` - 已支付
  - `delivered` - 已发货
  - `failed` - 支付失败
  - `refunded` - 已退款
  - `cancelled` - 已取消

#### Scenario: 订单索引策略
- **GIVEN** 查询性能优化需求
- **WHEN** 创建订单表索引时
- **THEN** 系统创建以下索引：
  - INDEX idx_orders_order_id (order_id) - 业务订单ID唯一查询
  - INDEX idx_orders_email (email) - 邮箱查询订单
  - INDEX idx_orders_status (status) - 状态筛选查询
  - INDEX idx_orders_created_at (created_at) - 时间范围查询
  - INDEX idx_orders_gateway_order_id (gateway_order_id) - 支付回调查询

#### Scenario: 订单数据完整性约束
- **GIVEN** 订单数据一致性要求
- **WHEN** 插入或更新订单数据时
- **THEN** 系统执行以下约束：
  - order_id必须唯一
  - email必须符合邮箱格式
  - price必须大于0
  - currency必须是'CNY'或'USD'
  - status必须是预定义的状态值
  - gateway_order_id在同一个gateway下必须唯一

