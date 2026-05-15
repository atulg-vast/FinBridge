import apiClient from './client'
import { useAuthStore } from '@/stores/authStore'

export interface Report {
  id: string
  company_id: string
  uploaded_by: string
  title: string
  original_filename: string
  created_at: string
}

export const reportsApi = {
  list: (companyId?: string) => {
    const params = companyId ? { company_id: companyId } : {}
    return apiClient.get<Report[]>('/reports', { params }).then((r) => r.data)
  },

  upload: (companyId: string, title: string, file: File) => {
    const form = new FormData()
    form.append('company_id', companyId)
    form.append('title', title)
    form.append('file', file)
    return apiClient
      .post<Report>('/reports/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },

  downloadUrl: (reportId: string) => {
    const token = useAuthStore.getState().token
    return `${apiClient.defaults.baseURL}/reports/${reportId}/download${token ? `?token=${token}` : ''}`
  },

  delete: (reportId: string) => apiClient.delete(`/reports/${reportId}`),
}
