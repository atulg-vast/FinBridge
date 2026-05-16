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

export interface CompanyStat {
  id: string
  name: string
  business_type: string
  pending_review: number
  accepted: number
  rejected: number
  total_docs: number
}

export interface AccountantSummary {
  role: 'accountant'
  txn_counts: { pending_review: number; accepted: number; rejected: number }
  docs_this_week: number
  reports_count: number
  company_stats: CompanyStat[]
  monthly_spend: MonthlySpend[]
  my_monthly_reviews: { month: string; accepted: number; rejected: number }[]
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

export interface FirmStat {
  firm_id: string
  firm_name: string
  companies: number
  users: number
  documents: number
  pending_review: number
  accepted: number
  rejected: number
}

export interface FirmAnalytics {
  firm_stats: FirmStat[]
  txn_status: { pending_review: number; accepted: number; rejected: number }
  monthly_docs: { month: string; count: number }[]
}

export interface AccountantStat {
  accountant_id: string
  name: string
  role: string
  accepted: number
  rejected: number
  total_reviewed: number
  acceptance_rate: number | null
}

export interface FirmReviewAnalytics {
  accountant_stats: AccountantStat[]
  monthly_reviews: { month: string; accepted: number; rejected: number }[]
}

export const dashboardApi = {
  summary: () => apiClient.get<DashboardSummary>('/dashboard/summary').then((r) => r.data),
  firmAnalytics: () => apiClient.get<FirmAnalytics>('/dashboard/platform/firm-analytics').then((r) => r.data),
  firmReviewAnalytics: () => apiClient.get<FirmReviewAnalytics>('/dashboard/firm/analytics').then((r) => r.data),
}
