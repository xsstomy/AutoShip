import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import checkoutRoutes from './routes/checkout'
import orderRoutes from './routes/orders'
import { initDatabase } from './db'

const app = new Hono()

// CORS middleware
app.use('/api/*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}))

// Basic routes
app.get('/', (c) => c.text('AutoShip API is running'))
app.get('/api/health', (c) => c.json({ status: 'ok' }))

// API routes
app.route('/api/v1/checkout', checkoutRoutes)
app.route('/api/v1/orders', orderRoutes)

// TODO: Add more routes
// - /api/webhooks/alipay - Alipay webhook
// - /api/webhooks/creem - Creem webhook
// - /api/admin/* - Admin routes

// Initialize database
console.log('Initializing database...')
initDatabase()

console.log('Server starting on port 3000...')

serve({
  fetch: app.fetch,
  port: 3000,
})
