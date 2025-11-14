# 动态货币与支付网关关联设计文档

## 架构设计

### 整体架构
```
┌─────────────────────────────────────────────────────────┐
│                      前端 (Frontend)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ ProductDetail│  │ CheckoutPage │  │PaymentMethods│   │
│  │   商品详情页  │  │   结算页面    │  │  支付方式选择 │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                 │            │
│         └─────────┬───────┴────────┬────────┘            │
│                   │                │                     │
│         ┌─────────▼────────┐       │                     │
│         │ paymentApi.ts    │       │                     │
│         │  支付API工具类    │       │                     │
│         └─────────┬────────┘       │                     │
└────────────────────┼─────────────────┘                     │
                     │                                       │
                     │ HTTP /api/v1/payments/gateways        │
                     │                                       │
┌────────────────────▼───────────────────────────────────────┐
│                    后端 (Backend)                          │
│  ┌──────────────────────────────────────────────┐        │
│  │     PaymentService.getAvailableGateways()    │        │
│  │           获取可用支付网关列表                │        │
│  └────────────────────┬─────────────────────────┘        │
│                       │                                  │
│            ┌───────────▼───────────┐                      │
│            │ PaymentGatewayManager │                      │
│            │   支付网关管理器       │                      │
│            └───────────┬───────────┘                      │
│                        │                                  │
│  ┌─────────────────────┼──────────────────────┐         │
│  │ 支付宝网关          │     Creem网关          │         │
│  │ AlipayGateway       │     CreemGateway      │         │
│  │ 货币: CNY           │     货币: USD          │         │
│  └─────────────────────┴──────────────────────┘         │
└─────────────────────────────────────────────────────────┘
```

### 数据流设计

#### 1. 商品详情页加载流程
```
开始
  ↓
获取商品ID
  ↓
调用 GET /api/v1/payments/gateways
  ↓
解析网关列表 { gateways: [...] }
  ↓
┌───────────────┐
│ 网关数量判断  │
└───────┬───────┘
  ↓
单网关    双网关    无网关
  ↓        ↓        ↓
自动设置   提供选择   默认CNY
推荐货币   推荐货币   (保守方案)
  ↓        ↓        ↓
显示价格   显示价格   显示价格
+货币切换  +货币切换  (无切换)
按钮?      按钮       按钮
  ↓        ↓        ↓
完成      完成      完成
```

#### 2. 货币与网关匹配逻辑
```typescript
// 货币-网关映射
const CURRENCY_GATEWAY_MAP = {
  CNY: ['alipay'],
  USD: ['creem']
}

// 网关-货币映射
const GATEWAY_CURRENCY_MAP = {
  alipay: 'CNY',
  creem: 'USD'
}

// 推荐货币算法
function getRecommendedCurrency(gateways: GatewayInfo[]): Currency {
  if (gateways.length === 0) return 'CNY' // 保守默认

  if (gateways.length === 1) {
    // 单网关：返回该网关推荐货币
    return gateways[0].recommendedCurrency
  }

  // 多网关：优先返回CNY（国内用户多）
  if (gateways.some(g => g.id === 'alipay')) {
    return 'CNY'
  }
  return gateways[0].recommendedCurrency
}
```

## 核心组件设计

### 1. 后端API扩展

#### 1.1 支付网关信息接口
**文件**: `Backend/src/services/payment-service.ts`

**变更**: 扩展 `getAvailableGateways()` 方法

```typescript
interface GatewayInfo {
  id: string           // 网关ID (alipay, creem)
  name: string         // 网关标识
  displayName: string  // 显示名称
  supportedCurrencies: CurrencyType[]  // 支持的货币
  recommendedCurrency: CurrencyType    // 推荐货币
  isEnabled: boolean   // 是否启用
}
```

**修改点**:
```typescript
async getAvailableGateways(): Promise<GatewayInfo[]> {
  await this.ensureInitialized()

  const enabledGateways = await paymentGatewayManager.getEnabledGateways()

  // 转换为详细信息
  return enabledGateways.map(gateway => ({
    id: gateway.name,
    name: gateway.name,
    displayName: gateway.name === 'alipay' ? '支付宝' : 'Creem',
    supportedCurrencies: gateway.name === 'alipay' ? ['CNY'] : ['USD'],
    recommendedCurrency: gateway.name === 'alipay' ? 'CNY' : 'USD',
    isEnabled: true
  }))
}
```

#### 1.2 API路由扩展
**文件**: `Backend/src/routes/checkout.ts`

**变更**: 扩展 `GET /api/v1/payments/gateways` 响应格式

```typescript
app.get('/payments/gateways', async (c) => {
  try {
    const gateways = await paymentService.getAvailableGateways()

    return c.json({
      success: true,
      data: {
        gateways: gateways,
        // 新增：货币-网关映射表
        currencyGatewayMap: {
          CNY: gateways.filter(g => g.supportedCurrencies.includes('CNY')).map(g => g.id),
          USD: gateways.filter(g => g.supportedCurrencies.includes('USD')).map(g => g.id)
        }
      }
    })
  } catch (error) {
    console.error('获取支付网关列表失败:', error)
    return c.json({
      success: false,
      error: {
        code: 'GATEWAYS_QUERY_FAILED',
        message: '获取支付网关列表失败'
      }
    }, 500)
  }
})
```

### 2. 前端组件设计

#### 2.1 API工具类
**文件**: `frontend/src/utils/payment-api.ts`

