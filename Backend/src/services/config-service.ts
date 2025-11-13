import { z } from 'zod'
import { db, schema } from '../db'
import { eq, and, lt, gt } from 'drizzle-orm'
import { auditService } from './audit-service'
import { securityService } from './security-service'

// 配置验证模式
const ConfigValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.record(z.unknown()), // JSON object
])

const ConfigItemSchema = z.object({
  groupKey: z.string(),
  configKey: z.string(),
  configValue: ConfigValueSchema,
  dataType: z.enum(['string', 'number', 'boolean', 'json']),
  description: z.string().optional(),
  isEncrypted: z.boolean().default(false),
  isPublic: z.boolean().default(false),
  validationRule: z.string().optional(),
  defaultValue: z.string().optional(),
})

type ConfigItem = z.infer<typeof ConfigItemSchema>

/**
 * 配置管理服务
 * 提供系统配置的读取、验证、更新和热更新功能
 */
export class ConfigService {
  private configCache = new Map<string, any>()
  private cacheTimestamps = new Map<string, number>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5分钟缓存
  private readonly DEFAULT_GROUP = 'system'

  /**
   * 获取配置值
   */
  async getConfig(
    groupKey: string,
    configKey: string,
    defaultValue?: any,
    options: {
      useCache?: boolean
      includeEncrypted?: boolean
    } = {}
  ): Promise<any> {
    const { useCache = true, includeEncrypted = false } = options

    try {
      // 构建缓存键
      const cacheKey = `${groupKey}:${configKey}`

      // 检查缓存
      if (useCache && this.isCacheValid(cacheKey)) {
        return this.configCache.get(cacheKey)
      }

      // 从数据库获取配置
      const configRecord = await db.select()
        .from(schema.config)
        .where(and(
          eq(schema.config.groupKey, groupKey),
          eq(schema.config.configKey, configKey),
          includeEncrypted ? undefined : eq(schema.config.isEncrypted, false)
        ))
        .limit(1)

      if (configRecord.length === 0) {
        // 检查环境变量
        const envValue = this.getEnvVariable(groupKey, configKey)
        if (envValue !== undefined) {
          const parsedValue = this.parseConfigValue(envValue, 'string')
          if (useCache) {
            this.setCache(cacheKey, parsedValue)
          }
          return parsedValue
        }

        // 返回默认值
        if (defaultValue !== undefined) {
          if (useCache) {
            this.setCache(cacheKey, defaultValue)
          }
          return defaultValue
        }

        throw new Error(`Configuration not found: ${groupKey}.${configKey}`)
      }

      const config = configRecord[0]
      let value = config.configValue

      // 如果是加密配置，解密
      if (config.isEncrypted) {
        value = this.decryptConfigValue(value)
      }

      // 解析配置值
      const parsedValue = this.parseConfigValue(value, config.dataType)

      // 验证配置值
      const validationResult = this.validateConfigValue(parsedValue, config.validationRule)
      if (!validationResult.isValid) {
        console.warn(`Configuration validation failed for ${groupKey}.${configKey}:`, validationResult.error)

        // 使用默认值
        if (defaultValue !== undefined) {
          if (useCache) {
            this.setCache(cacheKey, defaultValue)
          }
          return defaultValue
        }
      }

      // 缓存结果
      if (useCache) {
        this.setCache(cacheKey, parsedValue)
      }

      return parsedValue
    } catch (error) {
      console.error(`Error getting config ${groupKey}.${configKey}:`, error)

      // 发生错误时返回默认值
      return defaultValue
    }
  }

