import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

// 密码哈希配置
const SALT_ROUNDS = 12

// JWT配置
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const JWT_EXPIRES_IN = '8h' // 8小时过期

// 登录失败限制配置
const MAX_FAILED_ATTEMPTS = 5
const LOCK_TIME_MINUTES = 30
const FAILURE_WINDOW_MINUTES = 5

export interface AdminTokenPayload {
  adminId: number
  username: string
  email: string
  role: string
  sessionId: string
  iat?: number
  exp?: number
}

export interface PasswordValidationResult {
  isValid: boolean
  errors: string[]
}

/**
 * 密码哈希
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * 验证密码
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash)
}

/**
 * 生成JWT令牌
 */
export function generateToken(payload: Omit<AdminTokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  })
}

/**
 * 验证JWT令牌
 */
export function verifyToken(token: string): AdminTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AdminTokenPayload
  } catch (error) {
    return null
  }
}

/**
 * 生成会话ID
 */
export function generateSessionId(): string {
  return crypto.randomUUID()
}

/**
 * 生成密码重置令牌
 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * 验证密码强度
 */
export function validatePasswordStrength(password: string, username?: string): PasswordValidationResult {
  const errors: string[] = []

  // 最小长度
  if (password.length < 8) {
    errors.push('密码至少需要8个字符')
  }

  // 检查是否包含大写字母
  if (!/[A-Z]/.test(password)) {
    errors.push('密码需要包含至少一个大写字母')
  }

  // 检查是否包含小写字母
  if (!/[a-z]/.test(password)) {
    errors.push('密码需要包含至少一个小写字母')
  }

  // 检查是否包含数字
  if (!/\d/.test(password)) {
    errors.push('密码需要包含至少一个数字')
  }

  // 检查是否包含特殊字符
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('密码需要包含至少一个特殊字符')
  }

  // 检查是否与用户名相似
  if (username && password.toLowerCase().includes(username.toLowerCase())) {
    errors.push('密码不能包含用户名')
  }

  // 检查常见弱密码
  const weakPasswords = [
    'password',
    '123456',
    'qwerty',
    'admin',
    'letmein',
    'welcome',
    'monkey',
    '1234567890',
    'abc123',
    '111111',
  ]

  if (weakPasswords.includes(password.toLowerCase())) {
    errors.push('不能使用常见弱密码')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * 计算密码过期时间
 */
export function getPasswordExpiryDate(days: number = 90): Date {
  const expiryDate = new Date()
  expiryDate.setDate(expiryDate.getDate() + days)
  return expiryDate
}

/**
 * 检查密码是否过期
 */
export function isPasswordExpired(passwordChangedAt: string, maxDays: number = 90): boolean {
  const changedDate = new Date(passwordChangedAt)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - changedDate.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return diffDays > maxDays
}

/**
 * 生成安全令牌哈希
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * 验证令牌哈希
 */
export function verifyTokenHash(token: string, hash: string): boolean {
  const tokenHash = hashToken(token)
  return tokenHash === hash
}

/**
 * 生成加密密钥
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * 加密敏感数据
 */
export function encrypt(text: string, key: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

/**
 * 解密敏感数据
 */
export function decrypt(encryptedData: string, key: string): string {
  const [ivHex, encrypted] = encryptedData.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

/**
 * 获取客户端IP地址
 */
export function getClientIP(request: any): string {
  const forwarded = request.headers['x-forwarded-for']
  const ip = forwarded ? forwarded.split(',')[0] : request.ip
  return ip || request.connection.remoteAddress || 'unknown'
}

/**
 * 检查账户是否被锁定
 */
export function isAccountLocked(lockedUntil: string | null): boolean {
  if (!lockedUntil) return false
  const lockDate = new Date(lockedUntil)
  const now = new Date()
  return now < lockDate
}

/**
 * 获取锁定到期时间
 */
export function getLockExpiryDate(minutes: number = LOCK_TIME_MINUTES): string {
  const expiryDate = new Date()
  expiryDate.setMinutes(expiryDate.getMinutes() + minutes)
  return expiryDate.toISOString()
}

/**
 * 检查是否需要重置密码
 */
export function shouldForcePasswordReset(passwordChangedAt: string, maxDays: number = 90): boolean {
  return isPasswordExpired(passwordChangedAt, maxDays)
}

/**
 * 生成密码重置过期时间
 */
export function getResetTokenExpiry(minutes: number = 30): Date {
  const expiryDate = new Date()
  expiryDate.setMinutes(expiryDate.getMinutes() + minutes)
  return expiryDate
}

/**
 * 清理敏感数据（用于日志记录）
 */
export function sanitizeForLog(obj: any): any {
  const sensitiveFields = ['password', 'passwordHash', 'token', 'tokenHash', 'secret', 'key']
  const sanitized = { ...obj }

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]'
    }
  }

  return sanitized
}

/**
 * 生成CSRF令牌
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * 验证CSRF令牌
 */
export function verifyCSRFToken(token: string, sessionToken: string): boolean {
  return token === sessionToken
}
