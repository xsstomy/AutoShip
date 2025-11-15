import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { db, schema } from '../db'
import { securityService } from './security-service'

// 备份服务类
export class BackupService {
  private readonly BACKUP_DIR = process.env.BACKUP_DIR || './backups'
  private readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm'

  constructor() {
    this.ensureBackupDirectory()
  }

  /**
   * 确保备份目录存在
   */
  private async ensureBackupDirectory() {
    try {
      await fs.mkdir(this.BACKUP_DIR, { recursive: true })
    } catch (error) {
      console.error('Failed to create backup directory:', error)
    }
  }

  /**
   * 创建完整数据库备份
   */
  async createFullBackup(options: {
    encrypt?: boolean
    compress?: boolean
    includeAudit?: boolean
  } = {}): Promise<{
    success: boolean
    backupId: string
    filePath?: string
    size?: number
    error?: string
  }> {
    const { encrypt = true, compress = true, includeAudit = true } = options
    const backupId = this.generateBackupId()

    try {
      console.log(`Starting backup: ${backupId}`)

      // 获取所有表的数据
      const tables = [
        'products',
        'product_prices',
        'orders',
        'deliveries',
        'downloads',
        'payments_raw',
        'inventory_text',
        'settings',
        ...(includeAudit ? ['admin_logs', 'files'] : [])
      ]

      const backupData: any = {
        backupId,
        timestamp: new Date().toISOString(),
        version: '1.0',
        tables: {},
        metadata: {
          totalRecords: 0,
          tablesCount: tables.length,
          encrypted: encrypt,
          compressed: compress,
        }
      }

      let totalRecords = 0

      // 导出每个表的数据
      for (const tableName of tables) {
        try {
          const tableData = await this.exportTable(tableName)
          backupData.tables[tableName] = tableData
          totalRecords += tableData.records.length

          console.log(`Exported ${tableData.records.length} records from ${tableName}`)
        } catch (error) {
          console.error(`Failed to export table ${tableName}:`, error)
          backupData.tables[tableName] = {
            records: [],
            error: error instanceof Error ? error.message : String(error),
          }
        }
      }

      backupData.metadata.totalRecords = totalRecords

      // 序列化数据
      const jsonString = JSON.stringify(backupData, null, 2)
      let dataBuffer = Buffer.from(jsonString, 'utf8')

      // 压缩数据
      if (compress) {
        // 这里可以使用压缩库，暂时跳过
        console.log('Compression skipped (implement compression library if needed)')
      }

      // 加密数据
      if (encrypt) {
        const encrypted = this.encryptData(dataBuffer)
        dataBuffer = Buffer.from(JSON.stringify(encrypted))
      }

      // 写入文件
      const fileName = `backup_${backupId}.json${encrypt ? '.enc' : ''}`
      const filePath = path.join(this.BACKUP_DIR, fileName)

      await fs.writeFile(filePath, dataBuffer)

      const stats = await fs.stat(filePath)

      console.log(`Backup completed: ${fileName} (${stats.size} bytes)`)

      return {
        success: true,
        backupId,
        filePath,
        size: stats.size,
      }

    } catch (error) {
      console.error('Backup failed:', error)
      return {
        success: false,
        backupId,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * 导出单个表的数据
   */
  private async exportTable(tableName: string) {
    try {
      const result = await (db as any).execute(`SELECT * FROM ${tableName}`)
      const records = (result as any) || []

      return {
        tableName,
        recordCount: records.length,
        records,
        exportedAt: new Date().toISOString(),
      }
    } catch (error) {
      throw new Error(`Failed to export table ${tableName}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 加密数据
   */
  private encryptData(data: Buffer): any {
    const key = this.getBackupEncryptionKey()
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(this.ENCRYPTION_ALGORITHM, Buffer.from(key, 'hex'), iv)

    let encrypted = cipher.update(data)
    encrypted = Buffer.concat([encrypted, cipher.final()])

    const tag = cipher.getAuthTag()

    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
    }
  }

  /**
   * 解密数据
   */
  private decryptData(encryptedData: any): Buffer {
    const key = this.getBackupEncryptionKey()
    const iv = Buffer.from(encryptedData.iv, 'base64')
    const decipher = crypto.createDecipheriv(this.ENCRYPTION_ALGORITHM, Buffer.from(key, 'hex'), iv)

    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'base64'))

    const encrypted = Buffer.from(encryptedData.encrypted, 'base64')
    let decrypted = decipher.update(encrypted)
    decrypted = Buffer.concat([decrypted, decipher.final()])

    return decrypted
  }

  /**
   * 获取备份加密密钥
   */
  private getBackupEncryptionKey(): string {
    const key = process.env.BACKUP_ENCRYPTION_KEY
    if (!key) {
      throw new Error('BACKUP_ENCRYPTION_KEY environment variable is required')
    }
    return key
  }

  /**
   * 生成备份ID
   */
  private generateBackupId(): string {
    return `autoship_${new Date().toISOString().replace(/[:.]/g, '-')}`
  }

  /**
   * 从备份恢复数据
   */
  async restoreFromBackup(backupId: string, options: {
    decrypt?: boolean
    overwrite?: boolean
    tables?: string[]
  } = {}): Promise<{
    success: boolean
    restoredTables: string[]
    errors: string[]
  }> {
    const { decrypt = true, overwrite = false, tables } = options
    const errors: string[] = []
    const restoredTables: string[] = []

    try {
      console.log(`Starting restore from backup: ${backupId}`)

      // 查找备份文件
      const backupFile = await this.findBackupFile(backupId)
      if (!backupFile) {
        throw new Error(`Backup file not found: ${backupId}`)
      }

      // 读取备份文件
      const fileContent = await fs.readFile(backupFile, 'utf8')

      // 解密数据
      let backupData
      if (decrypt && backupFile.endsWith('.enc')) {
        const encryptedData = JSON.parse(fileContent)
        const decryptedBuffer = this.decryptData(encryptedData)
        backupData = JSON.parse(decryptedBuffer.toString('utf8'))
      } else {
        backupData = JSON.parse(fileContent)
      }

      // 验证备份格式
      if (!backupData.tables) {
        throw new Error('Invalid backup format')
      }

      // 确定要恢复的表
      const tablesToRestore = tables || Object.keys(backupData.tables)

      // 恢复每个表
      for (const tableName of tablesToRestore) {
        if (!backupData.tables[tableName]) {
          errors.push(`Table ${tableName} not found in backup`)
          continue
        }

        try {
          await this.restoreTable(tableName, backupData.tables[tableName], overwrite)
          restoredTables.push(tableName)
          console.log(`Restored table: ${tableName}`)
        } catch (error) {
          errors.push(`Failed to restore table ${tableName}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }

      console.log(`Restore completed. Restored ${restoredTables.length} tables, ${errors.length} errors`)

      return {
        success: errors.length === 0,
        restoredTables,
        errors,
      }

    } catch (error) {
      console.error('Restore failed:', error)
      return {
        success: false,
        restoredTables,
        errors: [error instanceof Error ? error.message : String(error)],
      }
    }
  }

  /**
   * 查找备份文件
   */
  private async findBackupFile(backupId: string): Promise<string | null> {
    try {
      const files = await fs.readdir(this.BACKUP_DIR)
      const backupFile = files.find(file => file.includes(backupId))

      if (backupFile) {
        return path.join(this.BACKUP_DIR, backupFile)
      }

      return null
    } catch (error) {
      console.error('Failed to find backup file:', error)
      return null
    }
  }

  /**
   * 恢复单个表
   */
  private async restoreTable(tableName: string, tableData: any, overwrite: boolean) {
    if (!tableData.records || tableData.records.length === 0) {
      console.log(`No records to restore for table: ${tableName}`)
      return
    }

    try {
      // 如果覆盖，先清空表
      if (overwrite) {
        await (db as any).execute(`DELETE FROM ${tableName}`)
        console.log(`Cleared table: ${tableName}`)
      }

      // 插入记录
      const records = tableData.records
      for (const record of records) {
        // 确保字段名正确（移除可能的RowID等SQLite特有字段）
        const cleanRecord = this.cleanRecord(record)

        await this.insertRecord(tableName, cleanRecord)
      }

      console.log(`Inserted ${records.length} records into ${tableName}`)

    } catch (error) {
      throw new Error(`Failed to restore table ${tableName}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 清理记录数据
   */
  private cleanRecord(record: any): any {
    const clean = { ...record }

    // 移除SQLite内部字段
    delete clean.rowid
    delete clean._rowid_

    return clean
  }

  /**
   * 插入记录到表
   */
  private async insertRecord(tableName: string, record: any) {
    const fields = Object.keys(record)
    const values = Object.values(record)
    const placeholders = fields.map(() => '?').join(', ')

    const sql = `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders})`

    await (db as any).execute(sql, values)
  }

  /**
   * 列出所有备份
   */
  async listBackups(): Promise<Array<{
    backupId: string
    fileName: string
    size: number
    createdAt: Date
    encrypted: boolean
  }>> {
    try {
      const files = await fs.readdir(this.BACKUP_DIR)
      const backups = []

      for (const file of files) {
        if (file.startsWith('backup_') && file.endsWith('.json')) {
          const filePath = path.join(this.BACKUP_DIR, file)
          const stats = await fs.stat(filePath)

          const backupId = file.replace(/^backup_/, '').replace(/\.json(\.enc)?$/, '')

          backups.push({
            backupId,
            fileName: file,
            size: stats.size,
            createdAt: stats.mtime,
            encrypted: file.endsWith('.enc'),
          })
        }
      }

      return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    } catch (error) {
      console.error('Failed to list backups:', error)
      return []
    }
  }

  /**
   * 删除备份
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    try {
      const backupFile = await this.findBackupFile(backupId)
      if (!backupFile) {
        return false
      }

      await fs.unlink(backupFile)
      console.log(`Deleted backup: ${backupId}`)
      return true

    } catch (error) {
      console.error(`Failed to delete backup ${backupId}:`, error)
      return false
    }
  }

  /**
   * 清理旧备份
   */
  async cleanupOldBackups(daysToKeep = 30): Promise<number> {
    try {
      const backups = await this.listBackups()
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000)

      let deletedCount = 0

      for (const backup of backups) {
        if (backup.createdAt < cutoffDate) {
          if (await this.deleteBackup(backup.backupId)) {
            deletedCount++
          }
        }
      }

      console.log(`Cleaned up ${deletedCount} old backups`)
      return deletedCount

    } catch (error) {
      console.error('Failed to cleanup old backups:', error)
      return 0
    }
  }

  /**
   * 验证备份完整性
   */
  async validateBackup(backupId: string): Promise<{
    valid: boolean
    errors: string[]
    metadata?: any
  }> {
    const errors: string[] = []

    try {
      const backupFile = await this.findBackupFile(backupId)
      if (!backupFile) {
        errors.push('Backup file not found')
        return { valid: false, errors }
      }

      // 读取并解析备份
      const fileContent = await fs.readFile(backupFile, 'utf8')
      let backupData

      if (backupFile.endsWith('.enc')) {
        const encryptedData = JSON.parse(fileContent)
        const decryptedBuffer = this.decryptData(encryptedData)
        backupData = JSON.parse(decryptedBuffer.toString('utf8'))
      } else {
        backupData = JSON.parse(fileContent)
      }

      // 验证基本结构
      if (!backupData.backupId) {
        errors.push('Missing backup ID')
      }

      if (!backupData.tables) {
        errors.push('Missing tables data')
      }

      if (!backupData.metadata) {
        errors.push('Missing metadata')
      }

      // 验证表数据
      if (backupData.tables) {
        for (const [tableName, tableData] of Object.entries(backupData.tables)) {
          if (typeof tableData !== 'object' || tableData === null) {
            errors.push(`Invalid data for table: ${tableName}`)
            continue
          }

          const data = tableData as any
          if (!Array.isArray(data.records)) {
            errors.push(`Invalid records format for table: ${tableName}`)
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        metadata: backupData.metadata,
      }

    } catch (error) {
      errors.push(`Failed to validate backup: ${error instanceof Error ? error.message : String(error)}`)
      return { valid: false, errors }
    }
  }
}

// 创建备份服务实例
export const backupService = new BackupService()

// 默认导出
export default backupService