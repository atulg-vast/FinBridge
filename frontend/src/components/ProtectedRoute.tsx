import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { getRoleRedirect } from '@/lib/utils'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: string[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to={getRoleRedirect(user.role)} replace />
  }

  return <>{children}</>
}
