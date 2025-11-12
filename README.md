# AutoShip - 自动发货系统

一个支持多种数字商品（卡密、下载链接、许可证等）的自动发货型网站系统。

## 项目特性

- ✅ 多种数字商品自动发货（卡密、下载链接、许可证文本）
- ✅ 多支付网关支持（支付宝、Creem）
- ✅ 自动邮件通知
- ✅ 订单状态管理
- ✅ 下载链接签名、限次、限期
- ✅ 后台管理系统

## 技术栈

### 前端
- **React 19** + **Vite**
- **TypeScript**
- **Tailwind CSS 4**

### 后端
- **Hono** (轻量级Web框架)
- **TypeScript**
- **Drizzle ORM** + **SQLite/Cloudflare D1**
- **Better-SQLite3**

### 服务
- **支付宝** / **Creem** 支付
- **Resend** 邮件服务
- **Cloudflare D1** / **SQLite** 数据库

## 项目结构

```
AutoShip/
├── frontend/          # React前端
│   ├── src/
│   │   ├── components/  # 组件
│   │   ├── pages/       # 页面
│   │   └── ...
│   ├── public/          # 静态资源
│   └── ...
│
├── Backend/            # Hono后端
│   ├── src/
│   │   ├── routes/      # 路由
│   │   ├── db/          # 数据库
│   │   ├── middleware/  # 中间件
│   │   └── types/       # 类型定义
│   ├── schema.sql       # 数据库结构
│   └── ...
│
└── README.md
```

## 快速开始

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd AutoShip
```

### 2. 安装依赖

#### 前端
```bash
cd frontend
npm install
```

#### 后端
```bash
cd ../Backend
npm install
```

### 3. 配置环境变量

#### 后端
```bash
cd Backend
cp .env.example .env
# 编辑 .env 文件，填入必要的配置
```

#### 前端
```bash
cd ../frontend
cp .env.example .env
# 编辑 .env 文件，配置API地址
```

### 4. 初始化数据库

```bash
cd ../Backend
# SQLite
sqlite3 auto_ship.db < schema.sql

# 或 Cloudflare D1
# wrangler d1 execute auto_ship_db --file=schema.sql
```

### 5. 启动开发服务器

#### 启动后端（端口3000）
```bash
cd Backend
npm run dev
```

#### 启动前端（端口5173）
```bash
cd frontend
npm run dev
```

## 数据库设计

### 核心表

- **products** - 商品信息
- **product_prices** - 商品定价（多币种）
- **orders** - 订单记录
- **deliveries** - 发货记录
- **downloads** - 下载日志
- **payments_raw** - 支付回调日志
- **inventory_text** - 文本库存
- **settings** - 系统配置

## API 路由

### 主要端点

- `GET /` - 服务健康检查
- `POST /api/checkout` - 创建订单
- `GET /api/orders/:id` - 获取订单详情
- `POST /api/webhooks/alipay` - 支付宝回调
- `POST /api/webhooks/creem` - Creem回调
- `GET /api/download/:token` - 下载文件

### 后台管理

- `GET /api/admin/orders` - 订单列表
- `POST /api/admin/deliveries/:id/resend` - 重发邮件
- `POST /api/admin/orders/:id/refund` - 退款
- `POST /api/admin/inventory` - 导入库存

## 开发路线图

- [ ] 数据库结构建立 ✅
- [ ] 实现 `/api/checkout` 与 `/api/webhooks/*` ✅
- [ ] 实现发货逻辑与邮件通知
- [ ] 构建 React 前端（商品页、下单页、订单详情页）
- [ ] 接入支付宝真实回调（沙箱→生产）
- [ ] 后台管理（库存导入、订单查询、重发邮件）
- [ ] 上线测试与监控

## MVP 验收标准

- ✅ 能完成真实支付并自动发货
- ✅ 邮件中包含有效内容或下载链接
- ✅ 下载限时限次机制生效
- ✅ 后台可导入库存、查看订单、重发邮件
- ✅ Webhook 验签与幂等测试通过

## 部署

### Cloudflare Workers

#### 后端
```bash
# 构建
cd Backend
npm run build

# 部署到 Cloudflare
wrangler deploy
```

#### 前端
```bash
# 构建
cd frontend
npm run build

# 部署到 Cloudflare Pages
wrangler pages publish dist
```

### VPS

#### 后端
```bash
cd Backend
npm run build
npm start
```

#### 前端
```bash
cd frontend
npm run build
# 将 dist 目录部署到 Nginx 或其他 Web 服务器
```

## 配置说明

### 支付配置

#### 支付宝
- 申请支付宝开放平台账号
- 创建应用，获取 `APP_ID`
- 生成 RSA2 密钥对
- 配置回调地址

#### Creem
- 注册 Creem 开发者账号
- 获取 API Key
- 配置 Webhook Secret

### 邮件配置

- 注册 Resend 账号
- 获取 API Key
- 验证发送域名

## 安全注意事项

- Webhook 验签 + 幂等机制
- 订单金额与回调金额强校验
- 下载链接签名、限次、限期
- 后台入口隐藏 + 访问口令

## 贡献

欢迎提交 Pull Request 和 Issue！

## 许可证

MIT License
