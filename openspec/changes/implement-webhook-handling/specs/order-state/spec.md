# Order State Management Specification

## Purpose
Define the requirements for managing order state transitions in response to payment gateway webhook events, ensuring consistency, traceability, and proper business logic execution.

## ADDED Requirements

### Requirement: Payment State to Order State Mapping
系统 MUST 将支付网关状态准确映射到订单状态，并执行相应的业务逻辑。

#### Scenario: Payment success state transition
- **WHEN** 支付成功Webhook验证通过
- **THEN** 系统必须将订单状态从'pending'更新为'paid'
- **AND** 记录支付网关的trade_no
- **AND** 记录支付完成时间
- **AND** 触发自动发货流程
- **AND** 记录状态变更审计日志

#### Scenario: Payment failed state transition
- **WHEN** 支付失败Webhook验证通过
- **THEN** 系统必须将订单状态从'pending'更新为'failed'
- **AND** 记录失败原因
- **AND** 记录支付网关的trade_no
- **AND** 不触发自动发货流程
- **AND** 记录状态变更审计日志

#### Scenario: Payment cancelled state transition
- **WHEN** 支付取消Webhook验证通过
- **THEN** 系统必须将订单状态更新为'cancelled'
- **AND** 记录取消时间
- **AND** 清理相关的支付信息
- **AND** 不触发自动发货流程
- **AND** 记录状态变更审计日志

#### Scenario: Payment pending state transition
- **WHEN** 支付处理中Webhook验证通过
- **THEN** 系统必须保持订单状态为'pending'
- **AND** 记录支付处理中状态
- **AND** 不执行后续业务逻辑
- **AND** 记录状态变更审计日志

### Requirement: Order State Audit Trail
系统 MUST 维护订单状态的完整审计轨迹，支持状态变更追踪和分析。

#### Scenario: State change audit logging
- **WHEN** 订单状态发生任何变更
- **THEN** 系统必须记录以下信息：
  - 变更前的状态
  - 变更后的状态
  - 变更时间
  - 变更原因（Webhook处理）
  - Webhook记录ID
  - 操作人（系统自动）
- **AND** 审计日志必须不可篡改
- **AND** 支持按订单ID查询历史

#### Scenario: State transition validation
- **WHEN** 接收到Webhook触发状态变更
- **THEN** 系统必须验证状态转换的合法性
- **AND** 只允许有效的状态转换
- **AND** 记录无效转换尝试
- **AND** 返回错误响应

**有效的状态转换**：
- pending → paid（支付成功）
- pending → failed（支付失败）
- pending → cancelled（支付取消）
- paid → refunded（退款完成）
- paid → completed（发货完成）

### Requirement: Order Status Query
系统 MUST 提供详细的订单状态查询接口，包含支付信息和状态历史。

#### Scenario: Order status query with payment info
- **WHEN** 查询订单状态
- **THEN** 系统必须返回以下信息：
  - 当前订单状态
  - 支付网关信息
  - 支付状态
  - 支付完成时间
  - 网关订单号
  - 支付金额
  - 状态变更历史
- **AND** 支持分页查询状态历史
- **AND** 敏感信息适当脱敏

#### Scenario: Order status by multiple criteria
- **WHEN** 按条件查询订单
- **THEN** 系统必须支持以下过滤条件：
  - 按订单状态过滤
  - 按支付网关过滤
  - 按时间范围过滤
  - 按金额范围过滤
- **AND** 返回分页结果
- **AND** 包含总数统计

### Requirement: Automatic Business Logic Trigger
系统 MUST 在状态变更时自动触发相应的业务逻辑。

#### Scenario: Payment success triggers delivery
- **WHEN** 订单状态变更为'paid'
- **THEN** 系统必须自动触发发货流程
- **AND** 检查库存可用性
- **AND** 生成发货邮件
- **AND** 更新订单状态为'processing'
- **AND** 记录发货触发事件

#### Scenario: Payment failure notifications
- **WHEN** 订单状态变更为'failed'
- **THEN** 系统必须发送支付失败通知
- **AND** 通知用户失败原因
- **AND** 提供重新支付选项
- **AND** 记录通知发送事件

