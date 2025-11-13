# 订单管理 API 文档

## 概述
订单管理 API 为管理员提供订单查询、筛选、重发邮件和退款操作功能。

## 认证
所有 API 请求需要在 Header 中包含有效的管理员认证令牌：
```
Authorization: Bearer <admin_token>
```

## API 端点

### 1. 获取订单列表
**GET** `/api/admin/orders`

查询参数：
- `page` (number, optional): 页码，默认 1
- `limit` (number, optional): 每页数量，默认 20
- `status` (string, optional): 订单状态筛选
- `gateway` (string, optional): 支付方式筛选
- `dateFrom` (string, optional): 开始日期 (YYYY-MM-DD)
- `dateTo` (string, optional): 结束日期 (YYYY-MM-DD)
- `search` (string, optional): 搜索关键词（订单ID或邮箱）
- `sortBy` (string, optional): 排序字段，默认 createdAt
- `sortOrder` (string, optional): 排序方向，asc 或 desc，默认 desc

响应示例：
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "订单ID",
        "productId": 1,
        "email": "user@example.com",
        "gateway": "alipay",
        "amount": 99.99,
        "currency": "CNY",
        "status": "paid",
        "createdAt": "2025-11-13T10:00:00Z",
        "updatedAt": "2025-11-13T10:00:00Z",
        "product": {
          "name": "商品名称"
        }
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
}
```

### 2. 获取筛选选项
**GET** `/api/admin/orders/filter-options`

响应示例：
```json
{
  "success": true,
  "data": {
    "statuses": [
      { "value": "pending", "label": "待支付" },
      { "value": "paid", "label": "已支付" }
    ],
    "gateways": [
      { "value": "alipay", "label": "支付宝" },
      { "value": "creem", "label": "Creem" }
    ],
    "currencies": [
      { "value": "CNY", "label": "人民币 (CNY)" },
      { "value": "USD", "label": "美元 (USD)" }
    ],
    "dateRanges": [
      { "value": "today", "label": "今天" },
      { "value": "last7days", "label": "最近7天" }
    ],
    "sortOptions": [
      { "value": "createdAt:desc", "label": "创建时间 (最新在前)" }
    ]
  }
}
```

### 3. 重发邮件
**POST** `/api/admin/orders/{orderId}/resend`

响应示例：
```json
{
  "success": true,
  "message": "邮件重发成功",
  "data": {
    "orderId": "订单ID",
    "email": "user@example.com",
    "resendAt": "2025-11-13T10:00:00Z"
  }
}
```

### 4. 退款操作
**POST** `/api/admin/orders/{orderId}/refund`

请求体：
```json
{
  "reason": "退款原因"
}
```

响应示例：
```json
{
  "success": true,
  "message": "退款操作成功",
  "data": {
    "orderId": "订单ID",
    "amount": 99.99,
    "currency": "CNY",
    "gateway": "alipay",
    "refundAt": "2025-11-13T10:00:00Z"
  }
}
```

## 错误响应
所有 API 在出现错误时返回统一格式：
```json
{
  "success": false,
  "error": "错误描述"
}
```

常见错误码：
- `401`: 未授权访问，需要重新登录
- `403`: 权限不足，不是管理员
- `404`: 订单不存在
- `400`: 请求参数无效

## 权限限制
- 只有已认证的管理员可以访问
- 仅已发货或已支付订单可以重发邮件
- 仅已支付订单可以退款
