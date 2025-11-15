# 数据库驱动迁移技术规范

## 概述

本文档详细说明了从 better-sqlite3 迁移到 libsql 的技术规范，包括 API 变更、配置管理和最佳实践。

## ADDED Requirements

### Requirement: 数据库驱动替换
系统 SHALL 支持使用 libsql 作为数据库驱动替代 better-sqlite3，以实现更好的云原生支持和现代化特性。

#### Scenario: 本地文件系统模式
- **GIVEN** 应用程序使用 `file:./database.db` 作为数据库 URL
- **WHEN** 应用程序启动并连接到数据库
- **THEN** 系统使用 libsql 的本地文件系统模式，性能与 better-sqlite3 相当
- **AND** 所有现有功能正常工作，包括 CRUD 操作、事务和索引

#### Scenario: 远程服务器模式
- **GIVEN** 应用程序配置了远程 libsql 服务器 URL
- **WHEN** 应用程序启动并连接到远程数据库
- **THEN** 系统使用 libsql 的远程连接模式，支持分布式架构
- **AND** 应用程序可以处理网络延迟和连接重试
- **AND** 所有数据操作通过 TLS 加密传输

#### Scenario: 数据库初始化
- **GIVEN** 应用程序启动时
- **WHEN** 数据库连接建立
- **THEN** 系统执行必要的初始化操作
- **AND** WAL 模式在本地模式下正确启用
- **AND** 所有必要的表和索引存在

### Requirement: 数据库连接配置
系统 SHALL 支持灵活的配置选项，以适应不同的部署场景。

#### Scenario: 环境变量配置
- **GIVEN** 开发环境和生产环境
- **WHEN** 设置 `DATABASE_URL` 环境变量
- **THEN** 系统根据 URL 格式自动选择连接模式
- **AND** 本地模式：`file:./database.db`
- **AND** 远程模式：`libsql://host:port`
- **AND** HTTP 模式：`https://host/path`

#### Scenario: 认证配置
- **GIVEN** 远程 libsql 服务器需要认证
- **WHEN** 设置 `LIBSQL_AUTH_TOKEN` 环境变量
- **THEN** 系统使用认证令牌连接远程数据库
- **AND** 连接失败时返回明确错误信息

### Requirement: 数据迁移支持
系统 SHALL 确保现有数据可以安全迁移到新的数据库驱动。

#### Scenario: 数据备份
- **GIVEN** 存在现有的 SQLite 数据库文件
- **WHEN** 执行数据备份操作
- **THEN** 生成完整的 SQL dump 文件
- **AND** 备份文件包含所有表结构和数据

#### Scenario: 数据迁移验证
- **GIVEN** 完成数据迁移到 libsql
- **WHEN** 执行数据一致性验证
- **THEN** 所有表的记录数量匹配
- **AND** 所有索引和约束正确迁移
- **AND** 数据完整性检查通过

## MODIFIED Requirements

### Requirement: Drizzle ORM 查询兼容性
系统 SHALL 保持与现有 Drizzle ORM 查询的兼容性。

#### Scenario: 基础查询
- **GIVEN** 现有的 Drizzle ORM 查询代码
- **WHEN** 迁移到 libsql 驱动
- **THEN** 所有 SELECT、INSERT、UPDATE、DELETE 查询正常工作
- **AND** 查询结果格式保持不变
- **AND** 性能与之前相当

#### Scenario: JOIN 查询
- **GIVEN** 使用 JOIN 的复杂查询
- **WHEN** 执行多表关联查询
- **THEN** JOIN 操作返回正确结果
- **AND** 查询性能可接受
- **AND** 支持 LEFT JOIN、INNER JOIN、RIGHT JOIN

#### Scenario: 聚合查询
- **GIVEN** 使用 COUNT、SUM、AVG 等聚合函数
- **WHEN** 执行聚合查询
- **THEN** 聚合结果正确
- **AND** GROUP BY 和 HAVING 子句正常工作
- **AND** 性能优化索引有效

