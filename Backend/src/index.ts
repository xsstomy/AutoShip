import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/middleware/cors'

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

// TODO: Add routes
// - /api/checkout - Create order
// - /api/webhooks/alipay - Alipay webhook
// - /api/webhooks/creem - Creem webhook
// - /api/orders/:id - Get order details
// - /api/admin/* - Admin routes

console.log('Server starting on port 3000...')

serve({
  fetch: app.fetch,
  port: 3000,
})