#### Scenario: Delivery completion triggers completion
- **WHEN** 发货流程完成
- **THEN** 系统必须更新订单状态为'completed'
- **AND** 记录完成时间
- **AND** 发送完成通知邮件
- **AND** 记录状态变更审计日志

### Requirement: Concurrent State Updates Protection
系统 MUST 保护订单状态免受并发更新的影响，确保数据一致性。

#### Scenario: Concurrent update prevention
- **WHEN** 同时收到多个Webhook更新同一订单
- **THEN** 系统必须使用乐观锁或悲观锁
- **AND** 确保状态更新的原子性
- **AND** 拒绝过时的更新请求
- **AND** 返回当前最新状态

#### Scenario: Transaction safety for state updates
- **WHEN** 执行订单状态更新
- **THEN** 系统必须使用数据库事务
- **AND** 确保orders表和audit_logs表一致性
- **AND** 失败时自动回滚
- **AND** 记录事务ID用于追踪

### Requirement: Exceptional State Handling
系统 MUST 正确处理异常状态和边缘情况。

#### Scenario: Handling unknown webhook status
- **WHEN** 收到未知的支付状态
- **THEN** 系统必须记录告警
- **AND** 将订单标记为'needs_attention'
- **AND** 不执行自动业务逻辑
- **AND** 等待人工处理

#### Scenario: Rollback on webhook inconsistency
- **WHEN** 检测到状态不一致
- **THEN** 系统必须记录错误
- **AND** 可以选择回滚到之前状态
- **AND** 记录回滚原因和操作人
- **AND** 发送告警通知

#### Scenario: Timeout handling
- **WHEN** 支付长时间未完成
- **THEN** 系统可以标记订单为超时
- **AND** 发送超时通知
- **AND** 提供取消或继续等待选项
- **AND** 记录超时事件

### Requirement: Order State Summary Statistics
系统 MUST 提供订单状态的统计信息，支持业务分析和决策。

#### Scenario: Order statistics by status
- **WHEN** 请求订单状态统计
- **THEN** 系统必须返回以下数据：
  - 各状态订单数量
  - 状态分布百分比
  - 按时间统计趋势
  - 按支付网关分组统计
- **AND** 支持按时间范围过滤
- **AND** 支持实时和历史统计

#### Scenario: Payment success rate calculation
- **WHEN** 计算支付成功率
- **THEN** 系统必须基于订单状态计算：
  - 支付成功订单数 / 总订单数
  - 按支付网关分别计算
  - 按时间段统计趋势
- **AND** 排除取消和超时的订单
- **AND** 返回百分比和小数格式

## MODIFIED Requirements

### Requirement: Enhanced Order Status Fields
系统 MUST 扩展现有的订单状态字段以支持Webhook处理相关的信息。

#### Scenario: Order status field enhancement
- **WHEN** 更新订单状态字段
- **THEN** 订单表必须包含以下字段：
  - status（订单状态）
  - payment_status（支付状态）
  - gateway（支付网关）
  - gateway_order_id（网关订单号）
  - payment_completed_at（支付完成时间）
  - status_updated_at（状态更新时间）
  - status_updated_by（更新来源：webhook/manual）
- **AND** 所有字段必须添加适当的索引
- **AND** 支持向后兼容的迁移

#### Scenario: Order query with enhanced status
- **WHEN** 查询订单列表
- **THEN** 系统必须支持按状态字段过滤
- **AND** 支持复合条件查询（status + payment_status）
- **AND** 返回完整的支付相关信息
- **AND** 优化查询性能

### Requirement: Checkout Flow Integration with Webhooks
系统 MUST 增强现有的订单流程规范以集成Webhook处理。

#### Scenario: Checkout completion to webhook processing
- **WHEN** 用户完成下单流程
- **THEN** 系统必须：
  - 创建pending状态订单
  - 生成支付链接
  - 等待Webhook回调
  - 监控支付状态
- **AND** 用户可以查询订单状态
- **AND** 支持支付超时处理
- **AND** 记录完整的订单生命周期
