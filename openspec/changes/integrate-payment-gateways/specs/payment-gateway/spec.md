# payment-gateway Specification

## Purpose
实现支付宝和Creem支付网关集成，支持订单支付、签名验证、Webhook回调处理，确保支付流程安全可靠。

## ADDED Requirements

### Requirement: 支付网关配置管理
系统 SHALL 安全管理支付宝和Creem的配置信息，支持加密存储和环境变量配置。

#### Scenario: 支付宝配置读取
- **GIVEN** 系统需要使用支付宝支付
- **WHEN** ConfigService加载支付宝配置
- **THEN** 系统必须：
  - 从环境变量读取ALIPAY_APP_ID, ALIPAY_PRIVATE_KEY, ALIPAY_PUBLIC_KEY
  - 从数据库读取可选配置项（超时时间、重试次数等）
  - 验证RSA密钥格式正确性
  - 支持沙箱和生产环境切换

#### Scenario: Creem配置读取
- **GIVEN** 系统需要使用Creem支付
- **WHEN** ConfigService加载Creem配置
- **THEN** 系统必须：
  - 从环境变量读取CREEM_API_KEY, CREEM_WEBHOOK_SECRET
  - 从数据库读取可选配置项
  - 验证API Key格式正确性
  - 支持多环境配置管理

#### Scenario: 配置验证失败
- **GIVEN** 支付网关配置缺失或无效
- **WHEN** 系统尝试初始化支付服务
- **THEN** 系统必须：
  - 记录错误日志（配置项名称和原因）
  - 抛出配置错误（无法启动）
  - 防止系统在不安全状态下运行

### Requirement: 支付链接生成
系统 SHALL 根据订单信息和选择的支付网关生成真实的支付链接。

#### Scenario: 支付宝支付链接生成
- **GIVEN** 订单已创建且用户选择支付宝支付
- **WHEN** 调用PaymentService创建支付
- **THEN** 系统必须：
  - 使用RSA2算法生成支付参数签名
  - 生成包含订单号、金额、商品信息的支付链接
  - 支持手机端和PC端支付方式
  - 链接包含签名参数和商户信息
  - 返回格式：`{ paymentUrl: string, gatewayOrderId: string }`

#### Scenario: Creem支付链接生成
- **GIVEN** 订单已创建且用户选择Creem支付
- **WHEN** 调用PaymentService创建支付
- **THEN** 系统必须：
  - 使用API Key进行身份认证
  - 生成包含订单信息的支付请求
  - 支持同步和异步支付模式
  - 返回格式：`{ paymentUrl: string, gatewayOrderId: string }`

#### Scenario: 支付网关不可用
- **GIVEN** 选择的支付网关配置无效或服务不可用
- **WHEN** 创建支付链接时
- **THEN** 系统必须：
  - 返回错误响应：`{ success: false, error: "PAYMENT_GATEWAY_UNAVAILABLE" }`
  - 记录详细错误日志
  - 建议用户选择其他支付方式
  - 订单状态保持pending

### Requirement: 支付宝Webhook处理
系统 SHALL 验证并处理支付宝支付回调，确保支付数据安全可靠。

#### Scenario: 支付宝Webhook接收
- **GIVEN** 支付宝服务器发送支付回调
- **WHEN** 系统接收POST请求到 `/webhooks/alipay`
- **THEN** 系统必须：
  - 解析回调参数（包含所有支付宝返回字段）
  - 验证RSA2签名（使用支付宝公钥）
  - 验证商户APP_ID匹配
  - 验证订单金额与数据库记录一致
  - 更新订单状态为'paid'或'failed'

#### Scenario: 支付宝签名验证成功
- **GIVEN** 支付宝Webhook签名验证通过
- **WHEN** 回调参数校验完成
- **THEN** 系统必须：
  - 检查订单是否已处理（幂等性）
  - 根据支付状态更新订单：`TRADE_SUCCESS/FINISHED → paid`
  - 记录支付原始数据到payments_raw表
  - 返回HTTP 200响应给支付宝
  - 记录成功审计日志

#### Scenario: 支付宝签名验证失败
- **GIVEN** 支付宝Webhook签名无效
- **WHEN** 签名验证过程
- **THEN** 系统必须：
  - 返回HTTP 403响应
  - 记录安全警告日志（包含IP地址）
  - 不更新订单状态
  - 触发安全告警
  - 记录原始请求参数（用于排查）

#### Scenario: 重复Webhook处理
- **GIVEN** 相同订单的支付回调重复发送
- **WHEN** 处理第二个及以后的回调
- **THEN** 系统必须：
  - 检测到已处理订单（幂等性）
  - 返回HTTP 200（避免重复推送）
  - 记录重复回调日志
  - 不重复更新订单状态
  - 不触发重复发货

### Requirement: Creem Webhook处理
系统 SHALL 验证并处理Creem支付回调。

#### Scenario: Creem Webhook接收
- **GIVEN** Creem服务器发送支付回调
- **WHEN** 系统接收POST请求到 `/webhooks/creem`
- **THEN** 系统必须：
  - 解析JSON回调参数
  - 使用Webhook Secret验证请求
  - 验证API调用来源
  - 验证订单金额和状态
  - 更新订单状态

