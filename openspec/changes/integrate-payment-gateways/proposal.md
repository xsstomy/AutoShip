# 支付网关集成变更提案

## 变更目标
实现支付宝和Creem支付网关的真实集成，支持订单支付流程、支付链接生成和支付回调处理。

## Why
当前系统虽然已实现订单创建API，但返回的是临时支付链接（TODO注释），无法完成真实的支付流程。这是自动发货系统的核心功能，必须实现支付网关集成才能：

1. **完成业务闭环**：从下单到支付的完整流程
2. **支持实际交易**：用户能够真实购买数字商品
3. **触发自动发货**：支付成功后自动发送商品
4. **保障交易安全**：通过签名验证和Webhook处理确保安全
5. **提升用户体验**：支持主流支付方式（支付宝、Creem）

根据任务拆分文档，支付网关集成预计12K Token，是高优先级的系统级任务。

## 背景
根据任务拆分文档，支付网关集成是第3个子任务，预计12K Token。当前checkout.ts已实现订单创建，返回临时支付链接，需要集成真实的支付网关以完成完整支付流程。

## What Changes
此变更将实现以下新功能和接口：

### 新增文件
- `Backend/src/services/payment-gateway-service.ts` - 支付网关抽象层和具体实现
- `Backend/src/services/payment-service.ts` - 支付业务服务
- `Backend/src/routes/webhooks.ts` - 支付回调处理路由
- `Backend/tests/payment-gateway.test.ts` - 支付网关测试
- `Backend/tests/webhooks.test.ts` - Webhook测试

### 修改文件
- `Backend/src/routes/checkout.ts` - 更新订单创建API生成真实支付链接
- `Backend/src/db/schema.ts` - 扩展支付相关模型（如需要）

### 新增接口
- `POST /api/v1/payments/:orderId` - 创建支付
- `GET /api/v1/payments/:orderId/status` - 查询支付状态
- `POST /webhooks/alipay` - 支付宝支付回调
- `POST /webhooks/creem` - Creem支付回调

### 新增规范
- `openspec/specs/payment-gateway/spec.md` - 支付网关详细规范

### 新增配置项
- `ALIPAY_APP_ID`, `ALIPAY_PRIVATE_KEY`, `ALIPAY_PUBLIC_KEY` - 支付宝配置
- `CREEM_API_KEY`, `CREEM_WEBHOOK_SECRET` - Creem配置
- `PAYMENT_TIMEOUT`, `PAYMENT_RETRY_COUNT` - 支付行为配置

## 变更范围
1. **支付宝集成**（主要支付网关）
   - RSA2签名验证
   - 沙箱和生产环境支持
   - 支付链接生成
   - Webhook回调处理

2. **Creem集成**（备用支付网关）
   - API Key认证
   - 支付链接生成
   - Webhook回调处理
   - 简化回调格式处理

3. **支付流程管理**
   - 支付URL生成服务
   - 支付状态跟踪
   - 订单与支付网关关联
   - 支付失败处理

4. **安全集成**
   - 签名验证
   - Webhook安全性
   - 金额验证
   - 防重复支付

## 技术要求
- 使用Hono框架实现REST API
- 集成ConfigService获取支付配置
- 使用Zod进行数据验证
- 记录审计日志
- 支持环境变量配置
- 兼容SQLite和Cloudflare D1

## 依赖关系
- 依赖数据库模型（已完成）
- 依赖核心订单API（已完成）
- 依赖配置管理系统（已完成）
- 安全配置（已部分完成）
- 与已完成的安全模块集成

## 风险评估
- **高**：支付安全性和签名验证
- **中**：支付网关API差异处理
- **低**：配置管理（已存在）

## 预期成果
- 用户可选择支付网关完成支付
- 系统安全处理支付回调
- 支付状态准确更新
- 支持多种货币（CNY/USD）
- 完整的审计日志

## 测试策略
1. 单元测试：签名验证、配置读取
2. 集成测试：支付链接生成
3. 模拟测试：Webhook处理
4. 安全测试：签名验证绕过尝试

## 下一步
请审批此提案，通过后将创建详细的任务清单和规范文件。
