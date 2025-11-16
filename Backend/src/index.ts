import dotenvFlow from 'dotenv-flow'

// 1. 加载不同环境的 .env 文件
dotenvFlow.config({
  // silent: true, // 不想看到没有文件的 warning 可以打开这一行
})

console.log('👀 当前 NODE_ENV =', process.env.NODE_ENV || 'development')

// 2. 启动时验证必需的环境变量
if (!process.env.JWT_SECRET) {
  console.error('❌ 严重错误: JWT_SECRET 环境变量未配置!')
  console.error('请在 .env.development / .env.production 文件中设置 JWT_SECRET=你的密钥_至少64个字符')
  process.exit(1)
}

import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import checkoutRoutes from './routes/checkout'
import orderRoutes from './routes/orders'
import webhookRoutes from './routes/webhooks'
import adminAuthRoutes from './routes/admin-auth'
import adminProductRoutes from './routes/admin-products'
import adminInventoryRoutes from './routes/admin-inventory'
import adminOrderRoutes from './routes/admin-orders'
import productRoutes from './routes/products'
import { initDatabase } from './db'

const app = new Hono()

// 🔐 CORS middleware
// 不同环境用不同的 FRONTEND_URL：
// - 开发：http://localhost:5173
// - 生产：https://shop.cxgjjw.com
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
console.log('✅ 允许的前端来源 FRONTEND_URL =', FRONTEND_URL)

app.use(
  '/api/*',
  cors({
    origin: FRONTEND_URL,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  }),
)

// Basic routes
app.get('/', (c) => c.text('AutoShip API is running'))
app.get('/api/health', (c) => c.json({ status: 'ok' }))

// API routes
app.route('/api/v1/checkout', checkoutRoutes)
app.route('/api/v1/orders', orderRoutes)
app.route('/api/v1/products', productRoutes)

// Webhook routes (without /api prefix for third-party integrations)
app.route('/webhooks', webhookRoutes)

// Admin routes
app.route('/api/v1/admin/auth', adminAuthRoutes)
app.route('/api/v1/admin', adminProductRoutes)
app.route('/api/v1/admin', adminInventoryRoutes)
app.route('/api/v1/admin', adminOrderRoutes)

// Initialize database
console.log('Initializing database...')
initDatabase()

const port = Number(process.env.PORT) || 3100

console.log(`Server starting on port ${port}...`)

serve({
  fetch: app.fetch,
  port,
})
