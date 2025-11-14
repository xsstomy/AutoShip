# Project Context

## Purpose

AutoShip is an automated digital goods delivery system that supports multiple payment gateways and automatic fulfillment. The project enables businesses to sell digital products (license keys, download links, activation codes, etc.) with complete automation - from payment processing to product delivery via email.

**Core Business Flow:**
1. User selects product and places order
2. System creates pending order and redirects to payment gateway
3. Payment gateway processes payment and sends webhook callback
4. System validates signature and updates order status to 'paid'
5. System automatically delivers product via email (text content or signed download link)
6. User receives email with order details and delivered content

**MVP Goals:**
- Support for one main product with multi-currency pricing (CNY/USD)
- Dual payment gateway support (Alipay primary, Creem backup)
- Automated text-based delivery (license keys, download links, or plain text)
- Download links with expiration (72 hours) and download limits (3 attempts max)
- Email notifications via Resend service
- Admin panel for inventory management, order viewing, and resending emails
- Webhook signature validation with idempotency guarantees

## Tech Stack

### Frontend
- **React 19.2.0** - Modern React with hooks and concurrent features
- **Vite 7.2.2** - Lightning-fast build tool and dev server
- **TypeScript 5.9.3** - Type-safe JavaScript
- **Tailwind CSS 4.1.17** - Utility-first CSS framework
- **ESLint 9.39.1** - Code linting with React plugins

### Backend
- **Hono 4.10.5** - Lightweight, ultrafast web framework (similar to Express but faster)
- **TypeScript 5.9.3** - Type-safe server-side development
- **Drizzle ORM 0.44.7** - Type-safe ORM with zero runtime
- **Better-SQLite3 12.4.1** - SQLite database driver for Node.js
- **Zod 4.1.12** - Schema validation and runtime type checking
- **@hono/node-server 1.19.6** - Node.js adapter for Hono

### Database
- **Primary:** Cloudflare D1 (SQLite-compatible) for serverless deployment
- **Local:** SQLite with better-sqlite3 driver
- **Schema:** 8 core tables (products, orders, deliveries, downloads, etc.)

### External Services
- **Payment Gateways:** Alipay (RSA2 signature), Creem (API key)
- **Email Service:** Resend API for transactional emails
- **Deployment:** Cloudflare Workers (serverless) or VPS (Node.js)

### Development Tools
- **tsx 4.20.6** - TypeScript execution engine for development
- **@typescript-eslint** - TypeScript-aware linting
- **PostCSS & Autoprefixer** - CSS processing

### Project Structure
```
AutoShip/
├── frontend/          # React + Vite app (port 5173)
│   └── src/
│       ├── components/  # Reusable UI components
│       ├── pages/       # Route pages
│       ├── hooks/       # Custom React hooks
│       ├── utils/       # Helper functions
│       └── types/       # TypeScript types
│
└── Backend/           # Hono API server (port 3000)
    └── src/
        ├── routes/      # API route handlers
        ├── db/          # Database schema and connection
        ├── middleware/  # Custom middleware
        ├── types/       # TypeScript types
        └── utils/       # Helper functions
```

## Project Conventions

### Code Style

#### TypeScript Configuration
- **Frontend:** ESNext modules, React JSX, strict mode enabled
- **Backend:** CommonJS modules (compatibility with better-sqlite3), strict mode enabled

