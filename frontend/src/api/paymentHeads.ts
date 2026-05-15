import apiClient from './client'

export interface SubHead {
  id: string
  head_id: string
  company_id: string
  name: string
  created_at: string
}

export interface PaymentHead {
  id: string
  company_id: string
  name: string
  created_at: string
  sub_heads: SubHead[]
}

export const paymentHeadsApi = {
  list: (companyId: string) =>
    apiClient.get<PaymentHead[]>(`/companies/${companyId}/payment-heads`).then((r) => r.data),

  createHead: (companyId: string, name: string) =>
    apiClient.post<PaymentHead>(`/companies/${companyId}/payment-heads`, { name }).then((r) => r.data),

  deleteHead: (companyId: string, headId: string) =>
    apiClient.delete(`/companies/${companyId}/payment-heads/${headId}`),

  createSubHead: (companyId: string, headId: string, name: string) =>
    apiClient
      .post<SubHead>(`/companies/${companyId}/payment-heads/${headId}/sub-heads`, { name })
      .then((r) => r.data),

  deleteSubHead: (companyId: string, headId: string, subId: string) =>
    apiClient.delete(`/companies/${companyId}/payment-heads/${headId}/sub-heads/${subId}`),

  applyPreset: (companyId: string) =>
    apiClient.post(`/companies/${companyId}/payment-heads/apply-preset`).then((r) => r.data),
}
