## 1. 环境准备和依赖安装
- [ ] 1.1 安装 React Router 依赖（用于页面路由）
- [ ] 1.2 安装 Axios 依赖（用于 API 请求）
- [ ] 1.3 确认 Tailwind CSS 配置正确

## 2. 类型定义和数据结构
- [ ] 2.1 创建商品类型定义文件（frontend/src/types/product.ts）
  - Product 接口：包含 id、name、description、price、currency、image、type 等字段
  - Currency 枚举：CNY、USD
- [ ] 2.2 创建货币转换辅助函数（用于汇率转换）

## 3. API 服务层
- [ ] 3.1 创建商品 API 服务文件（frontend/src/services/productApi.ts）
  - getProducts() 函数：从后端获取商品列表
  - 错误处理逻辑
- [ ] 3.2 配置 API 基础 URL（环境变量）

## 4. 核心组件开发
- [ ] 4.1 创建 ProductCard 组件（frontend/src/components/ProductDisplay/ProductCard.tsx）
  - 显示商品名称、描述、价格、图片
  - 响应式设计支持
- [ ] 4.2 创建 CurrencyToggle 组件（frontend/src/components/ProductDisplay/CurrencyToggle.tsx）
  - CNY/USD 切换按钮
  - 本地存储记住用户偏好
- [ ] 4.3 创建 LoadingSpinner 组件（frontend/src/components/ProductDisplay/LoadingSpinner.tsx）
  - 加载状态指示器

## 5. 页面组件开发
- [ ] 5.1 创建 ProductDisplay 页面组件（frontend/src/components/ProductDisplay/ProductDisplay.tsx）
  - 加载商品数据
  - 渲染商品列表
  - 集成 CurrencyToggle 组件
  - 错误状态处理
  - 空状态提示
- [ ] 5.2 创建 ProductDetail 页面组件（frontend/src/components/ProductDisplay/ProductDetail.tsx）
  - 商品详情展示
  - 返回按钮
  - "立即购买"按钮（预留链接）

## 6. 路由配置
- [ ] 6.1 安装并配置 React Router
- [ ] 6.2 更新 App.tsx 配置路由
  - `/` → ProductDisplay 页面
  - `/product/:id` → ProductDetail 页面
- [ ] 6.3 测试路由跳转是否正常

## 7. 样式和响应式设计
- [ ] 7.1 使用 Tailwind CSS 实现响应式布局
  - 移动端：单列布局
  - 桌面端：3-4 列网格布局
- [ ] 7.2 优化商品卡片样式
- [ ] 7.3 优化货币切换按钮样式
- [ ] 7.4 优化加载和错误状态样式

## 8. 测试和验证
- [ ] 8.1 创建模拟数据（mock）用于本地开发测试
- [ ] 8.2 测试商品列表显示
- [ ] 8.3 测试货币切换功能
- [ ] 8.4 测试商品详情页面
- [ ] 8.5 测试路由跳转
- [ ] 8.6 测试响应式设计（移动端/桌面端）
- [ ] 8.7 手动测试各种边界情况

## 9. 代码质量
- [ ] 9.1 运行 ESLint 检查，确保无代码风格问题
- [ ] 9.2 添加必要的 TypeScript 类型检查
- [ ] 9.3 添加组件和函数的注释说明

## 10. 文档和总结
- [ ] 10.1 更新 README.md，添加商品展示页面的使用说明
- [ ] 10.2 创建组件使用示例文档
