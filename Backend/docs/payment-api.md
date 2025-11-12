# 支付API文档

## 概述

本文档描述了AutoShip支付系统的API接口，包括订单创建、支付处理、Webhook回调等功能。

## 基础信息

- **Base URL**: `http://localhost:3000`
- **API版本**: v1
- **Content-Type**: `application/json`
- **认证方式**: 无（公开接口）

## 错误响应格式

所有API错误都遵循统一的响应格式：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述信息"
  }
}
```

常见错误码：
- `VALIDATION_ERROR`: 参数验证失败
- `ORDER_NOT_FOUND`: 订单不存在
- `PAYMENT_CREATION_FAILED`: 支付创建失败
- `PAYMENT_GATEWAY_UNAVAILABLE`: 支付网关不可用
- `SIGNATURE_INVALID`: 签名验证失败

---

## 1. 创建订单

### 1.1 创建订单并生成支付链接

**接口**: `POST /api/v1/checkout/create`

**描述**: 创建新订单并生成对应的支付链接

**请求体**:
```json
{
  "productId": "1",
  "productName": "数字商品A",
  "price": 99.00,
  "currency": "CNY",
  "email": "user@example.com",
  "gateway": "alipay"
}
```

**参数说明**:
- `productId` (string, 必填): 商品ID
- `productName` (string, 必填): 商品名称
- `price` (number, 必填): 价格
- `currency` (string, 必填): 货币类型 (CNY | USD)
- `email` (string, 必填): 用户邮箱
- `gateway` (string, 必填): 支付网关 (alipay | creem)

**响应示例** (200):
```json
{
  "success": true,
  "data": {
    "order": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "productId": "1",
      "email": "user@example.com",
      "gateway": "alipay",
      "amount": 99.00,
      "currency": "CNY",
      "status": "pending",
      "createdAt": "2025-11-12T10:00:00Z",
      "updatedAt": "2025-11-12T10:00:00Z"
    },
    "paymentUrl": "https://payment.alipay.com/xxx",
    "expiresAt": "2025-11-12T10:30:00Z"
  }
}
```

---

## 2. 支付状态查询

### 2.1 查询支付状态

**接口**: `GET /api/v1/payments/{orderId}/status`

**描述**: 查询指定订单的当前支付状态

**路径参数**:
- `orderId` (string, 必填): 订单ID

**响应示例** (200):
```json
{
  "success": true,
  "data": {
    "orderId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "paid",
    "amount": 99.00,
    "currency": "CNY",
    "gateway": "alipay",
    "gatewayOrderId": "ALIPAY_xxx",
    "paidAt": "2025-11-12T10:05:00Z",
    "createdAt": "2025-11-12T10:00:00Z"
  }
}
```

**订单状态说明**:
- `pending`: 待支付
- `paid`: 已支付
- `delivered`: 已发货
- `failed`: 支付失败
- `refunded`: 已退款
- `cancelled`: 已取消

### 2.2 重新创建支付链接

**接口**: `POST /api/v1/payments/{orderId}/retry`

**描述**: 为已创建的订单重新生成支付链接（支付失败或超时后使用）

**路径参数**:
- `orderId` (string, 必填): 订单ID

**响应示例** (200):
```json
{
  "success": true,
  "data": {
    "orderId": "550e8400-e29b-41d4-a716-446655440000",
    "paymentUrl": "https://payment.alipay.com/yyy",
    "expiresAt": "2025-11-12T10:30:00Z"
  }
}
```

### 2.3 获取可用的支付网关

**接口**: `GET /api/v1/payments/gateways`

**描述**: 获取当前系统支持的支付网关列表

**响应示例** (200):
```json
{
  "success": true,
  "data": {
    "gateways": [
      {
        "id": "alipay",
        "name": "支付宝"
      },
      {
        "id": "creem",
        "name": "Creem"
      }
    ]
  }
}
```

---

## 3. 商品验证

### 3.1 验证商品是否可购买

**接口**: `GET /api/v1/checkout/products/{id}/validate`

**描述**: 验证指定商品是否有效并可购买

**路径参数**:
- `id` (string, 必填): 商品ID

**响应示例** (200):
```json
{
  "success": true,
  "data": {
    "valid": true,
    "product": {
      "id": 1,
      "name": "数字商品A",
      "isActive": true,
      "price": 99.00,
      "currency": "CNY"
    }
  }
}
```

---

## 4. Webhook回调

### 4.1 支付宝Webhook

**接口**: `POST /webhooks/alipay`

**描述**: 接收支付宝支付状态回调

**Content-Type**: `application/json` 或 `application/x-www-form-urlencoded`

**请求体示例**:
```json
{
  "out_trade_no": "550e8400-e29b-41d4-a716-446655440000",
  "trade_no": "ALIPAY_TRADE_NO",
  "trade_status": "TRADE_SUCCESS",
  "total_amount": "99.00",
  "sign": "xxx",
  "sign_type": "RSA2"
}
```

**响应**:
- 成功: `200 OK` 返回 `success`
- 失败: `400 Bad Request` 返回 `failure`

### 4.2 Creem Webhook

**接口**: `POST /webhooks/creem`

**描述**: 接收Creem支付状态回调

**Content-Type**: `application/json`

**请求体示例**:
```json
{
  "order_id": "550e8400-e29b-41d4-a716-446655440000",
  "transaction_id": "CREEM_TX_123",
  "status": "payment_succeeded",
  "amount": 99.00,
  "currency": "CNY"
}
```

**响应示例**:
```json
{
  "status": "success",
  "message": "Webhook processed successfully",
  "orderId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## 5. 监控与调试

### 5.1 Webhook健康检查

**接口**: `GET /webhooks/health`

**描述**: 检查Webhook端点和支付服务是否正常

**响应示例** (200):
```json
{
  "status": "healthy",
  "timestamp": "2025-11-12T10:00:00Z",
  "gateways": ["alipay"],
  "service": "webhooks"
}
```

### 5.2 查询支付状态（调试用）

**接口**: `GET /webhooks/{gateway}/status/{orderId}`

**描述**: 通过Webhook路径查询支付状态（仅用于调试）

**路径参数**:
- `gateway` (string): 支付网关 (alipay | creem)
- `orderId` (string): 订单ID

### 5.3 测试Webhook（仅开发环境）

**接口**: `POST /webhooks/test/{gateway}`

**描述**: 模拟支付回调，用于测试（仅开发环境可用）

**路径参数**:
- `gateway` (string): 支付网关 (alipay | creem)

**查询参数**:
- `orderId` (string, 可选): 订单ID，默认为自动生成
- `amount` (string, 可选): 金额，默认为 99.00
- `currency` (string, 可选): 货币，默认为 CNY

**请求示例**:
```
POST /webhooks/test/alipay?orderId=test123&amount=99
```

**响应示例**:
```json
{
  "success": true,
  "message": "Payment processed successfully",
  "orderId": "test123",
  "test": true,
  "payload": { ... }
}
```

---

## 6. 订单查询

### 6.1 获取订单详情

**接口**: `GET /api/v1/orders/{orderId}`

**描述**: 获取订单的详细信息

**路径参数**:
- `orderId` (string, 必填): 订单ID

**响应示例** (200):
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "productId": 1,
    "email": "user@example.com",
    "gateway": "alipay",
    "amount": 99.00,
    "currency": "CNY",
    "status": "paid",
    "gatewayOrderId": "ALIPAY_xxx",
    "paidAt": "2025-11-12T10:05:00Z",
    "createdAt": "2025-11-12T10:00:00Z",
    "updatedAt": "2025-11-12T10:05:00Z"
  }
}
```

---

## 支付流程说明

### 标准支付流程

1. **创建订单**
   ```
   客户端 → POST /api/v1/checkout/create → 返回支付URL
   ```

2. **用户支付**
   ```
   客户端 → 跳转至支付URL → 支付网关 → 用户完成支付
   ```

3. **Webhook回调**
   ```
   支付网关 → POST /webhooks/{gateway} → 验证签名 → 更新订单状态
   ```

4. **查询状态**
   ```
   客户端 → GET /api/v1/payments/{orderId}/status → 返回当前状态
   ```

### 支付状态机

```
pending → paid → delivered
    ↓       ↓
  failed   refunded
    ↓
cancelled
```

---

## 错误处理

### 常见错误及解决方案

1. **PAYMENT_CREATION_FAILED**
   - 原因: 支付网关配置错误或不可用
   - 解决: 检查环境变量配置，确保支付网关已启用

2. **SIGNATURE_INVALID**
   - 原因: Webhook签名验证失败
   - 解决: 检查支付网关公钥是否正确

3. **ORDER_NOT_FOUND**
   - 原因: 订单ID不存在或已删除
   - 解决: 检查订单ID是否正确

4. **VALIDATION_ERROR**
   - 原因: 请求参数格式不正确
   - 解决: 检查请求体格式和必填参数

---

## 安全注意事项

1. **Webhook安全**
   - 所有Webhook请求都会验证签名
   - 重复请求会被拒绝（幂等性保护）

2. **金额验证**
   - 系统会验证回调金额与订单金额是否一致
   - 允许微小差异（< 1%）

3. **签名时效**
   - Webhook请求有时间窗口限制
   - 超过5分钟的请求会被拒绝

---

## 联系支持

如有问题，请联系技术支持团队。
