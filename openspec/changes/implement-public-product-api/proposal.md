# implement-public-product-api Proposal

## Summary

创建公共产品API，让前端商品展示组件能够从后端获取真实的商品数据，而不是依赖模拟数据。

## Problem Statement

当前前端商品展示页面存在以下问题：
1. 使用模拟数据而不是真实的数据库商品信息
2. 缺少公共API接口供前端访问商品数据
3. 产品展示与管理后台产品管理不同步
4. 前端类型定义与后端数据结构不匹配

## Proposed Solution

### 1. 创建公共产品API路由
- 新增 `/api/v1/products` 公共路由
- 提供获取激活商品列表和详情的接口
- 无需管理员认证即可访问

### 2. 前端API适配
- 更新前端 `productApi.ts` 以调用真实的后端API
- 移除对模拟数据的依赖
- 适配后端返回的数据结构

### 3. 类型系统统一
- 更新前端产品类型定义以匹配后端数据结构
- 支持多价格货币、库存状态等后端特性

## Scope

### In Scope
- 公共产品API开发（列表和详情接口）
- 前端API客户端更新
- 类型定义同步
- 错误处理和加载状态

### Out of Scope
- 管理后台产品管理功能
- 产品搜索和筛选功能
- 产品图片上传
- 库存扣减逻辑

## Architecture Impact

### Backend Changes
- 新增公共产品路由模块
- 复用现有的 `productService` 和 `inventoryService`
- 添加必要的数据转换和过滤

### Frontend Changes
- 更新 API 客户端配置
- 修改产品显示组件以适配新数据结构
- 增强错误处理和用户体验

## Success Criteria

1. ✅ 前端商品展示页面显示数据库中的真实商品数据
2. ✅ API响应时间小于500ms
3. ✅ 支持多货币价格显示（CNY/USD）
4. ✅ 显示商品库存状态
5. ✅ 错误处理和加载状态正常工作
6. ✅ 与现有管理员产品管理保持数据同步

## Implementation Timeline

估计 1-2 天完成：
- 后端API开发：0.5天
- 前端适配：0.5天
- 测试和优化：0.5-1天

## Dependencies

- 无外部依赖
- 需要数据库中存在商品数据
- 需要现有的产品管理功能正常工作

## Risk Assessment

**低风险**变更：
- 复用现有服务，风险较低
- 向后兼容，不影响现有功能
- 可逐步部署和测试

## Alternatives Considered

1. **直接使用管理员API**：需要认证，不适合公共访问
2. **GraphQL**：过度工程化，当前场景不需要
3. **静态文件生成**：无法保证数据实时性

## Decision

采用**公共REST API**方案，简单可靠且符合项目现有架构模式。