#### Scenario: Creem状态映射
- **GIVEN** Creem支付回调状态为payment_succeeded
- **WHEN** 处理回调时
- **THEN** 系统必须：
  - 将订单状态更新为'paid'
  - 记录支付成功日志
  - 触发后续发货流程

#### Scenario: Creem支付失败
- **GIVEN** Creem支付回调状态为failed或cancelled
- **WHEN** 处理回调时
- **THEN** 系统必须：
  - 将订单状态更新为'failed'
  - 记录支付失败日志（包含失败原因）
  - 不触发发货流程

### Requirement: 支付安全验证
系统 SHALL 实施多层安全验证，防止支付欺诈和重放攻击。

#### Scenario: 金额验证
- **GIVEN** 支付网关回调包含支付金额
- **WHEN** 验证回调时
- **THEN** 系统必须：
  - 将网关金额与订单金额进行精确比较
  - 允许微小差异（< 0.01，货币转换误差）
  - 不允许大幅差异（> 5%）
  - 差异过大时拒绝支付并记录告警

#### Scenario: 订单关联验证
- **GIVEN** 支付网关回调包含订单信息
- **WHEN** 验证回调时
- **THEN** 系统必须：
  - 验证订单ID存在于数据库
  - 验证订单当前状态为pending
  - 验证订单网关与回调网关匹配
  - 任何验证失败都拒绝处理

#### Scenario: Webhook重放防护
- **GIVEN** 重复的Webhook请求
- **WHEN** 处理请求时
- **THEN** 系统必须：
  - 检查payments_raw表中的gateway_order_id
  - 如果已存在相同网关订单ID，拒绝重复处理
  - 返回成功响应（避免网关重试）
  - 记录重放攻击尝试日志

#### Scenario: 签名时效性验证
- **GIVEN** 支付网关回调包含时间戳
- **WHEN** 验证签名时
- **THEN** 系统必须：
  - 检查回调时间与当前时间差
  - 允许最大5分钟时间差（网络延迟）
  - 超过阈值则拒绝处理
  - 记录超时回调日志

### Requirement: 支付状态管理
系统 SHALL 提供完整的支付状态查询和管理功能。

#### Scenario: 支付状态查询
- **GIVEN** 用户或系统需要查询支付状态
- **WHEN** 调用支付状态查询API
- **THEN** 系统必须返回：
  - 订单ID和当前状态
  - 支付网关和网关订单ID
  - 支付时间和确认时间
  - 支付金额和货币
  - 格式：`{ id, status, gateway, amount, currency, createdAt, paidAt? }`

#### Scenario: 支付超时处理
- **GIVEN** 订单创建超过30分钟未支付
- **WHEN** 系统定期检查时
- **THEN** 系统必须：
  - 将订单状态更新为'cancelled'
  - 记录超时日志
  - 清理相关临时数据
  - 可通过管理员恢复（如果支付已到达）

#### Scenario: 支付失败重试
- **GIVEN** 用户支付失败或中断
- **WHEN** 用户请求重新支付
- **THEN** 系统必须：
  - 允许创建新的支付链接
  - 保留原订单ID
  - 记录重试次数（最多3次）
  - 更新payments_raw表
  - 返回新支付链接

### Requirement: 支付配置管理
系统 SHALL 提供灵活的支付配置管理，支持热更新和加密存储。

#### Scenario: 启用/禁用支付网关
- **GIVEN** 管理员需要控制支付网关可用性
- **WHEN** 更新配置时
- **THEN** 系统必须：
  - 支持动态启用/禁用支付宝
  - 支持动态启用/禁用Creem
  - 变更立即生效（热更新）
  - 记录配置变更审计日志
  - 影响新订单（不影响进行中的支付）

#### Scenario: 密钥轮换
- **GIVEN** 支付网关密钥需要定期轮换
- **WHEN** 更新密钥配置时
- **THEN** 系统必须：
  - 支持无停机密钥更新
  - 验证新密钥格式正确性
  - 提供密钥验证接口
  - 记录密钥变更历史
  - 轮换失败时回滚旧密钥

#### Scenario: 环境切换
- **GIVEN** 系统需要切换沙箱/生产环境
- **WHEN** 管理员更新环境配置
- **THEN** 系统必须：
  - 切换支付宝环境（沙箱 ↔ 生产）
  - 切换Creem环境（如果支持）
  - 验证新环境配置正确性
  - 清除旧环境缓存
  - 记录环境切换日志

### Requirement: 错误处理和恢复
系统 SHALL 提供完善的错误处理和自动恢复机制。

#### Scenario: 支付网关服务异常
- **GIVEN** 支付宝或Creem服务不可用
- **WHEN** 创建支付时
- **THEN** 系统必须：
  - 检测到网关不可用
  - 返回友好的错误信息
  - 记录详细错误日志
  - 建议用户稍后重试
  - 不影响其他功能

