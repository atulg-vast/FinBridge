import apiClient from './client'

export interface AuditLog {
  id: string
  user_id: string
  company_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  meta: Record<string, unknown> | null
  created_at: string
  user_email: string | null
  user_name: string | null
  company_name: string | null
}

export interface AuditFilters {
  company_id?: string
  action?: string
  entity_type?: string
  date_from?: string
  date_to?: string
}

export const auditApi = {
  list: (filters: AuditFilters = {}) => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    return apiClient.get<AuditLog[]>('/audit-logs', { params }).then((r) => r.data)
  },
}
