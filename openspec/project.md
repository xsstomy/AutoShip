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
