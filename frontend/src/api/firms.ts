import apiClient from './client'

export interface Firm {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface FirmCreatePayload {
  name: string
  admin_full_name: string
  admin_email: string
}

export interface FirmCreateResponse {
  firm: Firm
  admin_email: string
  admin_password: string
  message: string
}

export const firmsApi = {
  list: () => apiClient.get<Firm[]>('/firms').then((r) => r.data),
  create: (payload: FirmCreatePayload) =>
    apiClient.post<FirmCreateResponse>('/firms', payload).then((r) => r.data),
  get: (id: string) => apiClient.get<Firm>(`/firms/${id}`).then((r) => r.data),
}
