# 自动发货网站需求说明

## 一、项目概述
本项目目标是开发一个 **自动发货型网站**，支持多种数字商品（卡密、下载链接、许可证等），实现自动支付、发货、邮件通知和订单管理。

- **前端框架**：React + Vite + Tailwind  
- **后端框架**：Hono  
- **数据库**：Cloudflare D1（兼容 SQLite），支持 VPS 运行时使用 SQLite  
- **支付渠道**：支付宝（主）与 Creem（备）  
- **发货方式**：统一以文本形式存储和发送，可是卡密、下载链接或许可证文本  

## 二、核心功能

### 1. 支付与订单流程
1. 用户选择商品并下单  
2. 后端创建订单（`pending` 状态）  
3. 跳转到支付页面（支付宝或 Creem）  
4. 支付完成后，网关回调系统接口（Webhook）  
5. 验签成功 → 订单状态更新为 `paid`  
6. 系统自动发货并通过邮件发送结果  
7. 用户可通过邮件或订单详情页查看发货内容  

## 三、系统架构与部署

| 模块 | 技术栈 / 服务 |
|------|----------------|
| 前端 | React + Tailwind |
| 后端 | Hono |
| 数据库 | Cloudflare D1 / SQLite |
| 邮件服务 | Resend |
| 支付通道 | Alipay / Creem |
| 部署环境 | Cloudflare Workers 或 VPS（Node + SQLite） |

## 四、主要功能模块

### 1. 商品管理
- 支持单一商品（MVP）  
- 商品类型统一为「文本发货」  
- 支持多币种定价（CNY / USD）

### 2. 订单系统
- 状态流转：`pending → paid → refunded/failed`  
- 订单信息包含邮箱、支付通道、金额、币种等  
- 支持多支付网关（支付宝 / Creem）  
- 后台可手动标记退款或失败  

### 3. 发货系统
- 统一文本发货，可存储以下三类信息：
  - 卡密
  - 下载链接
  - 许可证文本  
- 优先从 `inventory_text` 表扣取库存；库存不足时使用商品描述中的模板文本  
- 下载类内容可生成签名 URL（72 小时有效、最多 3 次下载）  

### 4. 邮件通知
- 邮件内容包括：
  - 订单号、商品名称、发货内容或下载按钮  
  - 支持模板化（HTML + 变量）  
- 邮件服务使用 Resend  

### 5. 支付回调
- **支付宝**  
  - 异步通知 `/api/webhooks/alipay`  
  - 使用 RSA2 验签  
  - 状态映射：
    - `TRADE_SUCCESS / TRADE_FINISHED` → `paid`
    - `TRADE_CLOSED` → `failed / refunded`
- **Creem**  
  - 回调 `/api/webhooks/creem`  
  - 签名校验或 IP 白名单验证  
  - 状态映射：
    - `payment_succeeded` → `paid`
    - `payment_failed / payment_canceled` → `failed`

## 五、后台功能（MVP）
- 系统设置（默认网关、允许 URL 参数覆盖）  
- 商品管理（查看 / 编辑价格）  
- 库存导入（卡密/文本批量导入）  
- 订单列表（按邮箱/状态筛选）  
- 发货记录查看  
- 重发邮件  
- 全额退款（调用网关 API 或人工标记）  

## 六、安全与合规
- Webhook 验签 + 幂等机制（`payments_raw` 表）  
- 订单金额与回调金额强校验  
- 下载链接签名、限次、限期（默认 72 小时 3 次）  
- 后台入口隐藏 + 访问口令（可选 IP 白名单）  
- 所有回调原文保存至数据库以便审计  

## 七、数据库表设计（摘要）

| 表名 | 说明 |
|------|------|
| `products` | 商品信息 |
| `product_prices` | 商品定价（支持多币种） |
| `orders` | 订单记录 |
| `deliveries` | 发货记录（文本内容或下载 token） |
| `downloads` | 下载日志 |
| `payments_raw` | 支付回调日志（幂等与验签记录） |
| `inventory_text` | 文本库存（可用于卡密池） |
| `settings` | 系统配置项 |

## 八、配置项示例

```env
RUNTIME=node 或 cf
DEFAULT_GATEWAY=alipay
ALLOW_GATEWAY_PARAM=true
SITE_BASE_URL=https://yourdomain.com

ALIPAY_APP_ID=...
ALIPAY_APP_PRIVATE_KEY=...
ALIPAY_PUBLIC_KEY=...
ALIPAY_GATEWAY_HOST=https://openapi.alipay.com/gateway.do
ALIPAY_RETURN_URL=https://yourdomain.com/return
ALIPAY_NOTIFY_URL=https://yourdomain.com/api/webhooks/alipay

CREEM_API_KEY=...
CREEM_WEBHOOK_SECRET=...

RESEND_API_KEY=re_...

# Cloudflare D1
DB=auto_ship_db
```

## 九、下载策略
- 有效期：72 小时  
- 下载次数：3 次  
- 超过次数或过期后链接失效  
- 所有下载操作写入 `downloads` 表日志  

## 十、退款策略
- 仅支持全额退款  
- 管理员后台点击退款后：
  1. 调用支付宝或 Creem API 发起退款  
  2. 收到回调后订单状态变为 `refunded`  
  3. 自动失效相关发货（链接、卡密、许可证）  

## 十一、订单查询
- 支持通过邮件中的安全链接查看  
- 支付完成页提供“查看订单”按钮  
- 不需注册账号  

## 十二、非功能需求
| 项目 | 说明 |
|------|------|
| 可用性 | 99%（单节点即可） |
| 并发能力 | < 100 QPS，SQLite 足够 |
| 数据安全 | 仅存邮箱与订单数据 |
| 扩展性 | 后期可迁移到 Postgres |
| 国际化 | 支持 CNY / USD 两币种显示 |

## 十三、开发与部署路线图

1. 建立数据库结构（D1/SQLite）  
2. 实现 `/api/checkout` 与 `/api/webhooks/*`  
3. 实现发货逻辑与邮件通知  
4. 构建 React 前端 3 页面（商品 / 下单 / 订单详情）  
5. 接入支付宝真实回调（沙箱→生产）  
6. 后台管理（库存导入 / 订单查询 / 重发邮件）  
7. 上线测试与监控  

## 十四、MVP 验收标准
- ✅ 能完成真实支付并自动发货  
- ✅ 邮件中包含有效内容或下载链接  
- ✅ 下载限时限次机制生效  
- ✅ 后台可导入库存、查看订单、重发邮件  
- ✅ Webhook 验签与幂等测试通过  