### Requirement: 事务处理
系统 SHALL 保持事务的 ACID 特性。

#### Scenario: 单表事务
- **GIVEN** 在单个表上执行多个操作
- **WHEN** 使用 withTransaction 包装操作
- **THEN** 所有操作在一个事务中执行
- **AND** 成功时所有更改持久化
- **AND** 失败时所有更改回滚

#### Scenario: 跨表事务
- **GIVEN** 在多个相关表上执行操作
- **WHEN** 执行复杂事务
- **THEN** 事务保持数据一致性
- **AND** 外键约束正确执行
- **AND** 嵌套事务处理正确

### Requirement: 原始 SQL 执行
系统 SHALL 支持原始 SQL 查询以处理复杂场景。

#### Scenario: 原始查询执行
- **GIVEN** 需要执行复杂的原始 SQL
- **WHEN** 使用 execute 方法
- **THEN** SQL 语句正确执行
- **AND** 参数化查询防止 SQL 注入
- **AND** 返回结果格式正确

#### Scenario: 批量操作
- **GIVEN** 需要批量插入多条记录
- **WHEN** 使用批量插入功能
- **THEN** 所有记录成功插入
- **AND** 事务一致性保持
- **AND** 性能优于逐个插入

### Requirement: 健康检查和监控
系统 SHALL 提供数据库健康状态监控。

#### Scenario: 连接健康检查
- **GIVEN** 应用程序运行中
- **WHEN** 执行 healthCheck 函数
- **THEN** 返回连接状态布尔值
- **AND** 连接失败时返回 false
- **AND** 成功时返回 true

#### Scenario: 性能监控
- **GIVEN** 应用程序运行
- **WHEN** 执行数据库操作
- **THEN** 记录查询执行时间
- **AND** 慢查询日志记录
- **AND** 错误日志完整

## REMOVED Requirements

### Requirement: 直接 Database 实例访问
应用程序 SHALL 不再直接访问 better-sqlite3 的 Database 实例。

#### Scenario: 代码重构
- **GIVEN** 现有代码直接使用 better-sqlite3
- **WHEN** 迁移到 libsql
- **THEN** 所有直接数据库实例访问被移除
- **AND** 替换为通过 drizzle-orm 或 libsql 客户端
- **AND** 代码简洁性和可维护性提高

### Requirement: PRAGMA 特定设置
某些 PRAGMA 设置在远程模式下 SHALL 不支持。

#### Scenario: 远程模式限制
- **GIVEN** 使用 libsql 远程服务器
- **WHEN** 尝试执行某些 PRAGMA 命令
- **THEN** 这些 PRAGMA 被忽略或返回错误
- **AND** 系统继续正常工作
- **AND** 警告日志记录不支持的 PRAGMA

### Requirement: 同步 API
某些同步 API SHALL 改为异步。

#### Scenario: 异步查询
- **GIVEN** 现有同步查询代码
- **WHEN** 迁移到 libsql
- **THEN** 所有查询改为异步执行
- **AND** await 关键字正确使用
- **AND** 错误处理使用 try-catch

## 性能和兼容性要求

### 性能基线
- 本地模式查询性能与 better-sqlite3 差异不超过 5%
- 批量插入性能提升或保持相当
- 事务吞吐量不低于现有水平
- 内存使用不显著增加

### 兼容性要求
- 100% SQL 语法兼容性
- 所有现有表结构无需修改
- 所有现有索引保持有效
- 迁移后功能完整性验证通过

### 稳定性要求
- 72小时连续运行无崩溃
- 连接池正确管理
- 错误恢复机制正常
- 监控和日志功能完整

## 当前架构分析

### 当前技术栈
- **数据库驱动**：better-sqlite3 v7.x
- **ORM**：drizzle-orm v0.44.7
- **连接方式**：本地文件系统
- **数据库位置**：`./database.db`

