import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { ADMIN_API_URL } from '../config/api'

interface Admin {
  id: number
  username: string
  email: string
  role: string
}

interface AuthContextType {
  admin: Admin | null
  token: string | null
  loading: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  refreshToken: () => Promise<boolean>
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const API_BASE = `${ADMIN_API_URL}/auth`

  useEffect(() => {
    // 从localStorage恢复token
    const savedToken = localStorage.getItem('admin_token')
    if (savedToken) {
      setToken(savedToken)
      // 只有存在 token 时才检查认证状态
      checkAuth()
    } else {
      // 没有 token 直接结束加载（避免不必要的请求）
      setLoading(false)
    }
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch(`${API_BASE}/profile`, {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setAdmin(data.data.admin)
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (data.success) {
        setAdmin(data.data.admin)
        // 保存token到state和localStorage
        if (data.data.token) {
          setToken(data.data.token)
          localStorage.setItem('admin_token', data.data.token)
        }
        return true
      } else {
        throw new Error(data.error || '登录失败')
      }
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  }

  const logout = async (): Promise<void> => {
    try {
      await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      setAdmin(null)
      setToken(null)
      localStorage.removeItem('admin_token')
    }
  }

  const refreshToken = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/refresh`, {
        method: 'POST',
        credentials: 'include',
      })

      const data = await response.json()

      if (data.success) {
        return true
      }
      return false
    } catch (error) {
      console.error('Token refresh failed:', error)
      return false
    }
  }

  return (
    <AuthContext.Provider value={{ admin, token, loading, login, logout, refreshToken, checkAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
