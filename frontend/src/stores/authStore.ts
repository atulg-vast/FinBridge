import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { jwtDecode } from 'jwt-decode'

interface JwtPayload {
  sub: string
  email: string
  full_name: string
  role: string
  firm_id: string | null
  company_id: string | null
  exp: number
}

interface AuthState {
  token: string | null
  user: JwtPayload | null
  setToken: (token: string) => void
  logout: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,

      setToken: (token: string) => {
        try {
          const decoded = jwtDecode<JwtPayload>(token)
          set({ token, user: decoded })
        } catch {
          set({ token: null, user: null })
        }
      },

      logout: () => {
        set({ token: null, user: null })
        localStorage.removeItem('token')
      },

      isAuthenticated: () => {
        const { token, user } = get()
        if (!token || !user) return false
        return user.exp * 1000 > Date.now()
      },
    }),
    { name: 'auth-storage', partialize: (s) => ({ token: s.token, user: s.user }) }
  )
)