### 当前数据库使用模式
1. **直接 SQL 查询**
   ```typescript
   const sqlite = new Database(DATABASE_URL)
   sqlite.prepare(sql).all()
   ```

2. **Drizzle ORM 查询**
   ```typescript
   const db = drizzle(sqlite, { schema })
   const results = await db.select().from(schema.products)
   ```

3. **事务处理**
   ```typescript
   await db.transaction(callback)
   ```

## 目标架构

### 新技术栈
- **数据库驱动**：@libsql/client v0.x
- **ORM**：drizzle-orm v0.44.7（已有）
- **连接方式**：
  - 本地文件系统：`file:./database.db`
  - 远程服务器：`libsql://<host>:<port>`
  - HTTP 远程：`https://<host>`

### 连接模式对比

| 特性 | better-sqlite3 | libsql (本地) | libsql (远程) |
|------|----------------|---------------|---------------|
| 文件系统 | ✅ | ✅ | ❌ |
| 内存数据库 | ✅ | ✅ | ❌ |
| 远程连接 | ❌ | ❌ | ✅ |
| HTTP 协议 | ❌ | ❌ | ✅ |
| TLS 加密 | ❌ | ❌ | ✅ |
| 复制支持 | ❌ | ❌ | ✅ |
| 高可用 | ❌ | ❌ | ✅ |

## API 变更规范

### 变更 1：数据库导入

#### 当前代码
```typescript
import Database from 'better-sqlite3'
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
```

#### 新代码
```typescript
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
```

### 变更 2：数据库连接

#### 当前代码
```typescript
const DATABASE_URL = process.env.DATABASE_URL || './database.db'
const sqlite = new Database(DATABASE_URL)
export const db = drizzle(sqlite, { schema })
```

#### 新代码
```typescript
const DATABASE_URL = process.env.DATABASE_URL || 'file:./database.db'
const client = createClient({
  url: DATABASE_URL,
  // 可选：用于远程服务器
  authToken: process.env.LIBSQL_AUTH_TOKEN,
  // 可选：用于本地文件系统
  // url: 'file:./database.db'
})

export const db = drizzle(client, { schema })
```

### 变更 3：数据库配置

#### 环境变量配置
```env
# 本地文件系统模式（向后兼容）
DATABASE_URL=file:./database.db

# 远程服务器模式
DATABASE_URL=libsql://your-server.com:port
LIBSQL_AUTH_TOKEN=your-auth-token

# HTTP 远程模式
DATABASE_URL=https://your-server.com/path
LIBSQL_AUTH_TOKEN=your-auth-token
```

### 变更 4：数据库初始化

#### 需要修改的函数

1. **PRAGMA 配置**
   - 某些 PRAGMA 可能不支持或需要调整
   - libsql 远程模式下部分 PRAGMA 无效

   ```typescript
   // 当前代码
   sqlite.pragma('journal_mode = WAL')
   sqlite.pragma('synchronous = NORMAL')

   // 新代码 - 仅本地模式支持
   if (DATABASE_URL.startsWith('file:')) {
     client.execute('PRAGMA journal_mode = WAL')
     client.execute('PRAGMA synchronous = NORMAL')
   }
   ```

2. **原始 SQL 执行**
   ```typescript
   // 当前代码
   ;(db as any).execute = (sql: string, params?: any[]) => {
     try {
       const stmt = sqlite.prepare(sql)
       if (params) {
         return stmt.all(...params)
       }
       return stmt.all()
     } catch (error) {
       throw error
     }
   }

   // 新代码
   ;(db as any).execute = async (sql: string, params?: any[]) => {
     try {
       const result = await client.execute({
         sql,
         params: params || []
       })
       return result.rows
     } catch (error) {
       throw error
     }
   }
   ```

### 变更 5：事务处理

#### 当前代码
```typescript
export async function withTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
  return db.transaction(callback)
}
```