#### Naming Conventions
- **Files:** kebab-case for files (`order-service.ts`, `payment-webhook.ts`)
- **Variables & Functions:** camelCase (`getOrderById`, `createDelivery`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_DOWNLOADS`, `DEFAULT_GATEWAY`)
- **Database Columns:** snake_case (`created_at`, `gateway_order_id`)
- **Types & Interfaces:** PascalCase with descriptive names (`OrderStatus`, `DeliveryRecord`)

#### Code Organization
- **Backend Routes:** RESTful endpoints grouped by domain
  - `routes/checkout.ts` - Order creation and payment initiation
  - `routes/webhooks.ts` - Payment gateway callbacks
  - `routes/orders.ts` - Order retrieval and management
  - `routes/admin.ts` - Admin panel operations
- **Database Schema:** Single schema file with all table definitions
- **Utils:** Shared helper functions (validation, formatting, crypto)

#### TypeScript Patterns
- Use interfaces for API responses and database records
- Use Zod schemas for runtime validation of external data (webhooks, request bodies)
- Strict type checking enabled (`strict: true`)
- Prefer explicit return types for public functions

### Architecture Patterns

#### API Design
- **RESTful endpoints** with clear HTTP verbs (GET, POST, PUT, DELETE)
- **Consistent response format:** `{ success: boolean, data?: any, error?: string }`
- **Versioned routes:** `/api/v1/...` for future compatibility
- **Idempotency:** Webhook handlers check `payments_raw` table to prevent duplicate processing

#### Database Pattern
- **Drizzle ORM** for type-safe queries with SQLfluent syntax
- **Better-sqlite3** for synchronous, high-performance database access
- **Connection-per-request** pattern (not connection pooling for simplicity)
- **Explicit foreign key relationships** with cascading disabled
- **All timestamps stored in UTC** (DATETIME DEFAULT CURRENT_TIMESTAMP)

#### State Management
- **Frontend:** React Context API or useState/useReducer (no Redux for MVP)
- **No global state** - component-level state with prop drilling acceptable
- **Server-side sessions** not required (stateless design)

#### Error Handling
- **Frontend:** Try-catch with user-friendly error messages
- **Backend:** Hono's built-in error handling with custom error classes
- **Validation errors:** Return 400 with detailed field errors
- **Server errors:** Return 500 with error ID (for debugging)
- **All errors logged** to console (add proper logging in production)

### Testing Strategy

#### Current Status
- **No testing framework configured yet** (MVP priority is functionality)
- **Planned:** Jest for unit tests, React Testing Library for component tests

#### Planned Testing Approach
1. **Unit Tests ( Jest + Vitest)**
   - Database operations (order creation, status updates)
   - Utility functions (signature validation, token generation)
   - Business logic (delivery logic, inventory deduction)

2. **Integration Tests**
   - API endpoint testing with supertest
   - Webhook validation with mock payment gateway data
   - Email sending via Resend API

3. **E2E Tests ( Playwright or Cypress)**
   - Complete purchase flow (product selection → payment → delivery)
   - Download link functionality (signature, expiration, limits)
   - Admin panel operations (inventory import, order management)

#### Test Coverage Goals
- **Critical paths:** 90%+ coverage (payment flow, delivery logic)
- **Utility functions:** 100% coverage
- **API routes:** 80%+ coverage (happy path + error scenarios)

### Git Workflow

#### Branch Strategy
- **Main branch:** Production-ready code
- **Feature branches:** `feature/<short-description>` (e.g., `feature/payment-webhook`)
- **Bugfix branches:** `bugfix/<issue-number>` (e.g., `bugfix/delivery-123`)
- **No long-lived branches** - merge and delete after PR review

#### Commit Conventions
**Format:** `<type>(<scope>): <subject>`

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic changes)
- `refactor`: Code refactoring without feature changes
- `test`: Adding or updating tests
- `chore`: Build process, dependency updates

**Examples:**
```
feat(orders): add order status filtering in admin panel
fix(webhooks): resolve duplicate processing on Alipay callback
docs(api): document webhook signature validation process
test(delivery): add unit tests for download link generation
```

#### Pull Request Process
1. Create feature branch from main
2. Implement feature with tests
3. Ensure `npm run build` succeeds for both frontend and backend
4. Open PR with clear description and checklist
5. At least one code review required before merge
6. Squash and merge to maintain clean history

## Domain Context

### Digital Goods Delivery
**Three delivery types supported:**
1. **Text Content** - Direct text in email (license keys, activation codes)
2. **Download Link** - Signed URL to downloadable file (software, media)
3. **Hybrid** - Both text content AND download link

**Inventory Management:**
- Primary: Deduct from `inventory_text` table (pool of pre-defined content)
- Fallback: Use product's `template_text` if inventory exhausted
- Track usage: Mark inventory items as used with order reference

### Payment Processing
**Alipay Integration:**
- Uses RSA2 (SHA256 with RSA) signature verification
- Asynchronous notification via webhook URL
- Supports both sandbox (testing) and production environments
- Status mapping: TRADE_SUCCESS/FINISHED → paid, TRADE_CLOSED → failed/refunded

**Creem Integration:**
- API key authentication
- Webhook with secret validation
- Simpler callback format than Alipay
- Status mapping: payment_succeeded → paid, others → failed

**Webhook Security:**
- Signature verification is MANDATORY before processing
- All webhook payloads saved to `payments_raw` table for audit trail
- Idempotency: Check if gateway_order_id already processed
- Amount validation: Ensure webhook amount matches order amount exactly

### Download Link Security
- **Token generation:** Cryptographically random tokens
- **Expiration:** 72 hours from creation (configurable)
- **Download limit:** 3 attempts per link (configurable)
- **Download tracking:** Log IP address, user agent, timestamp to `downloads` table
- **Validation:** Check token validity, expiration, download count on each access

### Email Delivery
**Service:** Resend API (transactional email provider)
**Template:** HTML email with:
- Order ID
- Product name
- Delivered content (text) or download button
- Customer support information

**Email Categories:**
1. Order confirmation with payment instructions (if applicable)
2. Delivery notification with product content
3. Refund confirmation
4. Download links reminder (optional)

### Order State Machine
```
pending → paid → delivered
    ↓       ↓
 failed   refunded
    ↓
 cancelled
```

**State Transitions:**
- `pending` → `paid`: Payment webhook validated
- `paid` → `delivered`: Automatic after email sent
- `pending` → `failed`: Payment failed/timeout
- `paid` → `refunded`: Manual refund initiated
- `paid` → `cancelled`: Rare, admin manual intervention

## 代码质量规范与最佳实践

### 最新审查结果 (2025-11-14)

经过全面的代码审查，发现并修复了多个关键问题。以下是错误规范和最佳实践的总结：

### 一、已修复的关键问题

#### 1. N+1 查询性能优化 ✅
**问题描述：** 获取商品列表时存在 N+1 查询问题，性能严重下降

**修复方案：**
- **产品列表查询优化：** `src/services/product-service.ts:72-110`
  - 新增 `getActiveProductsWithDetails()` 方法
  - 使用 LEFT JOIN 一次性获取产品和价格信息
  - 从 1 + 2N 次查询优化为 1 + N 次查询（性能提升 50%+）

- **库存统计优化：** `src/services/inventory-service.ts:153-180`
  - 改进 `getInventoryStats()` 方法
  - 使用单次聚合查询获取所有统计数据（总数、已用、可用、过期）
  - 从 4 次查询优化为 1 次查询

- **产品查询优化：** `src/services/product-service.ts:115-215`
  - 为 `queryProducts()` 添加 `includePrices` 参数
  - 支持在一次查询中包含价格信息
  - 避免管理员页面的额外查询

**性能对比：**
- **优化前：** 获取 100 个商品 = 201 次查询
- **优化后：** 获取 100 个商品 = 101 次查询
- **提升：** 性能提升 50%+，数据库负载显著降低

**使用示例：**
```typescript
// 推荐：使用优化的查询方法
const products = await productService.getActiveProductsWithDetails()

// 管理员页面：传递 includePrices 参数
const productsResult = await productService.queryProducts(query, true)
```

#### 2. 统一错误处理模式 ✅
**问题描述：** API 响应格式不统一，部分返回简单字符串，部分返回对象

**修复方案：**
- **创建统一响应工具：** `src/utils/response.ts`
  - 定义标准响应格式：`{ success: boolean, data/error: object }`
  - 预定义常用错误类型：UNAUTHORIZED、NOT_FOUND、INTERNAL_ERROR 等
  - 提供 `asyncHandler` 中件自动捕获错误

- **标准化响应示例：**
```typescript
// 成功响应
return successResponse(c, {
  products: productsWithInventory,
  total: productsWithInventory.length,
})

// 错误响应
return errors.PRODUCT_NOT_FOUND(c)
return errors.INTERNAL_ERROR(c, '获取商品列表失败')
```

**已更新的文件：**
- `src/routes/products.ts`
- `src/routes/admin-products.ts`
- `src/middleware/admin-jwt-auth.ts`

#### 3. Cookie 解析安全加固 ✅
**问题描述：** 使用脆弱的正则表达式解析 Cookie，存在安全风险

**修复方案：**
- **安装依赖：** `npm install cookie`
- **使用专业库：** `src/middleware/admin-jwt-auth.ts:2`
  - 导入 `parse` 函数替代正则表达式
  - 安全解析 Cookie，防止注入攻击

**代码对比：**
```typescript
// 不安全的实现（修复前）
token = c.req.header('cookie')?.match(/admin_token=([^;]+)/)?.[1]

// 安全的实现（修复后）
const cookieHeader = c.req.header('cookie')
if (cookieHeader) {
  const cookies = parse(cookieHeader)
  token = cookies.admin_token
}
```

**安全改进：**
- 防止 Cookie 注入攻击
- 正确解析包含特殊字符的 Cookie 值
- 避免正则表达式相关的漏洞

### 二、需要关注的其他问题（优先级）

#### Critical（严重）- 需立即处理

1. **生产环境敏感信息泄露**
   - 位置：`/Backend/.env`
   - 问题：包含真实的支付宝私钥、公钥和应用 ID
   - 解决方案：
     - 立即移除 `.env` 文件中的真实密钥
     - 使用环境变量或密钥管理服务（AWS Secrets Manager）
     - 将 `.env` 添加到 `.gitignore`

2. **缺乏自动化测试覆盖**
   - 位置：整个项目
   - 问题：仅有 `test-auth.js` 和 `test-payment-gateway.ts` 两个手动测试脚本
   - 解决方案：
     - 使用 Jest 或 Vitest 建立单元测试框架
     - 优先测试关键业务逻辑：商品管理、订单处理、认证授权、支付网关

3. **生产环境硬编码密钥**
   - 位置：`src/utils/auth.ts:9`
   - 问题：`JWT_SECRET` 有默认后备值 `'your-secret-key-change-in-production'`
   - 解决方案：
     - 添加启动时检查，确保 JWT_SECRET 已设置
     - 如果未设置，直接抛出错误并退出

#### High（高）- 1-2周内处理

4. **缺少 API 速率限制**
   - 位置：`src/index.ts` 及所有路由
   - 问题：公开 API 没有速率限制保护
   - 解决方案：
     - 使用 `rate-limiter-flexible` 或 `express-rate-limit`
     - 为不同 API 端点设置不同限制

5. **数据库连接未设置最大连接数**
   - 位置：`src/db/index.ts:11`
   - 问题：SQLite 配置了 WAL 模式但未限制并发连接
   - 解决方案：
     - 设置连接限制：`new Database(DATABASE_URL, { max: 10 })`
     - 考虑为生产环境使用 PostgreSQL

6. **代码重复**
   - 位置：`src/routes/products.ts:19-29`、`src/routes/admin-products.ts:562-572`
   - 问题：`getInventoryStatus` 函数重复实现
   - 解决方案：
     - 创建公共工具函数：`src/utils/inventory.ts`
     - 统一管理所有库存相关逻辑

#### Medium（中）- 近期处理

7. **ESLint 配置缺失**
   - 位置：`package.json:31-33`
   - 问题：ESLint 依赖已安装但无配置文件
   - 解决方案：创建 `.eslintrc.json` 配置并设置 pre-commit hook

8. **缺少 API 文档**
   - 位置：`/Backend/docs/API.md`
   - 解决方案：使用 OpenAPI/Swagger 生成文档并集成到部署流程

### 三、最佳实践指南

#### 数据库查询最佳实践

1. **避免 N+1 查询**
   - 使用 JOIN 查询一次性获取关联数据
   - 对大数据量操作使用批量查询
   - 使用聚合查询获取统计数据

2. **优化查询性能**
   - 为常用查询字段添加索引
   - 使用分页避免一次加载大量数据
   - 在 Service 层封装复杂查询逻辑

3. **事务管理**
   - 多步骤操作使用事务保证数据一致性
   - 使用 Drizzle ORM 的 `withTransaction` 辅助函数

#### 错误处理最佳实践

1. **统一响应格式**
   - 所有 API 使用相同的成功/错误响应结构
   - 使用预定义错误类型便于前端处理
   - 错误消息应用户友好，避免暴露内部实现

2. **错误分类**
   - 4xx：客户端错误（参数错误、认证失败、权限不足）
   - 5xx：服务器错误（数据库错误、外部服务错误）

3. **日志记录**
   - 所有错误必须记录日志
   - 生产环境使用结构化日志（Winston、Pino）
   - 集成错误监控服务（Sentry）

#### 安全最佳实践

1. **认证安全**
   - JWT 密钥必须从环境变量获取，不能有默认后备值
   - Cookie 设置安全属性：httpOnly、secure、sameSite
   - 使用专业库解析 Cookie，不使用正则表达式

2. **数据验证**
   - 所有外部输入必须使用 Zod 验证
   - 数据库操作前验证参数类型和范围
   - 防止 SQL 注入和 XSS 攻击

3. **敏感信息**
   - 生产密钥绝不能提交到代码仓库
   - 使用环境变量管理配置
   - 定期轮换 API 密钥和证书

#### 代码质量最佳实践

1. **代码组织**
   - 公共工具函数提取到 `utils/` 目录
   - 保持 Service 层和 Route 层职责分离
   - 使用依赖注入管理服务实例

2. **类型安全**
   - 启用 TypeScript 严格模式
   - 为所有公共函数定义返回类型
   - 使用接口定义 API 响应格式

3. **测试覆盖**
   - 关键业务逻辑必须有单元测试
   - API 路由需要集成测试
   - 设置代码覆盖率要求（最低 80%）

### 四、优先修复路线图

#### 立即处理（本周内）
1. 移除 `.env` 文件中的生产密钥
2. 添加 JWT 密钥启动时检查
3. 为关键 API 添加速率限制

#### 短期（2周内）
1. 建立基础测试套件（Jest/Vitest）
2. 修复代码重复问题
3. 添加 ESLint 配置

#### 中期（1个月内）
1. 完善测试覆盖率到 80%+
2. 添加 API 文档（OpenAPI）
3. 实施监控和日志系统
4. 配置数据库连接池

### 五、监控与维护

1. **性能监控**
   - 跟踪 API 响应时间
   - 监控数据库查询性能
   - 设置告警阈值

2. **错误监控**
   - 使用 Sentry 或类似工具
   - 跟踪错误率和类型
   - 定期审查错误日志

3. **安全审计**
   - 定期检查依赖漏洞（npm audit）
   - 审查 API 安全漏洞
   - 更新安全补丁

## Important Constraints

### Technical Constraints
1. **SQLite/D1 Limitation:** No advanced features (stored procedures, complex joins)
2. **Single Database:** No read replicas, single write connection
3. **Stateless Design:** No server-side sessions (uses URLs/tokens for tracking)
4. **No User Accounts:** Guest checkout only (no user management system)
5. **Concurrency:** SQLite write locks limit concurrent write operations (< 10 concurrent)

### Business Constraints
1. **Single Product MVP:** Only one active product at a time
2. **Full Refunds Only:** Partial refunds not supported
3. **No Inventory Reservations:** First payment wins, no pre-ordering
4. **Email-Only Communication:** No SMS, no in-app notifications
5. **No User Portal:** No login/dashboard for customers

### Security Constraints
1. **Webhook Signature Validation:** ALL payment callbacks MUST be validated
2. **No PII Storage:** Only store email, order data (no personal details)
3. **HTTPS Required:** All production traffic must be encrypted
4. **Admin Access:** Secret key required for admin endpoints (no OAuth for MVP)
5. **Download Token Security:** Token must be cryptographically random (min 32 chars)

### Performance Constraints
1. **< 100 QPS:** Design for low-to-moderate traffic
2. **Cold Start Friendly:** Serverless deployment (Cloudflare Workers)
3. **No Real-time Updates:** WebSocket/SSE not required for MVP
4. **Simple Caching:** In-memory caching acceptable (no Redis)

### Deployment Constraints
1. **Dual Deployment:** Must support both Cloudflare Workers and VPS
2. **Environment Variables:** All configuration via environment variables
3. **No Persistent Local Storage:** For Workers, use D1; for VPS, use SQLite file
4. **Graceful Degradation:** System works if external service temporarily unavailable

## External Dependencies

### Payment Gateways
1. **Alipay Open Platform**
   - **Purpose:** Primary payment processor
   - **API:** REST API with RSA2 signature
   - **Documentation:** https://opendocs.alipay.com/
   - **Critical:** Webhook signature validation required
   - **Rate Limits:** Varies by account level

2. **Creem**
   - **Purpose:** Backup payment processor
   - **API:** REST API with API key authentication
   - **Documentation:** Creem developer docs
   - **Critical:** Webhook secret validation

### Email Service
3. **Resend**
   - **Purpose:** Transactional email delivery
   - **API:** REST API with API key
   - **Documentation:** https://resend.com/docs
   - **Usage:** Order confirmations, delivery notifications, refunds
   - **Rate Limits:** Based on plan (free tier: 100 emails/day)

### Database Services
4. **Cloudflare D1**
   - **Purpose:** Serverless SQLite database for Workers
   - **Type:** Managed SQLite with HTTP API
   - **Limits:** 25 databases per account (free)
   - **Alternative:** SQLite file on VPS

### Deployment Platforms
5. **Cloudflare Workers**
   - **Purpose:** Serverless backend deployment
   - **Limits:** 100k requests/day (free)
   - **Alternative:** Node.js VPS with Express/Fastify

6. **Cloudflare Pages** (optional)
   - **Purpose:** Static frontend hosting
   - **Alternative:** Vercel, Netlify, or any static host

### Development & Build Tools
7. **Vite**
   - **Purpose:** Frontend build tool and dev server
   - **Hot Module Replacement:** Yes
   - **Build Target:** Modern browsers (ES2020+)

8. **Drizzle ORM**
   - **Purpose:** Type-safe database ORM
   - **Migration:** Schema-based (no ORM migrations)
   - **Type Safety:** Compile-time checks

### Monitoring & Observability (Planned)
9. **Sentry** (recommended for production)
   - **Purpose:** Error tracking and performance monitoring
   - **Integration:** Both frontend and backend
   - **Alternative:** Custom logging with log aggregation service

10. **Upstash Redis** (if caching needed)
    - **Purpose:** Rate limiting, session storage
    - **Alternative:** Simple in-memory Map (not recommended for production)

### API Documentation
11. **OpenAPI/Swagger** (planned)
    - **Purpose:** Generate API documentation
    - **Format:** YAML specification
    - **Auto-generation:** From route handlers and Zod schemas

### Backup & Disaster Recovery
12. **Database Backup**
    - **Cloudflare D1:** Automatic backups via Cloudflare
    - **SQLite:** Manual backup required (cron job)
    - **Critical Data:** orders, deliveries, inventory_text tables

### Content Delivery (Optional for Large Files)
13. **Cloudflare R2** (if files > 10MB)
    - **Purpose:** Store downloadable files
    - **Alternative:** External CDN, cloud storage
    - **Note:** Not needed for MVP (text-based delivery)

### Third-Party Services (Future Considerations)
14. **Monitoring:** UptimeRobot, Pingdom for health checks
15. **Analytics:** Google Analytics for user behavior tracking
16. **Customer Support:** Intercom, Crisp for live chat
