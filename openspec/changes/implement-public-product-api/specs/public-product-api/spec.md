# public-product-api Specification

## ADDED Requirements

### Requirement: 公共产品列表API
系统 SHALL 提供公共API端点获取激活的商品列表，无需管理员认证。

#### Scenario: 获取激活商品列表
- **WHEN** 客户端向 `GET /api/v1/products` 发送请求
- **THEN** 系统返回所有激活状态的商品列表，包含：
  - 商品基本信息（ID、名称、描述、发货类型）
  - 多货币价格信息（CNY/USD）
  - 库存状态和可用数量
  - 创建和更新时间

#### Scenario: 空商品列表处理
- **GIVEN** 数据库中没有激活的商品
- **WHEN** 客户端请求商品列表
- **THEN** 系统返回空数组而不是错误状态

#### Scenario: API响应格式一致性
- **WHEN** 客户端请求商品列表
- **THEN** 系统返回标准化的响应格式：
  ```json
  {
    "success": true,
    "data": {
      "products": [...],
      "total": 0
    }
  }
  ```

### Requirement: 单个商品详情API
系统 SHALL 提供公共API端点获取单个商品的详细信息。

#### Scenario: 获取商品详情
- **WHEN** 客户端向 `GET /api/v1/products/:id` 发送请求
- **THEN** 系统返回指定商品的详细信息，包括：
  - 完整的商品基本信息
  - 所有货币的价格列表
  - 库存统计信息
  - 模板文本（如果适用）

#### Scenario: 商品不存在处理
- **GIVEN** 请求的商品ID在数据库中不存在或商品未激活
- **WHEN** 客户端请求商品详情
- **THEN** 系统返回404状态码和明确的错误信息

### Requirement: 数据过滤和安全
系统 SHALL 确保公共API只返回安全、公开的商品信息。

#### Scenario: 敏感信息过滤
- **WHEN** 返回商品数据
- **THEN** 系统排除以下敏感信息：
  - 管理员特定的内部字段
  - 未激活的商品
  - 价格历史记录
  - 库存管理详情

#### Scenario: 输入验证和清理
- **WHEN** 接收API请求参数
- **THEN** 系统验证和清理所有输入数据：
  - 验证商品ID格式
  - 限制查询结果数量
  - 防止SQL注入攻击

### Requirement: 性能优化
系统 SHALL 优化公共API的响应性能。

#### Scenario: 查询性能优化
- **WHEN** 处理商品列表请求
- **THEN** 系统使用以下优化策略：
  - 只查询必要的数据字段
  - 使用数据库索引优化查询
  - 实现结果缓存（可选）

#### Scenario: 响应时间控制
- **WHEN** 处理API请求
- **THEN** 系统确保响应时间：
  - 商品列表查询 < 200ms
  - 商品详情查询 < 100ms

## MODIFIED Requirements

### Requirement: 前端产品数据获取
系统 SHALL 修改前端组件以从后端API获取真实商品数据。

#### Scenario: 真实数据集成
- **WHEN** 用户访问商品展示页面
- **THEN** 前端调用 `GET /api/v1/products` 获取真实商品数据
- **AND** 移除对模拟数据的依赖

#### Scenario: 错误处理增强
- **WHEN** API请求失败
- **THEN** 前端显示友好的错误信息并提供重试选项
- **AND** 记录详细的错误日志用于调试

#### Scenario: 加载状态优化
- **WHEN** 正在获取商品数据
- **THEN** 前端显示加载指示器和进度提示
- **AND** 提供骨架屏加载效果

### Requirement: 类型系统同步
系统 SHALL 更新前端类型定义以匹配后端数据结构。

#### Scenario: 产品类型更新
- **WHEN** 前端接收后端API响应
- **THEN** TypeScript类型定义包含：
  - 多价格货币支持（prices数组）
  - 发货类型枚举（text/download/hybrid）
  - 库存状态信息
  - 时间戳字段

#### Scenario: API响应类型
- **WHEN** 前端处理API响应
- **THEN** 使用严格的类型定义确保：
  - 响应数据结构一致性
  - 可选字段的正确处理
  - 运行时类型安全