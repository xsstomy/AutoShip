import React from 'react'
import ProtectedRoute from './ProtectedRoute'

interface AdminRouteProps {
  children: React.ReactNode
}

/**
 * 管理员路由组件
 * 包装 ProtectedRoute 进行认证检查，假设父级已经有 AuthProvider
 */
export default function AdminRoute({ children }: AdminRouteProps) {
  return (
    <ProtectedRoute>
      {children}
    </ProtectedRoute>
  )
}
