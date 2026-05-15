import apiClient from './client'

export interface Company {
  id: string
  firm_id: string
  name: string
  business_type: string
  created_at: string
}

export interface CompanyCreatePayload {
  name: string
  business_type: string
  admin_full_name: string
  admin_email: string
}

export interface CompanyCreateResponse {
  company: Company
  admin_email: string
  admin_password: string
  message: string
}

export interface Accountant {
  id: string
  email: string
  full_name: string
  role: string
  created_at: string
}

export interface AccountantCreatePayload {
  full_name: string
  email: string
}

export interface AccountantCreateResponse {
  id: string
  email: string
  full_name: string
  role: string
  temp_password: string
  message: string
}

export const companiesApi = {
  list: (firmId: string) =>
    apiClient.get<Company[]>(`/firms/${firmId}/companies`).then((r) => r.data),
  create: (firmId: string, payload: CompanyCreatePayload) =>
    apiClient.post<CompanyCreateResponse>(`/firms/${firmId}/companies`, payload).then((r) => r.data),
}

export const accountantsApi = {
  list: (firmId: string) =>
    apiClient.get<Accountant[]>(`/firms/${firmId}/accountants`).then((r) => r.data),
  create: (firmId: string, payload: AccountantCreatePayload) =>
    apiClient.post<AccountantCreateResponse>(`/firms/${firmId}/accountants`, payload).then((r) => r.data),
}