#### 新代码
```typescript
export async function withTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
  return db.transaction(callback)
}
// drizzle-orm 的事务 API 保持不变
```

### 变更 6：健康检查

#### 当前代码
```typescript
export async function healthCheck() {
  try {
    const result = sqlite.prepare('SELECT 1 as health').get()
    return result && (result as any).health === 1
  } catch (error) {
    console.error('Database health check failed:', error)
    return false
  }
}
```

#### 新代码
```typescript
export async function healthCheck() {
  try {
    const result = await client.execute('SELECT 1 as health')
    return result.rows.length > 0 && result.rows[0].health === 1
  } catch (error) {
    console.error('Database health check failed:', error)
    return false
  }
}
```

## 数据迁移规范

### 迁移步骤

1. **导出当前数据**
   ```bash
   # 使用 SQLite 命令行工具
   sqlite3 database.db ".dump" > backup.sql
   ```

2. **验证备份**
   ```bash
   # 检查备份文件
   head -20 backup.sql
   wc -l backup.sql
   ```

3. **导入到 libsql**
   ```typescript
   // 创建迁移脚本
   import { createClient } from '@libsql/client'
   import * as fs from 'fs'

   async function migrate() {
     const client = createClient({
       url: 'file:./database.db'
     })

     const sql = fs.readFileSync('backup.sql', 'utf8')
     await client.execute(sql)
     console.log('Migration completed')
   }
   ```

### 数据一致性验证

```typescript
async function validateData() {
  // 比较表数量
  const oldTables = await getTableCount(sqlite)
  const newTables = await getTableCount(client)

  // 比较记录数量
  for (const table of tables) {
    const oldCount = await getRecordCount(sqlite, table)
    const newCount = await getRecordCount(client, table)
    assert(oldCount === newCount, `Table ${table} count mismatch`)
  }
}
```

## 性能优化规范

### 本地模式优化

1. **PRAGMA 设置**
   ```typescript
   // 启用 WAL 模式（写优化）
   await client.execute('PRAGMA journal_mode = WAL')

   // 优化同步级别
   await client.execute('PRAGMA synchronous = NORMAL')

   // 增大缓存
   await client.execute('PRAGMA cache_size = 1000000')
   ```

2. **索引优化**
   ```sql
   -- 确保所有索引存在
   CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
   CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
   ```

### 远程模式优化

1. **连接池配置**
   ```typescript
   const client = createClient({
     url: DATABASE_URL,
     authToken: process.env.LIBSQL_AUTH_TOKEN,
     // 连接池大小
     // 注意：@libsql/client 默认使用连接池
   })
   ```

2. **批量操作**
   ```typescript
   // 批量插入比逐个插入快
   await db.insert(schema.table).values(items).returning()
   ```

3. **查询优化**
   ```typescript
   // 避免 N+1 查询
   const orders = await db.select({
     order: schema.orders,
     product: schema.products
   }).from(schema.orders)
     .leftJoin(schema.products, eq(schema.orders.productId, schema.products.id))
   ```

## 测试规范

### 单元测试

1. **连接测试**
   ```typescript
   describe('Database Connection', () => {
     it('should connect to libsql', async () => {
       const client = createClient({ url: 'file:./test.db' })
       const result = await client.execute('SELECT 1')
       expect(result.rows[0]['1']).toBe(1)
     })
   })
   ```

2. **CRUD 测试**
   ```typescript
   describe('Product Repository', () => {
     it('should create and retrieve product', async () => {
       const product = await productRepository.create({
         name: 'Test Product',
         description: 'Test',
         deliveryType: 'text'
       })
       expect(product.id).toBeDefined()

       const retrieved = await productRepository.findById(product.id)
       expect(retrieved?.name).toBe('Test Product')
     })
   })
   ```

### 集成测试

