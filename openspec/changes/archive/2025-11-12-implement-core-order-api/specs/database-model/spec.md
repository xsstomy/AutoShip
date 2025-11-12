## ADDED Requirements

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

## MODIFIED Requirements

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