  /**
   * 设置配置值
   */
  async setConfig(
    groupKey: string,
    configKey: string,
    value: any,
    options: {
      dataType?: 'string' | 'number' | 'boolean' | 'json'
      isEncrypted?: boolean
      isPublic?: boolean
      description?: string
      validationRule?: string
      updatedBy?: string
    } = {}
  ): Promise<boolean> {
    const {
      dataType = typeof value,
      isEncrypted = false,
      isPublic = false,
      description,
      validationRule,
      updatedBy = 'system'
    } = options

    try {
      // 验证配置项
      const configItem: ConfigItem = {
        groupKey,
        configKey,
        configValue: value,
        dataType: dataType as any,
        isEncrypted,
        isPublic,
        description,
        validationRule
      }

      const validationResult = ConfigItemSchema.safeParse(configItem)
      if (!validationResult.success) {
        throw new Error(`Invalid configuration: ${validationResult.error.message}`)
      }

      // 验证配置值
      const valueValidation = this.validateConfigValue(value, validationRule)
      if (!valueValidation.isValid) {
        throw new Error(`Configuration value validation failed: ${valueValidation.error}`)
      }

      // 准备存储值
      let storedValue = value
      if (isEncrypted) {
        storedValue = this.encryptConfigValue(value)
      }

      // 检查是否已存在
      const existingRecord = await db.select()
        .from(schema.config)
        .where(and(
          eq(schema.config.groupKey, groupKey),
          eq(schema.config.configKey, configKey)
        ))
        .limit(1)

      const now = new Date().toISOString()

      if (existingRecord.length > 0) {
        // 更新现有配置
        await db.update(schema.config)
          .set({
            configValue: storedValue,
            dataType,
            isEncrypted,
            isPublic,
            description,
            validationRule,
            version: existingRecord[0].version + 1,
            updatedAt: now,
            updatedBy
          })
          .where(and(
            eq(schema.config.groupKey, groupKey),
            eq(schema.config.configKey, configKey)
          ))
      } else {
        // 创建新配置
        await db.insert(schema.config).values({
          groupKey,
          configKey,
          configValue: storedValue,
          dataType,
          isEncrypted,
          isPublic,
          description,
          validationRule,
          createdAt: now,
          updatedAt: now,
          updatedBy
        })
      }

      // 清除缓存
      this.clearCache(`${groupKey}:${configKey}`)

      // 记录审计日志
      await auditService.logAuditEvent({
        action: 'config_updated',
        resourceType: 'config',
        resourceId: `${groupKey}.${configKey}`,
        success: true,
        userEmail: updatedBy,
        metadata: {
          groupKey,
          configKey,
          dataType,
          isEncrypted,
          isPublic,
          oldValue: existingRecord.length > 0 ? '[REDACTED]' : null,
          updatedAt: now
        }
      })

      return true
    } catch (error) {
      console.error(`Error setting config ${groupKey}.${configKey}:`, error)

      await auditService.logAuditEvent({
        action: 'config_update_failed',
        resourceType: 'config',
        resourceId: `${groupKey}.${configKey}`,
        success: false,
        userEmail: updatedBy,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      })

      return false
    }
  }

  /**
   * 批量获取配置
   */
  async getConfigGroup(groupKey: string, options: {
    includeEncrypted?: boolean
    useCache?: boolean
  } = {}): Promise<Record<string, any>> {
    const { includeEncrypted = false, useCache = true } = options

    try {
      const configs = await db.select()
        .from(schema.config)
        .where(and(
          eq(schema.config.groupKey, groupKey),
          includeEncrypted ? undefined : eq(schema.config.isEncrypted, false)
        ))

      const result: Record<string, any> = {}

      for (const config of configs) {
        let value = config.configValue

        // 解密加密配置
        if (config.isEncrypted) {
          value = this.decryptConfigValue(value)
        }

        // 解析配置值
        const parsedValue = this.parseConfigValue(value, config.dataType)

        // 验证配置值
        const validationResult = this.validateConfigValue(parsedValue, config.validationRule)
        if (validationResult.isValid) {
          result[config.configKey] = parsedValue
        } else {
          console.warn(`Invalid config value for ${groupKey}.${config.configKey}:`, validationResult.error)
        }
      }

      return result
    } catch (error) {
      console.error(`Error getting config group ${groupKey}:`, error)
      return {}
    }
  }

  /**
   * 批量设置配置
   */
  async setConfigGroup(
    groupKey: string,
    configs: Record<string, any>,
    options: {
      isEncrypted?: boolean
      isPublic?: boolean
      updatedBy?: string
    } = {}
  ): Promise<{ success: string[]; failed: string[] }> {
    const { isEncrypted = false, isPublic = false, updatedBy = 'system' } = options
    const success: string[] = []
    const failed: string[] = []

    for (const [configKey, value] of Object.entries(configs)) {
      try {
        const successSet = await this.setConfig(groupKey, configKey, value, {
          isEncrypted,
          isPublic,
          updatedBy
        })

        if (successSet) {
          success.push(configKey)
        } else {
          failed.push(configKey)
        }
      } catch (error) {
        console.error(`Failed to set config ${groupKey}.${configKey}:`, error)
        failed.push(configKey)
      }
    }

    return { success, failed }
  }

