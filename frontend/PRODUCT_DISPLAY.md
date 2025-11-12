# 商品展示页面使用说明

## 概述

商品展示页面是 AutoShip 自动发货系统的前端页面之一，负责展示所有可购买的商品列表、价格展示（支持 CNY/USD 货币切换）和商品详情查看。

## 功能特性

### 1. 商品列表展示
- 显示所有可购买的商品
- 商品卡片包含：商品名称、描述、价格、封面图片、商品类型
- 支持商品类型：卡密（card_key）、下载链接（download）、许可证（license）
- 响应式布局：移动端单列，桌面端 3-4 列网格

### 2. 价格货币切换
- 支持 CNY（人民币）和 USD（美元）两种货币
- 货币偏好会自动保存到本地存储
- 实时汇率转换（当前使用固定汇率 0.14）

### 3. 商品详情页
- 点击商品卡片可查看详情
- 完整商品信息展示
- 库存状态显示
- "立即购买"按钮（预留链接）

### 4. 加载状态和错误处理
- 数据加载时显示加载动画
- API 请求失败时显示错误信息
- 支持重试功能
- 空状态提示

## 项目结构

```
frontend/src/
├── components/ProductDisplay/     # 商品展示页面组件
│   ├── ProductDisplay.tsx        # 主页面组件
│   ├── ProductDetail.tsx         # 商品详情页组件
│   ├── ProductCard.tsx           # 商品卡片组件
│   ├── CurrencyToggle.tsx        # 货币切换组件
│   └── LoadingSpinner.tsx        # 加载指示器组件
├── types/
│   └── product.ts                # 商品相关类型定义
├── services/
│   └── productApi.ts             # 商品 API 服务
├── utils/
│   └── currency.ts               # 货币转换工具
└── mock/
    └── products.ts               # 模拟数据
```

## 开发命令

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 代码检查
npm run lint
```

## 访问地址

开发服务器：http://localhost:5175

## 路由配置

- `/` - 商品列表页
- `/product/:id` - 商品详情页

## 开发说明

### 1. 模拟数据
在开发模式下（`import.meta.env.DEV` 为 true），系统会使用 `src/mock/products.ts` 中的模拟数据，无需后端 API 支持。

### 2. API 配置
生产环境下，API 请求会发送到：
- 基础 URL：`${VITE_API_URL}/api` 或 `http://localhost:3000/api`
- 可通过环境变量 `VITE_API_URL` 配置

### 3. 货币转换
- 基础货币：CNY（人民币）
- 汇率：1 CNY = 0.14 USD
- 货币偏好保存在 localStorage 中，键名：`preferred_currency`

### 4. TypeScript 配置
- 使用严格模式
- 类型导入使用 `import type`
- 支持 verbatimModuleSyntax

## 下一步开发

根据需求文档，下一步应该开发：
1. 下单流程页面（邮箱收集、商品选择、订单创建）
2. 支付集成页面（支付宝/Creem 支付跳转）
3. 订单详情页（订单状态查看、发货内容展示）

## 注意事项

- 商品详情页的"立即购买"按钮目前只是预留功能，后续需要集成下单流程
- 货币汇率目前使用固定值，实际生产环境应该从 API 获取实时汇率
- 错误处理和加载状态已经实现，可以根据需要进一步优化用户体验
