## MODIFIED Requirements

### Requirement: 订单创建
系统 SHALL 根据用户输入的邮箱和页面商品信息创建订单，并与后端API交互完成订单数据持久化。

#### Scenario: 订单创建成功
- **GIVEN** 用户已输入有效邮箱，且商品信息已确认
- **WHEN** 用户点击"确认下单"按钮
- **THEN** 系统：
  1. 发送POST请求到 `/api/v1/orders/create`
  2. 包含参数：`{ productId, productName, email, price, currency }`
  3. 显示加载状态（按钮显示"处理中..."）
  4. 订单创建成功后，自动跳转到支付页面
  5. 支付页面URL包含订单ID参数（如：`/payment?orderId=ORDER202511121200001234`）

#### Scenario: 订单创建API响应格式
- **GIVEN** 订单创建API调用成功时
- **WHEN** 后端返回订单数据时
- **THEN** 系统接收标准JSON响应格式：
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
    "createdAt": "2025-11-12T12:00:00Z"
  }
}
```

#### Scenario: 订单创建失败响应
- **GIVEN** 订单创建API调用失败时
- **WHEN** 后端返回错误信息时
- **THEN** 系统接收标准错误响应格式：
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "邮箱格式无效",
    "details": {
      "field": "email",
      "reason": "invalid_format"
    }
  }
}
```

#### Scenario: 订单创建API失败
- **GIVEN** 用户已输入有效邮箱，且商品信息已确认
- **WHEN** 用户点击"确认下单"按钮
- **AND** API请求失败或返回错误
- **THEN** 系统：
  1. 隐藏加载状态
  2. 显示具体的错误提示（基于API返回的错误信息）
  3. 按钮恢复为"确认下单"状态
  4. 不进行页面跳转

#### Scenario: 网络连接异常
- **GIVEN** 用户已输入有效邮箱，且商品信息已确认
- **WHEN** 用户点击"确认下单"按钮
- **AND** 网络连接超时或断开
- **THEN** 系统：
  1. 显示错误提示："网络连接失败，请检查网络后重试"
  2. 按钮恢复为"确认下单"状态
  3. 提供重试按钮