  /**
   * 删除配置
   */
  async deleteConfig(groupKey: string, configKey: string, deletedBy: string = 'system'): Promise<boolean> {
    try {
      const result = await db.delete(schema.config)
        .where(and(
          eq(schema.config.groupKey, groupKey),
          eq(schema.config.configKey, configKey)
        ))

      const success = result.changes > 0

      if (success) {
        // 清除缓存
        this.clearCache(`${groupKey}:${configKey}`)

        await auditService.logAuditEvent({
          action: 'config_deleted',
          resourceType: 'config',
          resourceId: `${groupKey}.${configKey}`,
          success: true,
          userEmail: deletedBy,
          metadata: { groupKey, configKey }
        })
      }

      return success
    } catch (error) {
      console.error(`Error deleting config ${groupKey}.${configKey}:`, error)
      return false
    }
  }

  /**
   * 验证配置值
   */
  private validateConfigValue(value: any, rule?: string): { isValid: boolean; error?: string } {
    if (!rule) return { isValid: true }

    try {
      // 简单的验证规则解析
      // 格式: "type:string,min:1,max:100,pattern:^[a-zA-Z0-9]+$"
      const rules = rule.split(',').map(r => r.trim())

      for (const ruleItem of rules) {
        const [key, val] = ruleItem.split(':')

        switch (key) {
          case 'type':
            if (val === 'string' && typeof value !== 'string') {
              return { isValid: false, error: `Value must be a string` }
            }
            if (val === 'number' && typeof value !== 'number') {
              return { isValid: false, error: `Value must be a number` }
            }
            if (val === 'boolean' && typeof value !== 'boolean') {
              return { isValid: false, error: `Value must be a boolean` }
            }
            break

          case 'min':
            const minVal = parseInt(val)
            if (typeof value === 'number' && value < minVal) {
              return { isValid: false, error: `Value must be at least ${minVal}` }
            }
            if (typeof value === 'string' && value.length < minVal) {
              return { isValid: false, error: `Length must be at least ${minVal}` }
            }
            break

          case 'max':
            const maxVal = parseInt(val)
            if (typeof value === 'number' && value > maxVal) {
              return { isValid: false, error: `Value must be at most ${maxVal}` }
            }
            if (typeof value === 'string' && value.length > maxVal) {
              return { isValid: false, error: `Length must be at most ${maxVal}` }
            }
            break

          case 'pattern':
            const regex = new RegExp(val)
            if (typeof value === 'string' && !regex.test(value)) {
              return { isValid: false, error: `Value does not match required pattern` }
            }
            break

          case 'enum':
            const allowedValues = val.split('|')
            if (!allowedValues.includes(value)) {
              return { isValid: false, error: `Value must be one of: ${allowedValues.join(', ')}` }
            }
            break
        }
      }

      return { isValid: true }
    } catch (error) {
      return { isValid: false, error: 'Validation rule error' }
    }
  }

