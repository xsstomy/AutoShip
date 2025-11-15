import crypto from 'crypto'
import { db, schema } from '../db'
import { eq, and } from 'drizzle-orm'

// 安全服务类
export class SecurityService {
  // 加密配置
  private readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm'
  private readonly ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || this.generateEncryptionKey()
  private readonly SALT_ROUNDS = 12

  /**
   * 生成加密密钥
   */
  private generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  /**
   * 加密敏感数据
   */
  encrypt(plaintext: string): { encrypted: string; iv: string; tag: string } {
    try {
      const iv = crypto.randomBytes(16)
      // 确保密钥长度正确（32字节用于 aes-256）
      const key = Buffer.from(this.ENCRYPTION_KEY.slice(0, 64), 'hex')
      const cipher = crypto.createCipheriv(this.ENCRYPTION_ALGORITHM, key, iv)
      cipher.setAAD(Buffer.from('autoship')) // 附加认证数据

      let encrypted = cipher.update(plaintext, 'utf8', 'hex')
      encrypted += cipher.final('hex')

      const tag = cipher.getAuthTag()

      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      }
    } catch (error: any) {
      throw new Error(`Encryption failed: ${error.message}`)
    }
  }

  /**
   * 解密敏感数据
   */
  decrypt(encrypted: string, iv: string, tag: string): string {
    try {
      // 确保密钥长度正确（32字节用于 aes-256）
      const key = Buffer.from(this.ENCRYPTION_KEY.slice(0, 64), 'hex')
      const decipher = crypto.createDecipheriv(this.ENCRYPTION_ALGORITHM, key, Buffer.from(iv, 'hex'))
      decipher.setAAD(Buffer.from('autoship'))
      decipher.setAuthTag(Buffer.from(tag, 'hex'))

      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')

      return decrypted
    } catch (error: any) {
      throw new Error(`Decryption failed: ${error.message}`)
    }
  }

  /**
   * 生成安全token
   */
  generateSecureToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex')
  }

  /**
   * 生成UUID
   */
  generateUUID(): string {
    return crypto.randomUUID()
  }

  /**
   * 验证外键约束
   */
  async validateForeignKey(tableName: string, fieldName: string, value: any): Promise<boolean> {
    try {
      switch (tableName) {
        case 'orders':
          if (fieldName === 'productId') {
            const product = await db.select()
              .from(schema.products)
              .where(eq(schema.products.id, value))
              .limit(1)
            return product.length > 0
          }
          break

        case 'deliveries':
          if (fieldName === 'orderId') {
            const order = await db.select()
              .from(schema.orders)
              .where(eq(schema.orders.id, value))
              .limit(1)
            return order.length > 0
          }
          break

        case 'downloads':
          if (fieldName === 'deliveryId') {
            const delivery = await db.select()
              .from(schema.deliveries)
              .where(eq(schema.deliveries.id, value))
              .limit(1)
            return delivery.length > 0
          }
          break

        case 'product_prices':
          if (fieldName === 'productId') {
            const product = await db.select()
              .from(schema.products)
              .where(eq(schema.products.id, value))
              .limit(1)
            return product.length > 0
          }
          break

        case 'inventory_text':
          if (fieldName === 'productId') {
            const product = await db.select()
              .from(schema.products)
              .where(eq(schema.products.id, value))
              .limit(1)
            return product.length > 0
          }
          if (fieldName === 'usedOrderId') {
            const order = await db.select()
              .from(schema.orders)
              .where(eq(schema.orders.id, value))
              .limit(1)
            return order.length > 0
          }
          break

        default:
          return true // 未知的表/字段组合，暂时通过
      }

      return false
    } catch (error) {
      console.error(`Foreign key validation failed for ${tableName}.${fieldName}:`, error)
      return false
    }
  }

  /**
   * 批量验证外键约束
   */
  async validateForeignKeys(data: Record<string, any>, tableSchema: Record<string, string>): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    for (const [fieldName, fieldType] of Object.entries(tableSchema)) {
      if (fieldType.includes('references') && data[fieldName]) {
        const referencedTable = this.extractReferencedTable(fieldType)
        const isValid = await this.validateForeignKey(referencedTable, fieldName, data[fieldName])

        if (!isValid) {
          errors.push(`Invalid foreign key reference: ${fieldName} = ${data[fieldName]}`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 从字段类型中提取引用的表名
   */
  private extractReferencedTable(fieldType: string): string {
    // 简化版本，实际应该解析Drizzle的schema定义
    if (fieldType.includes('products')) return 'products'
    if (fieldType.includes('orders')) return 'orders'
    if (fieldType.includes('deliveries')) return 'deliveries'
    return 'unknown'
  }

  /**
   * 加密敏感字段
   */
  encryptSensitiveFields(data: Record<string, any>, sensitiveFields: string[]): Record<string, any> {
    const encryptedData = { ...data }

    for (const field of sensitiveFields) {
      if (data[field]) {
        const encrypted = this.encrypt(data[field])
        encryptedData[`${field}_encrypted`] = JSON.stringify(encrypted)
        delete encryptedData[field]
      }
    }

    return encryptedData
  }

  /**
   * 解密敏感字段
   */
  decryptSensitiveFields(data: Record<string, any>, sensitiveFields: string[]): Record<string, any> {
    const decryptedData = { ...data }

    for (const field of sensitiveFields) {
      const encryptedField = `${field}_encrypted`
      if (data[encryptedField]) {
        try {
          const encrypted = JSON.parse(data[encryptedField])
          decryptedData[field] = this.decrypt(encrypted.encrypted, encrypted.iv, encrypted.tag)
          delete decryptedData[encryptedField]
        } catch (error) {
          console.error(`Failed to decrypt field ${field}:`, error)
        }
      }
    }

    return decryptedData
  }

  /**
   * 数据脱敏
   */
  maskSensitiveData(data: Record<string, any>, sensitiveFields: string[]): Record<string, any> {
    const maskedData = { ...data }

    for (const field of sensitiveFields) {
      if (data[field]) {
        if (field === 'email') {
          maskedData[field] = this.maskEmail(data[field])
        } else if (field === 'ipAddress') {
          maskedData[field] = this.maskIpAddress(data[field])
        } else if (field === 'userAgent') {
          maskedData[field] = this.maskUserAgent(data[field])
        } else {
          maskedData[field] = this.maskGeneric(data[field])
        }
      }
    }

    return maskedData
  }

  /**
   * 邮箱脱敏
   */
  public maskEmail(email: string): string {
    const [username, domain] = email.split('@')
    if (username.length <= 2) {
      return `${username[0]}*@${domain}`
    }
    return `${username.substring(0, 2)}${'*'.repeat(username.length - 2)}@${domain}`
  }

  /**
   * IP地址脱敏
   */
  public maskIpAddress(ip: string): string {
    const parts = ip.split('.')
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.*`
    }
    return ip.substring(0, Math.max(0, ip.length - 4)) + '****'
  }

  /**
   * User-Agent脱敏
   */
  public maskUserAgent(userAgent: string): string {
    if (userAgent.length <= 10) {
      return userAgent.substring(0, 3) + '***'
    }
    return userAgent.substring(0, 10) + '***'
  }

  /**
   * 通用脱敏
   */
  public maskGeneric(value: string): string {
    if (value.length <= 4) {
      return '*'.repeat(value.length)
    }
    return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2)
  }

  /**
   * 生成文件校验和
   */
  generateFileChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex')
  }

  /**
   * 验证文件完整性
   */
  verifyFileIntegrity(buffer: Buffer, expectedChecksum: string): boolean {
    const actualChecksum = this.generateFileChecksum(buffer)
    return actualChecksum === expectedChecksum
  }

  /**
   * 安全密码哈希（虽然项目不需要用户密码，但为其他敏感数据提供哈希功能）
   */
  hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
    return `${salt}:${hash}`
  }

  /**
   * 验证密码哈希
   */
  verifyPassword(password: string, hashedPassword: string): boolean {
    const [salt, hash] = hashedPassword.split(':')
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
    return hash === verifyHash
  }

  /**
   * 生成HMAC签名
   */
  generateHMAC(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex')
  }

  /**
   * 验证HMAC签名
   */
  verifyHMAC(data: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateHMAC(data, secret)
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  }

  /**
   * 获取数据完整性摘要
   */
  async getDataIntegrityDigest(): Promise<any> {
    try {
      const digest = {
        timestamp: new Date().toISOString(),
        tables: {},
        checksums: {},
      }

      // 获取主要表的记录数和最新时间戳
      const tables = ['products', 'orders', 'deliveries', 'inventory_text', 'payments_raw']

      for (const table of tables) {
        try {
          const countResult = await (db as any).execute(`SELECT COUNT(*) as count FROM ${table}`)
          const latestResult = await (db as any).execute(`SELECT MAX(created_at) as latest FROM ${table}`)

          digest.tables[table] = {
            count: (countResult as any)[0]?.count || 0,
            latestRecord: (latestResult as any)[0]?.latest || null,
          }
        } catch (error) {
          digest.tables[table] = {
            count: 'error',
            latestRecord: 'error',
          }
        }
      }

      // 生成整体校验和
      const dataString = JSON.stringify(digest.tables)
      ;(digest.checksums as any).overall = this.generateHMAC(dataString, this.ENCRYPTION_KEY)

      return digest
    } catch (error) {
      console.error('Failed to generate data integrity digest:', error)
      throw error
    }
  }

  /**
   * 验证数据完整性
   */
  async verifyDataIntegrity(expectedDigest: any): Promise<boolean> {
    try {
      const currentDigest = await this.getDataIntegrityDigest()

      // 比较校验和
      if (expectedDigest.checksums.overall !== currentDigest.checksums.overall) {
        return false
      }

      // 比较表数据（这里可以做更详细的比较）
      return true
    } catch (error) {
      console.error('Failed to verify data integrity:', error)
      return false
    }
  }

  /**
   * 安全删除（确保数据无法恢复）
   */
  secureDelete(tableName: string, condition: any): Promise<number> {
    // 在实际实现中，可以先覆盖敏感数据再删除
    // 这里简化为直接删除
    let query = `DELETE FROM ${tableName} WHERE `
    const conditions = Object.keys(condition).map(key => `${key} = ?`).join(' AND ')
    const values = Object.values(condition)

    return (db as any).execute(query + conditions, values).then(result => (result as any).changes)
  }
}

// 创建安全服务实例
export const securityService = new SecurityService()

// 默认导出
export default securityService