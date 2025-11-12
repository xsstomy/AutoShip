# 订单管理API文档

## 概述

订单管理API提供完整的订单生命周期管理功能，包括订单创建、查询、状态管理等核心操作。

**基础路径**: `/api/v1/orders`

## API端点

### 1. 创建订单

**端点**: `POST /api/v1/orders/create`

**描述**: 根据用户提供的商品信息和邮箱创建新订单

**请求体**:
```json
{
  "productId": 1,
  "productName": "数字商品A",
  "email": "user@example.com",
  "price": 99.00,
  "currency": "CNY",
  "gateway": "alipay",
  "customerIp": "192.168.1.1",
  "customerUserAgent": "Mozilla/5.0..."
}
```

**字段说明**:
- `productId`: 商品ID（必填，正整数）
- `productName`: 商品名称（必填，1-255字符）
- `email`: 用户邮箱（必填，有效邮箱格式）
- `price`: 价格（必填，正数）
- `currency`: 货币类型（必填，CNY/USD）
- `gateway`: 支付网关（必填，alipay/creem）
- `customerIp`: 客户IP（可选）
- `customerUserAgent**: 客户浏览器信息（可选）

**成功响应** (201):
```json
{
  "success": true,
  "data": {
    "id": "ORDER202511121200001234",
    "email": "user@example.com",
    "productName": "数字商品A",
    "price": "99.00",
    "currency": "CNY",
    "status": "pending",
    "createdAt": "2025-11-12T12:00:00.000Z",
    "updatedAt": "2025-11-12T12:00:00.000Z"
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数验证失败",
    "details": [...]
  }
}
```

### 2. 获取单个订单

**端点**: `GET /api/v1/orders/:id`

**描述**: 根据订单ID获取订单详情

**路径参数**:
- `id`: 订单ID

**成功响应** (200):
```json
{
  "success": true,
  "data": {
    "id": "ORDER202511121200001234",
    "productId": 1,
    "email": "user@example.com",
    "gateway": "alipay",
    "amount": 99.00,
    "currency": "CNY",
    "status": "pending",
    "gatewayOrderId": null,
    "gatewayData": null,
    "notes": null,
    "customerIp": "192.168.1.1",
    "customerUserAgent": "Mozilla/5.0...",
    "paidAt": null,
    "deliveredAt": null,
    "refundedAt": null,
    "createdAt": "2025-11-12T12:00:00.000Z",
    "updatedAt": "2025-11-12T12:00:00.000Z"
  }
}
```

### 3. 获取订单列表

**端点**: `GET /api/v1/orders`

**描述**: 获取订单列表，支持筛选和分页

**查询参数**:
- `page`: 页码（默认: 1）
- `limit`: 每页数量（默认: 20，最大: 100）
- `status`: 订单状态筛选（pending/paid/delivered/failed/refunded/cancelled）
- `email`: 邮箱筛选
- `gateway`: 支付网关筛选（alipay/creem）
- `currency`: 货币筛选（CNY/USD）
- `startDate`: 开始时间（ISO 8601格式）
- `endDate`: 结束时间（ISO 8601格式）
- `search`: 搜索关键词（匹配订单ID、邮箱、网关订单ID）

**成功响应** (200):
```json
{
  "success": true,
  "data": [
    {
      "id": "ORDER202511121200001234",
      "productId": 1,
      "email": "user@example.com",
      "gateway": "alipay",
      "amount": 99.00,
      "currency": "CNY",
      "status": "pending",
      "createdAt": "2025-11-12T12:00:00.000Z",
      "updatedAt": "2025-11-12T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### 4. 根据邮箱查询订单

**端点**: `GET /api/v1/orders/by-email/:email`

**描述**: 根据邮箱地址查询该用户的所有订单

**路径参数**:
- `email`: 邮箱地址

**查询参数**:
- `page`: 页码（默认: 1）
- `limit`: 每页数量（默认: 20）

**成功响应** (200):
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

### 5. 更新订单状态

**端点**: `PUT /api/v1/orders/:id/status`

**描述**: 更新订单状态，支持状态转换验证

**路径参数**:
- `id`: 订单ID

**请求体**:
```json
{
  "status": "paid",
  "notes": "支付成功",
  "gatewayOrderId": "ALIPAY123456789",
  "gatewayData": "{\"trade_no\":\"ALIPAY123456789\"}"
}
```

**字段说明**:
- `status`: 新状态（必填）
- `notes`: 备注信息（可选，最大500字符）
- `gatewayOrderId`: 支付网关订单ID（可选，最大100字符）
- `gatewayData`: 支付网关数据（可选，JSON字符串）

**状态转换规则**:
- `pending` → `paid` / `failed` / `cancelled`
- `paid` → `delivered` / `refunded` / `cancelled`
- `delivered` → `refunded`
- `failed` / `refunded` / `cancelled` → 终态，不可转换

**成功响应** (200):
```json
{
  "success": true,
  "data": {
    "id": "ORDER202511121200001234",
    "status": "paid",
    "paidAt": "2025-11-12T12:05:00.000Z",
    "updatedAt": "2025-11-12T12:05:00.000Z",
    ...
  }
}
```

### 6. 获取订单统计

**端点**: `GET /api/v1/orders/stats`

**描述**: 获取订单统计信息，支持时间范围筛选

**查询参数**:
- `startDate`: 开始时间（ISO 8601格式）
- `endDate`: 结束时间（ISO 8601格式）

**成功响应** (200):
```json
{
  "success": true,
  "data": {
    "statusStats": [
      {
        "status": "paid",
        "count": 50,
        "totalAmount": 4950.00
      }
    ],
    "gatewayStats": [
      {
        "gateway": "alipay",
        "count": 30,
        "totalAmount": 2970.00
      }
    ],
    "currencyStats": [
      {
        "currency": "CNY",
        "count": 45,
        "totalAmount": 4455.00
      }
    ]
  }
}
```

### 7. 获取最近订单

**端点**: `GET /api/v1/orders/recent`

**描述**: 获取最近的订单列表

**查询参数**:
- `limit`: 返回数量（默认: 10，最大: 50）

**成功响应** (200):
```json
{
  "success": true,
  "data": [
    {
      "id": "ORDER202511121200001234",
      "status": "paid",
      "amount": 99.00,
      "currency": "CNY",
      "createdAt": "2025-11-12T12:00:00.000Z",
      ...
    }
  ]
}
```

## 错误码

| 错误码 | HTTP状态码 | 描述 |
|--------|------------|------|
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |
| `VALIDATION_ERROR` | 400 | 请求参数验证失败 |
| `ORDER_NOT_FOUND` | 404 | 订单不存在 |
| `INVALID_ORDER_ID` | 400 | 订单ID格式无效 |
| `DUPLICATE_ORDER` | 409 | 订单重复 |
| `UPDATE_FAILED` | 500 | 订单更新失败 |
| `INVALID_STATUS_TRANSITION` | 400 | 无效的状态转换 |
| `PRODUCT_NOT_FOUND` | 404 | 商品不存在 |
| `PRODUCT_INACTIVE` | 400 | 商品已下架 |
| `PRICE_MISMATCH` | 400 | 商品价格不匹配 |
| `INVALID_EMAIL` | 400 | 邮箱格式无效 |
| `INSUFFICIENT_INVENTORY` | 400 | 库存不足 |
| `PAYMENT_REQUIRED` | 402 | 需要支付 |

## 订单状态

| 状态 | 描述 | 可转换状态 |
|------|------|------------|
| `pending` | 待支付 | paid, failed, cancelled |
| `paid` | 已支付 | delivered, refunded, cancelled |
| `delivered` | 已发货 | refunded |
| `failed` | 支付失败 | 终态 |
| `refunded` | 已退款 | 终态 |
| `cancelled` | 已取消 | 终态 |

## 支付网关

| 网关 | 描述 |
|------|------|
| `alipay` | 支付宝 |
| `creem` | Creem支付 |

## 货币类型

| 货币 | 描述 |
|------|------|
| `CNY` | 人民币 |
| `USD` | 美元 |

## 数据格式

### 日期时间
所有日期时间字段使用ISO 8601格式：`2025-11-12T12:00:00.000Z`

### 金额
金额字段使用数字类型，响应中可能以字符串形式返回以保持精度

### 订单ID格式
订单ID格式：`ORDER` + 14位时间戳 + 4位随机数
例如：`ORDER202511121200001234`

## 示例代码

### JavaScript/TypeScript

```typescript
// 创建订单
const createOrder = async (orderData: CreateOrderRequestType) => {
  const response = await fetch('/api/v1/orders/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(orderData),
  })

  const result = await response.json()
  if (result.success) {
    console.log('订单创建成功:', result.data)
    return result.data
  } else {
    console.error('订单创建失败:', result.error)
    throw new Error(result.error.message)
  }
}

// 查询订单
const getOrder = async (orderId: string) => {
  const response = await fetch(`/api/v1/orders/${orderId}`)
  const result = await response.json()

  if (result.success) {
    return result.data
  } else {
    throw new Error(result.error.message)
  }
}

// 更新订单状态
const updateOrderStatus = async (orderId: string, status: string) => {
  const response = await fetch(`/api/v1/orders/${orderId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  })

  const result = await response.json()
  if (result.success) {
    return result.data
  } else {
    throw new Error(result.error.message)
  }
}
```

### cURL

```bash
# 创建订单
curl -X POST http://localhost:3000/api/v1/orders/create \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 1,
    "productName": "数字商品A",
    "email": "user@example.com",
    "price": 99.00,
    "currency": "CNY",
    "gateway": "alipay"
  }'

# 获取订单
curl http://localhost:3000/api/v1/orders/ORDER202511121200001234

# 更新订单状态
curl -X PUT http://localhost:3000/api/v1/orders/ORDER202511121200001234/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "paid",
    "notes": "支付成功"
  }'
```

## 注意事项

1. **订单ID唯一性**: 订单ID是全局唯一的，重复创建相同订单会返回错误
2. **状态转换**: 订单状态转换受业务规则约束，非法转换会被拒绝
3. **价格验证**: 创建订单时系统会验证商品价格，防止价格篡改
4. **并发安全**: 订单创建使用数据库事务确保数据一致性
5. **分页限制**: 列表查询默认每页20条记录，最大支持100条
6. **搜索功能**: 支持模糊搜索订单ID、邮箱和网关订单ID
7. **时间格式**: 所有时间相关参数和返回值均使用ISO 8601格式
8. **错误处理**: 所有API返回统一格式的错误信息，包含错误码和详细描述