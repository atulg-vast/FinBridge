import apiClient from './client'

export interface LoginPayload {
  email: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface MeResponse {
  id: string
  email: string
  full_name: string
  role: string
  firm_id: string | null
  company_id: string | null
  is_active: boolean
}

export const authApi = {
  login: (payload: LoginPayload) =>
    apiClient.post<TokenResponse>('/auth/login', payload).then((r) => r.data),

  me: () =>
    apiClient.get<MeResponse>('/auth/me').then((r) => r.data),

  logout: () =>
    apiClient.post('/auth/logout'),
}
