# 动态货币与支付网关关联提案

## 背景

当前系统存在以下问题：
1. 前端价格显示的货币切换是用户手动操作，未与实际启用的支付网关关联
2. 用户可能选择与支付网关不匹配的货币，导致支付失败
3. 支付方式选择组件缺少对Creem网关的支持
4. 没有根据已开通的支付网关自动推荐合适的货币

## Why

实现这个变更有以下重要原因：

1. **用户体验提升**
   - 消除用户选择错误货币的困扰
   - 提供智能的默认推荐，减少操作步骤
   - 根据支付网关自动显示合适货币，符合用户期望

2. **支付成功率提升**
   - 避免用户选择与支付网关不匹配的货币导致的支付失败
   - 自动推荐匹配的支付网关，简化支付流程
   - 降低因配置不匹配导致的客服咨询

3. **系统智能化**
   - 将支付网关配置与前端展示逻辑解耦
   - 实现配置驱动的动态展示，无需代码修改
   - 为未来扩展新支付网关奠定基础

4. **商业价值**
   - 支持国际化支付（Creem USD）
   - 提升国内用户支付体验（支付宝 CNY）
   - 降低运营成本（减少支付失败和客服压力）

## 目标

实现前端价格显示与支付网关的智能关联：
1. 根据后端返回的已启用支付网关，动态显示对应货币
   - 开通支付宝 → 显示人民币（CNY）
   - 开通Creem → 显示美元（USD）
   - 同时开通两者 → 允许用户选择货币
2. 支付时根据显示的货币自动选择或推荐对应的支付网关
3. 提供统一的支付网关信息API，包含货币支持信息

## 方案设计

### 后端变更
1. **扩展支付网关API**（`/api/v1/payments/gateways`）
   - 返回每个网关的详细信息：ID、名称、支持货币
   - 格式：`{ id: 'alipay', name: '支付宝', supportedCurrencies: ['CNY'], recommendedCurrency: 'CNY' }`

2. **货币-网关映射关系**
   - alipay → CNY（人民币）
   - creem → USD（美元）

### 前端变更
1. **商品详情页**（ProductDetail.tsx）
   - 页面加载时获取可用的支付网关列表
   - 根据网关数量自动设置货币：
     - 仅支付宝：默认CNY，不可切换
     - 仅Creem：默认USD，不可切换
     - 两者都有：默认CNY，允许切换
   - 优化货币切换按钮的显示逻辑

2. **支付方式选择**（PaymentMethods.tsx）
   - 支持显示所有启用的支付网关（支付宝+Creem）
   - 根据订单货币自动推荐对应的支付网关
   - 禁用与订单货币不匹配的网关选项

3. **新增API调用逻辑**
   - 创建 `getAvailableGateways()` 获取网关列表
   - 创建 `getRecommendedCurrency()` 根据网关推荐货币

### 数据流设计
```
1. 商品详情页加载
   ↓
2. 调用 /api/v1/payments/gateways 获取可用网关
   ↓
3. 根据网关数量推荐货币
   ↓
4. 显示商品价格（推荐货币）
   ↓
5. 用户点击"立即购买"
   ↓
6. 进入结算页，默认选择推荐网关
   ↓
7. 确认订单，创建支付
```

## What Changes

### 文件变更列表

#### 后端文件
1. **Backend/src/services/payment-service.ts**
   - 修改 `getAvailableGateways()` 方法返回详细信息
   - 新增字段：supportedCurrencies, recommendedCurrency, isEnabled

2. **Backend/src/routes/checkout.ts**
   - 扩展 `GET /api/v1/payments/gateways` API响应
   - 新增字段：currencyGatewayMap

#### 前端文件
1. **frontend/src/utils/payment-api.ts**
   - 新增 `PaymentGatewayInfo` 接口
   - 新增 `getAvailableGateways()` 函数
   - 新增 `getRecommendedCurrency()` 辅助函数

2. **frontend/src/components/ProductDisplay/ProductDetail.tsx**
   - 新增状态：`availableGateways`, `showCurrencyToggle`
   - 在 useEffect 中获取网关列表并设置推荐货币
   - 控制货币切换按钮的显示逻辑

3. **frontend/src/components/Payment/PaymentMethods.tsx**
   - 新增属性：`orderCurrency`
   - 新增Creem支付方式配置
   - 根据货币筛选可用网关
   - 自动推荐匹配的网关

4. **frontend/src/components/Checkout/CheckoutPage.tsx**
   - 根据货币自动设置默认支付网关

### 数据库变更
- **无数据库变更**（依赖现有配置管理）

### 新增依赖
- 无新增外部依赖

### 破坏性变更
- **无破坏性变更**（完全向后兼容）

## 技术实现

### 后端API扩展
```typescript
// GET /api/v1/payments/gateways 响应格式
{
  "success": true,
  "data": {
    "gateways": [
      {
        "id": "alipay",
        "name": "支付宝",
        "displayName": "支付宝",
        "supportedCurrencies": ["CNY"],
        "recommendedCurrency": "CNY",
        "isEnabled": true
      },
      {
        "id": "creem",
        "name": "creem",
        "displayName": "Creem",
        "supportedCurrencies": ["USD"],
        "recommendedCurrency": "USD",
        "isEnabled": true
      }
    ]
  }
}
```

### 前端逻辑优化
1. **商品详情页**
   - 使用 `useEffect` 在组件挂载时获取网关列表
   - 根据网关推荐逻辑设置初始货币
   - 控制货币切换按钮的显示

2. **支付方式选择**
   - 根据订单货币过滤可用的支付网关
   - 自动选中推荐网关（根据货币匹配）
   - 提供友好的禁用状态提示

## 兼容性考虑

1. **向后兼容**
   - 现有API保持兼容（增加字段不影响旧版本）
   - 前端降级：如果无法获取网关列表，使用默认行为（CNY）

2. **多网关场景**
   - 当两个网关都启用时，提供货币选择
   - 确保货币与网关的正确映射

3. **错误处理**
   - 获取网关列表失败时，使用保守默认值
   - 显示明确的错误提示

## 测试计划

1. **单元测试**
   - 货币推荐逻辑测试
   - 网关筛选逻辑测试

2. **集成测试**
   - 仅支付宝启用场景
   - 仅Creem启用场景
   - 双网关启用场景
   - 网关不可用场景

3. **手动测试**
   - 商品详情页货币显示
   - 支付流程完整性
   - 不同网关的支付体验

## 预期效果

1. **用户体验提升**
   - 减少用户选择错误货币的概率
   - 提供更智能的默认选项
   - 支付成功率提高

2. **系统稳定性**
   - 避免货币-网关不匹配导致的支付失败
   - 降低客服咨询量

3. **可扩展性**
   - 未来新增支付网关时，可复用此逻辑
   - 支持多货币多网关的灵活配置
