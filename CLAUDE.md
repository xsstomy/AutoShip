<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# AI 助手开发指南

## 代码审查要点（必须检查）

当进行代码审查或修改时，必须关注以下关键问题：

### 🚨 Critical（严重）问题
1. **N+1 查询问题**
   - 检查：是否在循环中执行数据库查询
   - 修复：使用 JOIN 查询或批量查询
   - 工具：使用 `withTransaction` 优化事务

2. **错误处理不统一**
   - 检查：API 响应格式是否一致
   - 修复：使用 `src/utils/response.ts` 中的工具
   - 标准格式：`{ success: boolean, data/error: object }`
   - 使用 `errors.PRODUCT_NOT_FOUND(c)` 等预定义错误

3. **Cookie 解析安全问题**
   - 检查：是否使用正则表达式解析 Cookie
   - 修复：使用 `cookie` 库的 `parse()` 函数
   - 避免：`token = c.req.header('cookie')?.match(/admin_token=([^;]+)/)?.[1]`
   - 推荐：`const cookies = parse(cookieHeader); token = cookies.admin_token`

### ⚠️ 其他常见问题
4. **硬编码密钥** - JWT_SECRET 不能有默认后备值
5. **缺少速率限制** - 公开 API 必须添加 rate limiter
6. **代码重复** - 提取公共函数到 `utils/` 目录
7. **缺少测试** - 关键逻辑必须添加单元测试
8. **敏感信息泄露** - `.env` 文件不能提交到仓库

## 性能优化准则

### 数据库查询优化
```typescript
// ✅ 正确：使用 JOIN 避免 N+1
const result = await db
  .select({
    product: schema.products,
    price: schema.productPrices,
  })
  .from(schema.products)
  .leftJoin(schema.productPrices, ...)

// ❌ 错误：循环中查询（N+1）
const products = await db.select().from(schema.products)
const withDetails = await Promise.all(
  products.map(p => db.select().from(schema.productPrices).where(...))
)
```

### 库存统计优化
```typescript
// ✅ 正确：单次聚合查询
const result = await db
  .select({
    total: count(),
    used: count().filter(eq(...)),
    available: count().filter(and(...)),
  })
  .from(schema.inventoryText)
  .where(...)

// ❌ 错误：多次单独查询
const total = await db.select({ count: count() }).from(...)
const used = await db.select({ count: count() }).from(...)
// ... 重复4次
```

## 错误处理标准

### 使用统一响应工具
```typescript
import { successResponse, errors } from '../utils/response'

// 成功响应
return successResponse(c, { products, total })

// 错误响应
return errors.PRODUCT_NOT_FOUND(c)
return errors.INTERNAL_ERROR(c, '获取列表失败')
return errors.UNAUTHORIZED(c)
return errors.VALIDATION_ERROR(c, '参数错误', details)
```

### 预定义错误类型
- `UNAUTHORIZED` - 未登录（401）
- `INVALID_TOKEN` - Token 无效（401）
- `SESSION_EXPIRED` - 会话过期（401）
- `FORBIDDEN` - 无权限（403）
- `PRODUCT_NOT_FOUND` - 商品不存在（404）
- `PRODUCT_INACTIVE` - 商品已下架（409）
- `VALIDATION_ERROR` - 参数验证失败（422）
- `RATE_LIMIT_EXCEEDED` - 请求过于频繁（429）
- `INTERNAL_ERROR` - 服务器内部错误（500）

## 安全最佳实践

### 1. 认证安全
- JWT 密钥必须从环境变量获取：`process.env.JWT_SECRET`
- 启动时检查密钥是否存在，不存在则退出
- Cookie 设置安全属性：`HttpOnly`, `Secure`, `SameSite=Strict`

### 2. 数据验证
- 所有外部输入使用 Zod 验证
- 数据库操作前验证参数类型
- 使用类型守卫检查数据

### 3. 敏感信息
- 生产密钥不提交到代码仓库
- 使用 `.env.example` 记录需要的变量
- 定期轮换 API 密钥

## 代码组织规范

### 文件结构
```
src/
├── routes/          # API 路由（控制器）
├── services/        # 业务逻辑（Service 层）
├── db/             # 数据库 schema 和连接
├── middleware/     # 中间件
├── utils/          # 工具函数
│   ├── response.ts     # 统一响应格式
│   ├── auth.ts         # 认证相关
│   └── inventory.ts    # 库存相关
└── types/          # TypeScript 类型
```

### 公共函数提取
```typescript
// utils/inventory.ts
export function getInventoryStatus(count: number): string {
  if (count === 0) return '已售罄'
  if (count <= 9) return '库存紧张'
  if (count <= 50) return '库存偏低'
  return '库存充足'
}

// 在路由中使用
import { getInventoryStatus } from '../utils/inventory'
```

## 测试要求

### 最小测试覆盖
- 关键业务逻辑：100% 覆盖率
- 工具函数：100% 覆盖率
- API 路由：80% 覆盖率（包含错误场景）
- 数据库操作：事务逻辑必须测试

### 测试框架
- 后端：Jest 或 Vitest
- 前端：React Testing Library
- 集成测试：supertest（API）

## 开发工作流

### 1. 开始新功能前
- 创建 `feature/xxx` 分支
- 编写单元测试
- 运行 `npm run build` 确认编译通过

### 2. 提交前检查
- [ ] 代码格式正确（运行 prettier）
- [ ] ESLint 无警告
- [ ] 测试通过
- [ ] 类型检查通过
- [ ] 响应格式使用统一工具

### 3. PR 要求
- 清晰的提交信息：`feat(products): add inventory query`
- 包含测试
- 更新相关文档

## 常用代码片段

### 数据库查询
```typescript
// 分页查询
const page = Number(query.page) || 1
const limit = Number(query.limit) || 20
const offset = (page - 1) * limit

// 使用 Drizzle ORM
const result = await db.select()
  .from(schema.table)
  .where(condition)
  .limit(limit)
  .offset(offset)
```

### 事务处理
```typescript
return await withTransaction(async (tx) => {
  const order = await tx.insert(schema.orders).values(...).returning()
  await tx.update(schema.products).set(...).where(...)
  return order
})
```

### 错误捕获
```typescript
try {
  const result = await riskyOperation()
  return successResponse(c, result)
} catch (error) {
  console.error('Operation failed:', error)
  return errors.INTERNAL_ERROR(c, '操作失败')
}
```

## 监控与日志

### 生产环境必做
1. 集成错误监控（Sentry）
2. 添加结构化日志（Winston/Pino）
3. 设置 API 性能监控
4. 配置数据库连接池监控

### 日志最佳实践
```typescript
// 结构化日志
logger.info('Order created', {
  orderId: order.id,
  amount: order.amount,
  userId: order.userId
})

// 错误日志
logger.error('Payment failed', {
  error: error.message,
  stack: error.stack,
  orderId: order.id
})
```

---

**重要提醒**：以上规范基于 2025-11-14 的代码审查结果制定。更多详情请参考 `openspec/project.md` 中的完整文档。
- 每次修改代码之后，执行一下 npm run build 编译一下代码，如果有错误立即修复一下