#### Scenario: Webhook处理异常
- **GIVEN** Webhook处理过程中发生异常
- **WHEN** 处理回调时
- **THEN** 系统必须：
  - 记录详细错误堆栈
  - 返回错误响应给网关（避免重复推送）
  - 将异常记录到错误队列
  - 触发错误告警
  - 保留原始请求数据用于排查

#### Scenario: 支付数据修复
- **GIVEN** 支付数据不一致或损坏
- **WHEN** 发现数据问题时
- **THEN** 系统必须：
  - 管理员提供数据修复工具
  - 验证修复操作的安全性
  - 记录修复操作日志
  - 提供数据一致性检查接口
  - 备份修复前数据

### Requirement: 审计和监控
系统 SHALL 记录所有支付相关的操作和事件，便于审计和问题排查。

#### Scenario: 支付审计日志
- **GIVEN** 支付流程中的关键事件
- **WHEN** 事件发生时
- **THEN** 系统必须记录：
  - 事件类型（支付开始、成功、失败、Webhook等）
  - 订单ID和用户信息
  - 支付网关和金额
  - 时间和IP地址
  - 成功/失败状态
  - 错误信息（如果有）

#### Scenario: 支付监控指标
- **GIVEN** 系统运行中
- **WHEN** 收集监控数据时
- **THEN** 系统必须跟踪：
  - 支付成功率
  - 平均支付处理时间
  - Webhook接收和处理延迟
  - 签名验证失败次数
  - 重复支付检测数
  - 各支付网关使用分布

#### Scenario: 安全告警
- **GIVEN** 检测到安全事件
- **WHEN** 事件触发时
- **THEN** 系统必须：
  - 发送告警通知（邮件/短信）
  - 记录详细安全事件
  - 包含IP、User-Agent、时间戳
  - 提供事件响应建议
  - 保留证据用于后续分析

### Requirement: 多货币支持
系统 SHALL 支持CNY和USD货币的支付处理。

#### Scenario: 人民币支付
- **GIVEN** 订单金额为CNY
- **WHEN** 创建支付时
- **THEN** 系统必须：
  - 保持金额不变（CNY无需转换）
  - 在支付链接中标注CNY
  - 支付宝和Creem都支持CNY
  - 记录汇率信息（如适用）

#### Scenario: 美元支付
- **GIVEN** 订单金额为USD
- **WHEN** 创建支付时
- **THEN** 系统必须：
  - 验证支付网关是否支持USD
  - 在支付链接中标注USD
  - 支付宝（如果支持）或Creem处理
  - 记录原始金额和汇率（如果转换）

#### Scenario: 货币不支持
- **GIVEN** 订单使用不支持的货币
- **WHEN** 创建支付时
- **THEN** 系统必须：
  - 返回错误：`UNSUPPORTED_CURRENCY`
  - 记录错误日志
  - 提示用户选择支持的货币
  - 不创建支付记录

## Cross-References

### Related Specifications
- **configuration**: 支付配置管理
- **security**: 签名验证和安全策略
- **database-model**: 订单和支付数据模型
- **checkout-flow**: 订单创建流程

### Related Capabilities
- **订单管理**: 依赖订单创建API
- **配置管理**: 使用ConfigService
- **安全验证**: 集成security-service
- **审计日志**: 依赖audit-service

## Constraints

### Technical Constraints
- SQLite/D1数据库限制（无存储过程）
- 必须支持Cold Start（Cloudflare Workers）
- 签名验证不能依赖外部库（如果可能）
- 所有时间使用UTC存储

### Security Constraints
- 所有支付回调必须验证签名
- 敏感配置必须加密存储
- Webhook必须支持幂等性
- 不能信任任何客户端参数

### Business Constraints
- 支持CNY和USD两种货币
- 支付宝为主，Creem为备
- 全额支付（不支持部分支付）
- 不支持退款（当前MVP）

### Performance Constraints
- Webhook响应时间 < 500ms
- 支付链接生成时间 < 2s
- 支持<100 QPS（单实例）
- 内存使用<100MB

## Validation

### Acceptance Criteria
- [ ] 支付宝支付链接生成成功且可正常跳转
- [ ] Creem支付链接生成成功且可正常跳转
- [ ] 支付宝Webhook验证通过并正确更新订单
- [ ] Creem Webhook验证通过并正确更新订单
- [ ] 签名伪造攻击无法成功
- [ ] 重放攻击无法重复处理
- [ ] 金额篡改被正确检测和拒绝
- [ ] 配置热更新正常工作
- [ ] 单元测试覆盖率>80%
- [ ] 集成测试全部通过
- [ ] 安全测试通过
- [ ] 性能测试满足约束

### Test Scenarios
1. **完整支付流程测试**
   - 创建订单 → 生成支付链接 → 完成支付 → 处理Webhook → 更新订单状态
2. **签名验证测试**
   - 使用正确签名测试
   - 使用错误签名测试
   - 使用过期签名测试
3. **幂等性测试**
   - 重复Webhook请求测试
   - 重复支付链接请求测试
4. **安全性测试**
   - 金额篡改测试
   - 订单ID篡改测试
   - 伪造Webhook测试
5. **异常处理测试**
   - 支付网关不可用测试
   - Webhook超时测试
   - 配置错误测试
