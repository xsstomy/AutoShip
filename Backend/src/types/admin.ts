import { Context } from 'hono'

export interface AdminUser {
  id: number
  username: string
  email: string
  role: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface AdminAuth {
  associatedId: string
  permissions?: string[]
}

export interface Variables {
  admin: AdminUser
  adminAuth: AdminAuth
  sessionId: string
}

export type AppContext = Context<{ Variables: Variables }>