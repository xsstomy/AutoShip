# 变更：商品展示页面

## 为什么
AutoShip 自动发货系统需要一个商品展示页面，让用户能够浏览所有可购买的商品，查看商品详情，并了解商品价格。用户需要能够查看商品列表、切换显示货币（CNY/USD），并能够进入商品详情页查看更多信息。

## 变更内容
- 新增商品展示页面组件（ProductDisplay）
- 实现商品列表展示功能
- 实现价格货币切换功能（CNY/USD）
- 实现商品详情查看功能
- 添加商品数据结构定义
- 配置 React Router 路由

## 影响
- 影响的规范：
  - 新增 `product-display` 能力规范
- 影响的代码：
  - `frontend/src/components/ProductDisplay/` - 商品展示组件目录
  - `frontend/src/types/product.ts` - 商品类型定义
  - `frontend/src/services/productApi.ts` - 商品 API 服务
  - `frontend/src/App.tsx` - 主应用组件和路由配置
- 里程碑：用户端页面开发的第一步，为后续下单流程、支付集成、订单详情等页面提供基础