**新增方法**:
```typescript
/**
 * 支付网关信息
 */
export interface PaymentGatewayInfo {
  id: string;
  name: string;
  displayName: string;
  supportedCurrencies: Currency[];
  recommendedCurrency: Currency;
  isEnabled: boolean;
}

/**
 * 获取可用的支付网关列表
 */
export async function getAvailableGateways(): Promise<PaymentGatewayInfo[]> {
  const response = await apiRequest<{
    success: boolean;
    data: { gateways: PaymentGatewayInfo[] }
  }>('/payments/gateways');

  if (!response.success || !response.data) {
    throw new Error('获取支付网关列表失败');
  }

  return response.data.gateways;
}

/**
 * 根据网关推荐货币
 */
export function getRecommendedCurrency(gateways: PaymentGatewayInfo[]): Currency {
  if (gateways.length === 0) return 'CNY';

  if (gateways.length === 1) {
    return gateways[0].recommendedCurrency;
  }

  // 多网关：优先CNY
  if (gateways.some(g => g.id === 'alipay')) {
    return 'CNY';
  }

  return gateways[0].recommendedCurrency;
}
```

#### 2.2 商品详情页优化
**文件**: `frontend/src/components/ProductDisplay/ProductDetail.tsx`

**核心逻辑**:
```typescript
const ProductDetail: React.FC = () => {
  // ... 原有状态
  const [availableGateways, setAvailableGateways] = useState<PaymentGatewayInfo[]>([]);
  const [showCurrencyToggle, setShowCurrencyToggle] = useState(false);

  // 加载可用网关
  useEffect(() => {
    const loadGateways = async () => {
      try {
        const gateways = await getAvailableGateways();
        setAvailableGateways(gateways);

        // 设置推荐货币
        const recommendedCurrency = getRecommendedCurrency(gateways);
        setCurrency(recommendedCurrency);

        // 控制货币切换按钮显示
        setShowCurrencyToggle(gateways.length > 1);
      } catch (error) {
        console.error('加载支付网关失败:', error);
        // 降级：使用默认行为
        setCurrency('CNY');
        setShowCurrencyToggle(true);
      }
    };

    if (id) {
      loadGateways();
    }
  }, [id]);

  // ... 渲染逻辑
};
```

#### 2.3 支付方式选择优化
**文件**: `frontend/src/components/Payment/PaymentMethods.tsx`

**核心逻辑**:
```typescript
interface PaymentMethodsProps {
  selectedGateway: PaymentGateway;
  onGatewayChange: (gateway: PaymentGateway) => void;
  disabled?: boolean;
  orderCurrency?: Currency;  // 新增：订单货币
}

// 根据货币筛选网关
function getRecommendedGateways(orderCurrency?: Currency): PaymentMethodConfig[] {
  const baseMethods = [
    {
      id: 'alipay' as PaymentGateway,
      name: 'alipay',
      displayName: '支付宝',
      description: '安全便捷的移动支付',
      icon: '支',
      iconBg: 'bg-blue-500',
      recommended: orderCurrency === 'CNY',
      features: ['扫码支付', '账户余额支付', '银行卡支付']
    },
    {
      id: 'creem' as PaymentGateway,
      name: 'creem',
      displayName: 'Creem',
      description: '国际支付解决方案',
      icon: 'C',
      iconBg: 'bg-green-500',
      recommended: orderCurrency === 'USD',
      features: ['国际信用卡', 'PayPal', '加密货币']
    }
  ];

  // 根据订单货币过滤
  if (orderCurrency) {
    return baseMethods.filter(m => {
      if (orderCurrency === 'CNY') return m.id === 'alipay';
      if (orderCurrency === 'USD') return m.id === 'creem';
      return true;
    });
  }

  return baseMethods;
}
```

## 数据库设计

### 无需修改
当前实现中，货币和支付网关信息主要通过配置管理，无需修改数据库结构。

## 缓存策略

### 后端缓存
- 支付网关配置从 ConfigService 读取，已支持缓存
- 可考虑在 PaymentService 中缓存网关列表（TTL: 5分钟）

### 前端缓存
- 在内存中缓存网关列表（页面生命周期内）
- 可扩展为 sessionStorage 缓存（避免重复请求）

## 错误处理

### 网关列表获取失败
```typescript
try {
  const gateways = await getAvailableGateways();
} catch (error) {
  // 降级到默认行为
  setAvailableGateways([]);
  setCurrency('CNY');  // 保守选择
  setShowCurrencyToggle(true);
  // 显示非阻塞提示
  showToast('部分功能可能受限', 'warning');
}
```

### 货币切换限制
当只有单网关启用时：
- 隐藏货币切换按钮
- 显示提示信息：`当前仅支持支付宝支付（人民币）`

## 性能优化

1. **并行加载**
   - 商品信息和网关列表并行获取
   - 使用 `Promise.all()` 优化

2. **防抖处理**
   - 货币切换时，避免频繁重新计算价格

3. **按需渲染**
   - 货币切换按钮根据网关数量条件渲染
   - 支付方式根据订单货币条件渲染

## 安全性

1. **信任来源**
   - 仅信任后端返回的网关列表
   - 前端不硬编码网关配置

2. **权限控制**
   - 网关启用状态由管理员配置
   - 普通用户无法修改

3. **输入验证**
   - 验证后端返回的网关信息格式
   - 防止恶意数据注入

## 监控与日志

### 后端监控
- 监控网关列表API调用量
- 记录网关配置异常

### 前端监控
- 监控货币切换频率
- 记录支付网关分布统计

### 用户行为分析
- 分析货币选择偏好
- 分析支付网关使用率
