# Webhook Handling Specification

## Purpose
Define the requirements for secure, reliable, and idempotent webhook processing from payment gateways (Alipay and Creem).

## ADDED Requirements

### Requirement: Webhook Reception and Validation
系统 MUST 接收并验证来自支付网关的Webhook回调，确保安全性和数据完整性。

#### Scenario: Valid Alipay webhook received
- **WHEN** 支付宝发送有效的支付回调
- **THEN** 系统必须验证RSA2签名
- **AND** 验证时间戳（5分钟内）
- **AND** 验证来源IP或域名
- **AND** 检查幂等性（24小时内不重复处理）
- **AND** 记录详细的处理日志
- **AND** 返回'success'响应

#### Scenario: Valid Creem webhook received
- **WHEN** Creem发送有效的支付回调
- **THEN** 系统必须验证HMAC-SHA256签名
- **AND** 验证时间戳（5分钟内）
- **AND** 检查幂等性（24小时内不重复处理）
- **AND** 记录详细的处理日志
- **AND** 返回JSON格式成功响应

#### Scenario: Invalid signature
- **WHEN** Webhook签名验证失败
- **THEN** 系统必须拒绝请求
- **AND** 记录安全日志
- **AND** 返回适当的错误响应
- **AND** 不更新任何订单状态

#### Scenario: Expired timestamp
- **WHEN** Webhook时间戳超过5分钟
- **THEN** 系统必须拒绝请求
- **AND** 记录安全日志
- **AND** 返回时间过期错误

#### Scenario: Duplicate webhook (idempotency check)
- **WHEN** 收到24小时内已处理的Webhook
- **THEN** 系统必须返回成功响应
- **AND** 不重复执行业务逻辑
- **AND** 记录幂等性命中日志

### Requirement: Payment Amount Verification
系统 MUST 验证Webhook中的支付金额与订单金额一致，防止篡改。

#### Scenario: Amount verification success
- **WHEN** 处理有效Webhook
- **THEN** 系统必须验证支付金额
- **AND** 允许0.01货币单位的容差
- **AND** 提取网关订单号和金额
- **AND** 继续处理订单状态更新

#### Scenario: Amount mismatch
- **WHEN** 支付金额与订单金额不符
- **THEN** 系统必须拒绝处理
- **AND** 记录安全告警
- **AND** 更新payments_raw表为失败状态
- **AND** 不更新订单状态

### Requirement: Webhook Security and Anti-Replay
系统 MUST 实施全面的安全措施，防止重放攻击和伪造回调。

#### Scenario: Anti-replay protection
- **WHEN** 接收Webhook请求
- **THEN** 系统必须检查时间戳有效性
- **AND** 实施nonce（一次性随机数）检查
- **AND** 记录每个Webhook的唯一标识
- **AND** 防止相同请求重复处理

#### Scenario: Suspicious pattern detection
- **WHEN** 检测到可疑的Webhook模式
- **THEN** 系统必须记录告警
- **AND** 可以选择临时封禁来源IP
- **AND** 增加风险评分
- **AND** 记录到审计日志

#### Scenario: Rate limiting
- **WHEN** 单个IP在短时间内发送大量Webhook
- **THEN** 系统必须应用速率限制
- **AND** 返回429状态码
- **AND** 在响应头中返回限流信息
- **AND** 记录限流事件

### Requirement: Concurrent Processing and Idempotency
系统 MUST 安全处理并发Webhook请求，确保幂等性和数据一致性。

#### Scenario: Concurrent webhook processing
- **WHEN** 同时收到相同订单的多个Webhook
- **THEN** 系统必须串行化处理
- **AND** 使用数据库锁或事务保证一致性
- **AND** 只允许第一个处理成功
- **AND** 后续请求返回幂等性响应

#### Scenario: Database transaction safety
- **WHEN** 更新订单状态
- **THEN** 系统必须使用数据库事务
- **AND** 确保payments_raw和orders表一致性
- **AND** 失败时自动回滚
- **AND** 记录事务ID用于追踪

### Requirement: Error Handling and Retry Mechanism
系统 MUST 实施健壮的错误处理和重试机制，确保Webhook可靠处理。

#### Scenario: Transient error handling
- **WHEN** 处理Webhook时遇到临时错误（网络、数据库等）
- **THEN** 系统必须实施重试机制
- **AND** 最多重试3次
- **AND** 使用指数退避算法
- **AND** 记录每次重试尝试

#### Scenario: Permanent failure handling
- **WHEN** 处理Webhook时遇到永久性错误（签名无效、数据错误等）
- **THEN** 系统必须记录失败原因
- **AND** 更新payments_raw表
- **AND** 不进行重试
- **AND** 返回适当的错误响应

#### Scenario: Dead letter queue
- **WHEN** Webhook处理失败超过最大重试次数
- **THEN** 系统必须将请求放入死信队列
- **AND** 标记为需要人工处理
- **AND** 生成告警通知
- **AND** 提供手动重试接口

### Requirement: Webhook Statistics and Monitoring
系统 MUST 提供Webhook处理统计和监控信息，支持运维和故障排查。

#### Scenario: Webhook statistics query
- **WHEN** 请求Webhook统计信息
- **THEN** 系统必须返回以下数据：
  - 总接收Webhook数量
  - 成功处理数量
  - 失败数量
  - 成功率
  - 按支付网关分组统计
  - 按签名方法分组统计
  - 最近7天数据

#### Scenario: Webhook logs query
- **WHEN** 请求Webhook处理日志
- **THEN** 系统必须支持以下查询参数：
  - 按时间范围过滤
  - 按支付网关过滤
  - 按状态过滤（成功/失败/重试）
  - 按订单ID过滤
- **AND** 返回分页结果
- **AND** 包含详细的处理信息

#### Scenario: Health check endpoint
- **WHEN** 访问 `/webhooks/health`
- **THEN** 系统必须返回服务健康状态
- **AND** 包含可用的支付网关列表
- **AND** 包含响应时间
- **AND** 包含错误计数

### Requirement: Webhook Reprocessing
系统 MUST 提供手动重新处理Webhook的能力，用于故障恢复和调试。

#### Scenario: Manual reprocessing
- **WHEN** 管理员请求重新处理特定Webhook
- **THEN** 系统必须验证权限
- **AND** 检查Webhook记录是否存在
- **AND** 执行完整的验证和处理流程
- **AND** 记录重新处理操作
- **AND** 返回处理结果

#### Scenario: Test webhook endpoint
- **WHEN** 在开发环境使用测试端点
- **THEN** 系统必须生成模拟Webhook
- **AND** 支持指定订单ID和金额
- **AND** 标记为测试数据
- **AND** 生产环境必须禁用

## MODIFIED Requirements

### Requirement: Webhook Route Response Formats
系统 MUST 更新现有的Webhook路由响应格式以符合各支付网关的要求。

#### Scenario: Alipay webhook success response
- **WHEN** 支付宝Webhook处理成功
- **THEN** 返回字符串'success'和200状态码
- **AND** 不返回JSON格式
- **AND** 支付宝要求此特定格式

#### Scenario: Creem webhook success response
- **WHEN** Creem Webhook处理成功
- **THEN** 返回JSON格式响应
- **AND** 包含status字段为'success'
- **AND** 包含orderId信息
- **AND** 包含可选的处理详情

#### Scenario: General webhook failure response
- **WHEN** 任何Webhook处理失败
- **THEN** 返回适当的错误信息
- **AND** 不泄露敏感的系统信息
- **AND** 在日志中记录详细错误
- **AND** 返回统一的错误格式
