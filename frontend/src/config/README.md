# API 配置说明

## 概述

本目录包含前端应用的统一配置文件，用于管理所有 API 相关的配置。

## 配置文件

### `api.ts`

统一管理所有 API URL 和超时配置。

#### 导出的配置项

| 配置项 | 说明 | 示例值 |
|--------|------|--------|
| `API_BASE_URL` | API 基础 URL | `http://localhost:3100` |
| `API_PREFIX` | API 路径前缀 | `/api/v1` |
| `API_FULL_URL` | 完整的 API 基础路径 | `http://localhost:3100/api/v1` |
| `ADMIN_API_URL` | 管理后台 API 路径 | `http://localhost:3100/api/v1/admin` |
| `API_TIMEOUT.DEFAULT` | 默认超时时间 | `10000` (10秒) |
| `API_TIMEOUT.LONG` | 长请求超时时间 | `30000` (30秒) |

#### 环境变量

配置优先从环境变量 `VITE_API_URL` 读取，如果未设置则使用默认值 `http://localhost:3100`。

在 `frontend/.env` 文件中配置：

```bash
VITE_API_URL=http://localhost:3100
```

## 使用方式

### 示例 1: 使用 Axios

```typescript
import axios from 'axios'
import { API_FULL_URL, API_TIMEOUT } from '../config/api'

const apiClient = axios.create({
  baseURL: API_FULL_URL,
  timeout: API_TIMEOUT.DEFAULT,
})
```

### 示例 2: 使用 Fetch

```typescript
import { API_FULL_URL } from '../config/api'

const response = await fetch(`${API_FULL_URL}/products`)
```

### 示例 3: 管理后台 API

```typescript
import { ADMIN_API_URL } from '../config/api'

const response = await fetch(`${ADMIN_API_URL}/orders`)
// 实际请求: http://localhost:3100/api/v1/admin/orders
```

## 已迁移的文件

以下文件已从分散的配置迁移到统一配置：

### Services
- ✅ `services/inventoryApi.ts` - 使用 `ADMIN_API_URL`
- ✅ `services/productApi.ts` - 使用 `API_FULL_URL`
- ✅ `services/checkoutApi.ts` - 使用 `API_FULL_URL`
- ✅ `services/orderApi.ts` - 使用 `API_FULL_URL`
- ✅ `services/orderAdminApi.ts` - 使用 `ADMIN_API_URL`

### Utils
- ✅ `utils/payment-api.ts` - 使用 `API_FULL_URL`

### Components
- ✅ `components/InventoryManagement/ImportInventoryModal.tsx` - 使用 `ADMIN_API_URL`
- ✅ `components/InventoryManagement/AddInventoryModal.tsx` - 使用 `ADMIN_API_URL`

## 最佳实践

### ✅ 推荐做法

```typescript
// 1. 从配置文件导入
import { API_FULL_URL } from '../config/api'

// 2. 使用导入的配置
const url = `${API_FULL_URL}/endpoint`
```

### ❌ 不推荐做法

```typescript
// 1. 不要在业务代码中直接使用环境变量
const url = import.meta.env.VITE_API_URL + '/api/v1/endpoint'

// 2. 不要硬编码 URL
const url = 'http://localhost:3100/api/v1/endpoint'

// 3. 不要在多个文件中重复定义
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3100'
```

## 部署配置

### 开发环境
```bash
VITE_API_URL=http://localhost:3100
```

### 生产环境
```bash
VITE_API_URL=https://api.yourdomain.com
```

## 注意事项

1. **修改配置后需要重启开发服务器**
   Vite 在启动时读取环境变量，修改 `.env` 文件后需要重启。

2. **环境变量必须以 `VITE_` 开头**
   只有以 `VITE_` 开头的环境变量才会被 Vite 暴露给客户端代码。

3. **不要提交敏感信息到代码仓库**
   生产环境的 API URL 应该在部署时通过环境变量注入，不要提交到 `.env` 文件。

4. **类型安全**
   所有配置都是常量，TypeScript 可以提供类型检查和自动补全。