  /**
   * 解析配置值
   */
  private parseConfigValue(value: any, dataType: string): any {
    switch (dataType) {
      case 'number':
        return typeof value === 'string' ? parseFloat(value) : value
      case 'boolean':
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true'
        }
        return Boolean(value)
      case 'json':
        if (typeof value === 'string') {
          return JSON.parse(value)
        }
        return value
      default:
        return value
    }
  }

  /**
   * 加密配置值
   */
  private encryptConfigValue(value: any): string {
    const jsonString = typeof value === 'string' ? value : JSON.stringify(value)
    const encrypted = securityService.encrypt(jsonString)
    return JSON.stringify(encrypted)
  }

  /**
   * 解密配置值
   */
  private decryptConfigValue(encryptedValue: string): any {
    try {
      const encrypted = JSON.parse(encryptedValue)
      const decrypted = securityService.decrypt(encrypted.encrypted, encrypted.iv, encrypted.tag)
      return JSON.parse(decrypted)
    } catch (error) {
      console.error('Error decrypting config value:', error)
      throw new Error('Failed to decrypt configuration value')
    }
  }

  /**
   * 从环境变量获取配置
   */
  private getEnvVariable(groupKey: string, configKey: string): string | undefined {
    const envKey = `${groupKey.toUpperCase()}_${configKey.toUpperCase()}`
    return process.env[envKey]
  }

  /**
   * 缓存管理
   */
  private setCache(key: string, value: any): void {
    this.configCache.set(key, value)
    this.cacheTimestamps.set(key, Date.now())
  }

  private getCache(key: string): any {
    return this.configCache.get(key)
  }

  private isCacheValid(key: string): boolean {
    const timestamp = this.cacheTimestamps.get(key)
    if (!timestamp) return false
    return Date.now() - timestamp < this.CACHE_TTL
  }

  private clearCache(key: string): void {
    this.configCache.delete(key)
    this.cacheTimestamps.delete(key)
  }

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    this.configCache.clear()
    this.cacheTimestamps.clear()
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.configCache.size,
      hitRate: 0 // TODO: 实现命中率统计
    }
  }

  /**
   * 获取配置统计
   */
  async getConfigStats(): Promise<{
    totalConfigs: number
    encryptedConfigs: number
    publicConfigs: number
    byGroup: Record<string, number>
    byDataType: Record<string, number>
  }> {
    try {
      const stats = await db.select({
        total: sql`COUNT(*)`,
        encrypted: sql`COUNT(CASE WHEN ${schema.config.isEncrypted} = true THEN 1 END)`,
        public: sql`COUNT(CASE WHEN ${schema.config.isPublic} = true THEN 1 END)`
      })
        .from(schema.config)

      const total = stats[0].total
      const encrypted = stats[0].encrypted
      const publicCount = stats[0].public

      // 按分组统计
      const groupStats = await db.select({
        group: schema.config.groupKey,
        count: sql`COUNT(*)`
      })
        .from(schema.config)
        .groupBy(schema.config.groupKey)

      // 按数据类型统计
      const typeStats = await db.select({
        dataType: schema.config.dataType,
        count: sql`COUNT(*)`
      })
        .from(schema.config)
        .groupBy(schema.config.dataType)

      const byGroup: Record<string, number> = {}
      const byDataType: Record<string, number> = {}

      groupStats.forEach(stat => {
        byGroup[stat.group] = stat.count
      })

      typeStats.forEach(stat => {
        byDataType[stat.dataType] = stat.count
      })

      return {
        totalConfigs: total,
        encryptedConfigs: encrypted,
        publicConfigs: publicCount,
        byGroup,
        byDataType
      }
    } catch (error) {
      console.error('Error getting config stats:', error)
      return {
        totalConfigs: 0,
        encryptedConfigs: 0,
        publicConfigs: 0,
        byGroup: {},
        byDataType: {}
      }
    }
  }

  /**
   * 导出配置（仅公开配置）
   */
  async exportPublicConfigs(): Promise<Record<string, Record<string, any>>> {
    try {
      const publicConfigs = await db.select()
        .from(schema.config)
        .where(eq(schema.config.isPublic, true))

      const result: Record<string, Record<string, any>> = {}

      for (const config of publicConfigs) {
        if (!result[config.groupKey]) {
          result[config.groupKey] = {}
        }

        let value = config.configValue
        if (config.isEncrypted) {
          // 跳过加密的公开配置
          continue
        }

        result[config.groupKey][config.configKey] = this.parseConfigValue(value, config.dataType)
      }

      return result
    } catch (error) {
      console.error('Error exporting public configs:', error)
      return {}
    }
  }

  /**
   * 初始化默认配置
   */
  async initializeDefaultConfigs(): Promise<void> {
    const defaultConfigs = {
      security: {
        'jwt_secret': { value: process.env.JWT_SECRET || securityService.generateSecureToken(64), encrypted: true },
        'admin_session_timeout': { value: 3600, dataType: 'number' },
        'max_login_attempts': { value: 5, dataType: 'number' },
        'password_min_length': { value: 8, dataType: 'number' },
      },
      payment: {
        'alipay_enabled': { value: false, dataType: 'boolean' },
        'creem_enabled': { value: false, dataType: 'boolean' },
        'webhook_timeout': { value: 30, dataType: 'number' },
        'amount_tolerance': { value: 0.01, dataType: 'number' },
      },
      download: {
        'default_expire_hours': { value: 72, dataType: 'number' },
        'default_max_downloads': { value: 3, dataType: 'number' },
        'download_timeout': { value: 300, dataType: 'number' },
      },
      email: {
        'resend_api_key': { value: '', encrypted: true },
        'from_email': { value: 'noreply@example.com' },
        'from_name': { value: 'AutoShip' },
        'smtp_timeout': { value: 30, dataType: 'number' },
      }
    }

    for (const [group, configs] of Object.entries(defaultConfigs)) {
      for (const [key, config] of Object.entries(configs)) {
        await this.setConfig(group, key, config.value, {
          dataType: config.dataType || 'string',
          isEncrypted: config.encrypted || false,
          isPublic: false,
          updatedBy: 'system_initialization'
        })
      }
    }
  }
}

// 创建配置服务实例
export const configService = new ConfigService()

export default configService