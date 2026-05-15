import apiClient from './client'

export interface MonthlySpend {
  month: string
  amount: number
}

export interface HeadBreakdown {
  name: string
  amount: number
}

export interface CompanySummary {
  role: 'company'
  doc_counts: { total: number; pending: number; extracted: number; failed: number }
  txn_counts: { pending_review: number; accepted: number; rejected: number }
  monthly_spend: MonthlySpend[]
  head_breakdown: HeadBreakdown[]
}

export interface AccountantSummary {
  role: 'accountant'
  txn_counts: { pending_review: number; accepted: number; rejected: number }
  docs_this_week: number
  reports_count: number
  company_stats: { id: string; name: string; business_type: string; pending_review: number; total_docs: number }[]
  monthly_spend: MonthlySpend[]
}

export interface PlatformSummary {
  role: 'platform_admin'
  firms: number
  companies: number
  users: number
  documents: number
  transactions: number
  pending_review: number
}

export type DashboardSummary = CompanySummary | AccountantSummary | PlatformSummary

export const dashboardApi = {
  summary: () => apiClient.get<DashboardSummary>('/dashboard/summary').then((r) => r.data),
}
