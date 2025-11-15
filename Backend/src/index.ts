import * as dotenv from 'dotenv'
dotenv.config()

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
import testPaymentRoutes from './routes/test-payment'
import { initDatabase } from './db'

const app = new Hono()

// CORS middleware
app.use('/api/*', cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}))

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

// Test routes (仅开发环境使用)
app.route('/api/test', testPaymentRoutes)

// Initialize database
console.log('Initializing database...')
initDatabase()

const port = Number(process.env.PORT) || 3100

console.log(`Server starting on port ${port}...`)

serve({
  fetch: app.fetch,
  port: port,
})
