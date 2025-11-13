  默认管理员账号：
  - 用户名: admin
  - 密码: admin123
  - 邮箱: admin@example.com
  - 角色: super_admin

# AutoShip API 文档

## 概述

AutoShip API 提供自动发货系统的后端服务，包括商品管理、订单处理、支付集成等功能。

**基础URL**: `http://localhost:3000`

## 认证

目前API不需要认证，但后续的支付集成和管理接口将需要相应的认证机制。

## 通用响应格式

所有API响应都遵循统一的格式：

```json
{
  "success": boolean,
  "data": object | null,
  "error": string | null,
  "message": string | null
}
```

## 错误码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 下单流程 API

### 1. 创建订单

**端点**: `POST /api/v1/checkout/create`

**描述**: 创建新订单，用于用户下单流程

**请求头**:
```
Content-Type: application/json
```

**请求体**:
```json
{
  "productId": "string",        // 商品ID
  "productName": "string",      // 商品名称
  "price": number,             // 价格
  "currency": "CNY|USD",       // 货币类型
  "email": "string",           // 邮箱地址
  "gateway": "alipay|creem|paypal" // 支付网关
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "order": {
      "id": "uuid",
      "productId": "1",
      "email": "user@example.com",
      "gateway": "creem",
      "amount": 99.99,
      "currency": "CNY",
      "status": "pending",
      "createdAt": "2023-12-07T10:00:00Z",
      "updatedAt": "2023-12-07T10:00:00Z"
    },
    "paymentUrl": "/payment/uuid"
  }
}
```

**错误响应示例**:
```json
{
  "success": false,
  "error": "商品不存在"
}
```

### 2. 验证商品

**端点**: `GET /api/v1/products/{id}/validate`

**描述**: 验证商品是否可购买（检查商品是否存在、是否上架等）

**路径参数**:
- `id`: 商品ID

**响应示例**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "product": {
      "id": 1,
      "name": "软件许可证",
      "isActive": true,
      "price": 99.99,
      "currency": "CNY"
    }
  }
}
```

## 数据模型

### Order (订单)

```typescript
interface Order {
  id: string;                 // 订单ID (UUID)
  productId: string;         // 商品ID
  email: string;             // 邮箱地址
  gateway: PaymentGateway;   // 支付网关
  amount: number;            // 订单金额
  currency: Currency;        // 货币类型
  status: OrderStatus;       // 订单状态
  gatewayOrderId?: string;   // 支付网关订单ID
  createdAt: string;         // 创建时间
  updatedAt: string;         // 更新时间
}
```

### 枚举类型

```typescript
type OrderStatus = 'pending' | 'paid' | 'delivered' | 'cancelled' | 'refunded';
type PaymentGateway = 'alipay' | 'creem' | 'paypal';
type Currency = 'CNY' | 'USD';
```

## 前端集成

### 1. 商品详情页跳转

商品详情页的"立即购买"按钮应跳转到下单页面，并传递商品信息：

```javascript
const checkoutUrl = `/checkout?productId=1&productName=软件许可证&price=99.99&currency=CNY`;
window.location.href = checkoutUrl;
```

### 2. 下单页面流程

1. 接收查询参数中的商品信息
2. 用户输入邮箱地址
3. 前端验证邮箱格式
4. 调用创建订单API
5. 成功后跳转到支付页面

## 测试

### 使用curl测试

```bash
# 创建订单
curl -X POST http://localhost:3000/api/v1/checkout/create \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "1",
    "productName": "测试商品",
    "price": 99.99,
    "currency": "CNY",
    "email": "test@example.com",
    "gateway": "creem"
  }'

# 验证商品
curl http://localhost:3000/api/v1/products/1/validate
```

### 使用前端测试

1. 启动前端服务: `cd frontend && npm run dev`
2. 访问商品详情页: `http://localhost:5173/product/1`
3. 点击"立即购买"按钮进入下单页面
4. 输入邮箱地址并提交订单

## 支付集成

TODO: 后续将集成支付宝、PayPal、Creem等支付网关的具体实现。

## 管理接口

TODO: 后续将添加管理员接口，包括：
- 商品管理
- 订单管理
- 支付配置
- 系统设置

## Webhook

TODO: 后续将添加支付网关的webhook接口，用于接收支付状态通知。