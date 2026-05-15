import apiClient from './client'

export interface LineItem {
  id: string
  description: string | null
  hsn_code: string | null
  quantity: string | null
  unit_price: string | null
  amount: string | null
  tax_amount: string | null
}

export interface Transaction {
  id: string
  document_id: string
  company_id: string
  head_id: string | null
  sub_head_id: string | null
  party_name: string | null
  amount: string | null
  transaction_date: string | null
  description: string | null
  extracted_data: Record<string, unknown> | null
  confidence_score: string | null
  low_confidence_fields: string[] | null
  rejection_note: string | null
  status: 'pending_review' | 'accepted' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  line_items: LineItem[]
}

export interface TransactionUpdate {
  party_name?: string
  amount?: number
  transaction_date?: string
  description?: string
  head_id?: string | null
  sub_head_id?: string | null
}

export const transactionsApi = {
  list: (params?: { company_id?: string; document_id?: string; status?: string }) =>
    apiClient.get<Transaction[]>('/transactions', { params }).then((r) => r.data),

  get: (id: string) => apiClient.get<Transaction>(`/transactions/${id}`).then((r) => r.data),

  update: (id: string, payload: TransactionUpdate) =>
    apiClient.put<Transaction>(`/transactions/${id}`, payload).then((r) => r.data),

  accept: (id: string) =>
    apiClient.post<Transaction>(`/transactions/${id}/accept`).then((r) => r.data),

  reject: (id: string, rejection_note: string) =>
    apiClient.post<Transaction>(`/transactions/${id}/reject`, { rejection_note }).then((r) => r.data),
}
