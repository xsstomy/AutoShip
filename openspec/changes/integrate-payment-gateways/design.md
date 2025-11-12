# 支付网关集成设计文档

## 架构概述

### 支付流程设计
```
用户下单 → 生成订单 → 创建支付 → 返回支付链接 → 支付网关处理 → Webhook回调 → 更新订单状态 → 触发发货
```

### 核心组件
1. **PaymentGatewayService** - 支付网关抽象层
2. **PaymentService** - 支付业务服务
3. **WebhookHandler** - 支付回调处理
4. **ConfigService** - 配置管理（已存在）

## 设计决策

### 决策1：支付网关抽象层
**选择**: 接口+多态实现模式
**原因**:
- 支付宝和Creem有不同API和认证方式
- 便于添加新支付网关
- 统一业务接口，隐藏实现细节

**替代方案考虑**:
- 单一服务类（switch-case）: 违反开闭原则
- 配置驱动: 增加运行时复杂性

### 决策2：签名验证机制
**选择**: 网关内嵌签名验证
**原因**:
- 安全性最高，验证逻辑紧邻支付处理
- 符合单一职责原则
- 便于测试和调试

**替代方案考虑**:
- 独立验证服务: 增加调用复杂度
- 中间件验证: 灵活性降低

### 决策3：支付状态管理
**选择**: 订单状态机 + 支付记录表
**原因**:
- 订单状态：pending → paid → delivered
- 支付记录：独立追踪所有支付行为
- 支持退款和部分支付

**状态映射**:
```
支付宝: TRADE_SUCCESS/FINISHED → paid
支付宝: TRADE_CLOSED → failed
Creem: payment_succeeded → paid
Creem: others → failed
```

### 决策4：幂等性保证
**选择**: payments_raw表记录 + 订单状态检查
**原因**:
- SQLite支持UNIQUE约束
- 双重保险：表级+业务级检查
- 便于审计和排查

**实现**:
```sql
payments_raw: id (order_id + gateway_order_id UNIQUE)
orders: status检查（不能从pending变为pending）
```

### 决策5：支付URL生成
**选择**: 异步生成 + 短时缓存
**原因**:
- 支付链接通常只有短期有效性
- 减少API调用次数
- 允许支付前重试

**权衡**:
- 同步生成: 实时性高，但增加延迟
- 我们的选择: 平衡实时性和性能

### 决策6：安全策略
**选择**: 配置优先 + 环境变量补充
**原因**:
- ConfigService已提供此能力
- 支持热更新和加密存储
- 环境变量适合敏感配置（密钥）

**敏感配置**:
- 支付宝: RSA私钥
- Creem: API Key, Webhook Secret
- 使用ConfigService的加密功能

## 接口设计

### IPaymentGateway接口
```typescript
interface IPaymentGateway {
  createPayment(params: CreatePaymentParams): Promise<PaymentLink>
  verifyWebhook(payload: any, headers: any): Promise<boolean>
  parseCallback(params: any): PaymentCallback
}
```

### 错误处理策略
1. **配置错误**: 启动时验证，失败则退出
2. **支付创建失败**: 返回详细错误，订单保持pending
3. **Webhook验证失败**: 返回403，记录安全日志
4. **重复支付**: 返回成功（幂等），但更新审计日志
5. **网络超时**: 重试机制（最多3次）

## 数据流设计

### 1. 创建支付
```
Checkout API → PaymentService.createPayment()
  → GatewayManager.selectGateway()
  → Gateway.createPayment()
  → 返回支付链接 + 订单ID
  → 保存到payments_raw表（pending状态）
```

### 2. 处理Webhook
```
Gateway Webhook → WebhookHandler
  → 解析参数 → 验证签名
  → 检查重复支付 → 更新订单状态
  → 记录支付数据 → 触发后续流程
```

## 安全设计

### 威胁模型
1. **签名伪造**: 攻击者伪造Webhook
   - 防御: RSA签名验证
2. **重放攻击**: 重复提交相同Webhook
   - 防御: payments_raw表唯一约束
3. **金额篡改**: 修改支付金额
   - 防御: 金额验证
4. **订单劫持**: 修改订单ID
   - 防御: 订单关联验证

### 安全检查点
- ✅ Webhook入口: 签名验证
- ✅ 参数解析: 格式验证
- ✅ 业务逻辑: 金额+订单验证
- ✅ 数据更新: 事务保证
- ✅ 审计日志: 完整记录

## 性能设计

### 缓存策略
- 支付配置: ConfigService缓存（5分钟TTL）
- 公钥缓存: 1小时TTL
- 支付链接: 不缓存（短期有效）

### 数据库优化
- orders表: `id`主键，`status`索引
- payments_raw表: `gateway_order_id`唯一索引
- products表: `id`主键，`isActive`索引

### 并发考虑
- SQLite写锁: 支付处理串行化
- 幂等性保证: 重复请求无副作用
- 死锁避免: 固定查询顺序

## 可观测性

### 日志分级
- **INFO**: 正常支付流程
- **WARN**: 重试、配置缺失
- **ERROR**: 签名失败、验证错误
- **FATAL**: 配置错误、系统异常

### 关键指标
- 支付成功率
- Webhook处理延迟
- 签名验证失败率
- 重复支付检测数

### 审计事件
- payment_initiated: 支付开始
- payment_succeeded: 支付成功
- payment_failed: 支付失败
- webhook_received: 收到回调
- signature_verification_failed: 签名验证失败

## 扩展性

### 添加新支付网关
1. 实现IPaymentGateway接口
2. 在GatewayManager中注册
3. 添加配置项
4. 测试签名验证

### 国际化支持
- 支付文案多语言
- 货币符号本地化
- 时区处理（UTC存储，本地显示）

### 费率支持
- 可扩展支持手续费
- 汇率转换（未来）
- 支付方式优先级

## 测试策略

### 单元测试
- 签名算法正确性
- 参数解析完整性
- 错误处理逻辑

### 集成测试
- 沙箱环境完整流程
- 真实支付（小额）
- Webhook可靠性

### 安全测试
- 签名绕过尝试
- 恶意参数注入
- 重放攻击模拟

## 部署考虑

### 环境配置
- 开发: 沙箱配置
- 测试: 测试环境
- 生产: 生产配置 + 监控

### 回滚策略
- 配置回滚: ConfigService热更新
- 代码回滚: Git标签
- 数据库回滚: 迁移脚本

### 监控告警
- 支付失败率阈值
- Webhook延迟阈值
- 签名验证失败告警
- 数据库连接告警

## 权衡和取舍

### 简化vs灵活
- 当前实现偏向简化（双网关）
- 为未来扩展保留接口

### 性能vs安全
- 验证步骤增加延迟，但确保安全
- 关键路径优化（签名验证优化）

### 解耦vs内聚
- 网关抽象增加复杂度
- 但提升可维护性和测试性
