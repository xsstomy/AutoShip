import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { integratedSecurityService } from '../services/integrated-security-service'
import { adminAuth } from '../middleware/admin-jwt-auth'
import { rateLimitByIP, adminRateLimit } from '../middleware/rate-limit'
import { corsSecurity, adminCorsSecurity, securityHeaders } from '../middleware/cors-security'
import { requestLogging, adminRequestLogging } from '../middleware/request-logging'
import type { AppContext, AdminUser, AdminAuth } from '../types/admin'

const security = new Hono<{ Variables: { admin: AdminUser; adminAuth: AdminAuth; sessionId: string } }>()

// 安全中间件栈
security.use('*', securityHeaders())
security.use('*', corsSecurity())
security.use('*', requestLogging())

// 健康检查端点（公开）
security.get('/health', rateLimitByIP({ maxRequests: 30 }), async (c) => {
  try {
    const health = await integratedSecurityService.healthCheck()
    return c.json({
      success: true,
      data: health
    })
  } catch (error) {
    console.error('Health check error:', error)
    return c.json({
      success: false,
      error: 'Health check failed',
      code: 'HEALTH_CHECK_ERROR'
    }, 500)
  }
})

// 管理员安全端点
const adminSecurity = new Hono<{ Variables: { admin: AdminUser; adminAuth: AdminAuth; sessionId: string } }>()

// 管理员中间件
adminSecurity.use('*', adminCorsSecurity())
adminSecurity.use('*', adminRequestLogging())
adminSecurity.use('*', adminRateLimit())
adminSecurity.use('*', adminAuth)