1. **事务测试**
   ```typescript
   it('should handle transaction rollback', async () => {
     try {
       await withTransaction(async (tx) => {
         await tx.insert(schema.products).values({ name: 'Test' })
         throw new Error('Intentional failure')
       })
     } catch (error) {
       // 验证回滚
       const products = await db.select().from(schema.products)
       expect(products.length).toBe(0)
     }
   })
   ```

### 性能测试

```typescript
describe('Performance Tests', () => {
  it('should handle 1000 inserts', async () => {
    const start = Date.now()
    const items = Array.from({ length: 1000 }, (_, i) => ({
      name: `Product ${i}`,
      deliveryType: 'text'
    }))
    await db.insert(schema.products).values(items)
    const duration = Date.now() - start
    expect(duration).toBeLessThan(5000) // 5秒内完成
  })
})
```

## 错误处理规范

### 连接错误
```typescript
try {
  const client = createClient({ url: DATABASE_URL })
  await client.execute('SELECT 1')
} catch (error) {
  if (error.message.includes('connection')) {
    throw new Error('Database connection failed')
  }
  throw error
}
```

### 查询错误
```typescript
try {
  const result = await db.select().from(schema.products)
  return successResponse(c, result)
} catch (error) {
  logger.error('Database query failed', { error })
  return errors.INTERNAL_ERROR(c, '查询失败')
}
```

## 监控规范

### 关键指标

1. **连接数**
   - 当前连接数
   - 连接池使用率

2. **查询性能**
   - 平均查询时间
   - 慢查询（>1秒）

3. **错误率**
   - 连接错误率
   - 查询错误率

### 监控代码示例

```typescript
import { createClient } from '@libsql/client'

const client = createClient({ url: DATABASE_URL })

// 添加监控中间件
const executeWithMonitoring = async (sql: string, params?: any[]) => {
  const start = Date.now()
  try {
    const result = await client.execute({ sql, params })
    const duration = Date.now() - start
    logger.info('Query executed', { sql, duration, rowCount: result.rows.length })
    return result
  } catch (error) {
    logger.error('Query failed', { sql, error })
    throw error
  }
}
```

## 最佳实践

### 1. 连接管理
- 使用连接池而不是单次连接
- 正确关闭连接（如果适用）
- 设置合理的超时时间

### 2. 查询优化
- 使用参数化查询防止 SQL 注入
- 利用索引优化查询性能
- 避免 SELECT *，只查询需要的字段

### 3. 事务管理
- 保持事务短小
- 合理使用事务隔离级别
- 处理事务失败和回滚

### 4. 错误处理
- 区分可重试和不可重试错误
- 记录详细错误日志
- 向用户返回友好错误信息

## 兼容性说明

### 向后兼容
- ✅ SQL 语法：100% 兼容
- ✅ 表结构：无需修改
- ✅ 索引：无需修改
- ✅ 视图：兼容（如果使用）
- ✅ 触发器：兼容（如果使用）

### 需要迁移的代码
- ❌ 数据库驱动导入
- ❌ 数据库连接初始化
- ❌ 原始 SQL 执行方式
- ❌ 某些 PRAGMA 设置
- ❌ 某些系统表查询

### 不支持的功能
- ⚠️ 某些 SQLite 扩展（如果使用）
- ⚠️ 自定义函数（如果定义）
- ⚠️ 虚拟表（如果使用）

## 部署清单

- [ ] 更新 package.json
- [ ] 更新 src/db/index.ts
- [ ] 更新环境变量配置
- [ ] 备份现有数据库
- [ ] 执行数据迁移
- [ ] 运行所有测试
- [ ] 性能测试
- [ ] 更新文档
- [ ] 团队培训
- [ ] 部署到生产
- [ ] 监控和告警配置

## 参考资源

- [libsql 官方文档](https://docs.libsql.com/)
- [Drizzle ORM libsql 适配](https://orm.drizzle.team/docs/quick-start)
- [SQLite 兼容性](https://www.sqlite.org/formatchng.html)
- [libsql vs SQLite 性能对比](https://github.com/libsql/libsql)