// 安全仪表板
adminSecurity.get('/dashboard', async (c) => {
  try {
    const dashboard = await integratedSecurityService.getSecurityDashboard()
    return c.json({
      success: true,
      data: dashboard
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return c.json({
      success: false,
      error: 'Failed to load security dashboard',
      code: 'DASHBOARD_ERROR'
    }, 500)
  }
})

// 执行安全扫描
adminSecurity.post('/scan', async (c) => {
  try {
    const scan = await integratedSecurityService.performSecurityScan()
    return c.json({
      success: true,
      data: scan
    })
  } catch (error) {
    console.error('Security scan error:', error)
    return c.json({
      success: false,
      error: 'Security scan failed',
      code: 'SECURITY_SCAN_ERROR'
    }, 500)
  }
})

// 获取安全配置
adminSecurity.get('/config', async (c) => {
  try {
    const { configService } = await import('../services/config-service')
    const securityConfigs = await configService.getConfigGroup('security')
    return c.json({
      success: true,
      data: securityConfigs
    })
  } catch (error) {
    console.error('Get security config error:', error)
    return c.json({
      success: false,
      error: 'Failed to load security configuration',
      code: 'CONFIG_ERROR'
    }, 500)
  }
})

// 更新安全配置
adminSecurity.put('/config', zValidator('json', z.object({
  groupKey: z.string(),
  configKey: z.string(),
  value: z.any(),
  dataType: z.enum(['string', 'number', 'boolean', 'json']).optional(),
  isEncrypted: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  description: z.string().optional()
})), async (c) => {
  try {
    const { configService } = await import('../services/config-service')
    const { groupKey, configKey, value, ...options } = c.req.valid('json')
    const admin = c.get('admin')
    const adminAuth: AdminAuth = {
      associatedId: admin.id.toString(),
      permissions: admin.role === 'super_admin' ? ['*'] : ['admin:security']
    }

    const success = await configService.setConfig(groupKey, configKey, value, {
      ...options,
      updatedBy: adminAuth.associatedId
    })

    if (success) {
      return c.json({
        success: true,
        message: 'Configuration updated successfully'
      })
    } else {
      return c.json({
        success: false,
        error: 'Failed to update configuration',
        code: 'CONFIG_UPDATE_FAILED'
      }, 400)
    }
  } catch (error) {
    console.error('Update security config error:', error)
    return c.json({
      success: false,
      error: 'Configuration update failed',
      code: 'CONFIG_UPDATE_ERROR'
    }, 500)
  }
})

// 生成管理员API密钥
adminSecurity.post('/api-key/generate', zValidator('json', z.object({
  associatedId: z.string().optional(),
  permissions: z.array(z.string()).default(['admin:read']),
  expiresIn: z.string().optional(),
  purpose: z.string().optional()
})), async (c) => {
  try {
    const { generateApiKey } = await import('../middleware/admin-auth')
    const { permissions, expiresIn, purpose, associatedId } = c.req.valid('json')
    const admin = c.get('admin')
    const adminAuth: AdminAuth = {
      associatedId: admin.id.toString(),
      permissions: admin.role === 'super_admin' ? ['*'] : ['admin:security']
    }

    const result = await generateApiKey({
      associatedId: associatedId || adminAuth.associatedId,
      permissions,
      purpose,
      maxUsage: 1
    })

    return c.json({
      success: true,
      data: {
        keyId: result.keyId,
        apiKey: result.apiKey, // 只在生成时显示一次
        message: 'Save this API key securely, it will not be shown again'
      }
    })
  } catch (error) {
    console.error('Generate API key error:', error)
    return c.json({
      success: false,
      error: 'Failed to generate API key',
      code: 'API_KEY_GENERATION_ERROR'
    }, 500)
  }
})

// 撤销API密钥
adminSecurity.delete('/api-key/:keyId', async (c) => {
  try {
    const { revokeApiKey } = await import('../middleware/admin-auth')
    const keyId = c.req.param('keyId')
    const admin = c.get('admin')
    const adminAuth: AdminAuth = {
      associatedId: admin.id.toString(),
      permissions: admin.role === 'super_admin' ? ['*'] : ['admin:security']
    }

    const success = await revokeApiKey(keyId, adminAuth.associatedId)

    if (success) {
      return c.json({
        success: true,
        message: 'API key revoked successfully'
      })
    } else {
      return c.json({
        success: false,
        error: 'API key not found or already revoked',
        code: 'API_KEY_NOT_FOUND'
      }, 404)
    }
  } catch (error) {
    console.error('Revoke API key error:', error)
    return c.json({
      success: false,
      error: 'Failed to revoke API key',
      code: 'API_KEY_REVOCATION_ERROR'
    }, 500)
  }
})

// 获取令牌统计
adminSecurity.get('/tokens/stats', async (c) => {
  try {
    const { tokenService } = await import('../services/token-service')
    const stats = await tokenService.getTokenStats()
    return c.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Get token stats error:', error)
    return c.json({
      success: false,
      error: 'Failed to load token statistics',
      code: 'TOKEN_STATS_ERROR'
    }, 500)
  }
})

// 获取Webhook统计
adminSecurity.get('/webhooks/stats', async (c) => {
  try {
    const { webhookSecurityService } = await import('../services/webhook-security-service')
    const stats = await webhookSecurityService.getWebhookStats()
    return c.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Get webhook stats error:', error)
    return c.json({
      success: false,
      error: 'Failed to load webhook statistics',
      code: 'WEBHOOK_STATS_ERROR'
    }, 500)
  }
})

// 获取配置统计
adminSecurity.get('/config/stats', async (c) => {
  try {
    const { configService } = await import('../services/config-service')
    const stats = await configService.getConfigStats()
    return c.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Get config stats error:', error)
    return c.json({
      success: false,
      error: 'Failed to load configuration statistics',
      code: 'CONFIG_STATS_ERROR'
    }, 500)
  }
})

// 获取限流统计
adminSecurity.get('/rate-limit/stats', async (c) => {
  try {
    const { getRateLimitStats } = await import('../middleware/rate-limit')
    const stats = await getRateLimitStats()
    return c.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Get rate limit stats error:', error)
    return c.json({
      success: false,
      error: 'Failed to load rate limit statistics',
      code: 'RATE_LIMIT_STATS_ERROR'
    }, 500)
  }
})

// 清理过期数据
adminSecurity.post('/cleanup', zValidator('json', z.object({
  days: z.number().default(30)
})), async (c) => {
  try {
    const { days } = c.req.valid('json')
    const results: any = {}

    // 清理过期令牌
    const { tokenService } = await import('../services/token-service')
    results.expiredTokens = await tokenService.cleanupExpiredTokens()

    // 清理过期Webhook记录
    const { webhookSecurityService } = await import('../services/webhook-security-service')
    results.expiredWebhooks = await webhookSecurityService.cleanupExpiredWebhookRecords(days)

    // 清理过期限流记录
    const { cleanupExpiredRateLimits } = await import('../middleware/rate-limit')
    results.expiredRateLimits = await cleanupExpiredRateLimits()

    // 清理旧审计日志
    const { auditService } = await import('../services/audit-service')
    results.oldAuditLogs = await auditService.cleanupOldAuditLogs(days)

    return c.json({
      success: true,
      data: {
        message: 'Cleanup completed successfully',
        results,
        cleanedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Cleanup error:', error)
    return c.json({
      success: false,
      error: 'Cleanup operation failed',
      code: 'CLEANUP_ERROR'
    }, 500)
  }
})

// 初始化安全系统
adminSecurity.post('/initialize', async (c) => {
  try {
    await integratedSecurityService.initialize()
    return c.json({
      success: true,
      message: 'Security system initialized successfully'
    })
  } catch (error) {
    console.error('Security initialization error:', error)
    return c.json({
      success: false,
      error: 'Security system initialization failed',
      code: 'INITIALIZATION_ERROR'
    }, 500)
  }
})

// 挂载管理员路由
security.route('/admin', adminSecurity)

export default security