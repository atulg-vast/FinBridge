import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { companiesApi, accountantsApi } from '@/api/companies'
import { dashboardApi, type AccountantSummary, type FirmReviewAnalytics } from '@/api/dashboard'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, Cell,
} from 'recharts'

const C = {
  indigo: '#4F46E5',
  emerald: '#10B981',
  amber: '#F59E0B',
  red: '#EF4444',
  cyan: '#06B6D4',
  purple: '#8B5CF6',
  slate: '#94A3B8',
}

function StatCard({ value, label, color = 'text-indigo-600', sub }: {
  value: number | string; label: string; color?: string; sub?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

function ChartCard({ title, subtitle, children, className = '' }: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 ${className}`}>
      <div className="mb-4">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1 truncate max-w-[160px]">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-medium">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

// Shorten name to fit chart axis
const short = (name: string, max = 12) =>
  name.length > max ? name.slice(0, max - 1) + '…' : name

export default function FirmDashboard() {
  const { user } = useAuthStore()
  const firmId = user?.firm_id ?? ''

  const { data: companies = [] } = useQuery({
    queryKey: ['companies', firmId],
    queryFn: () => companiesApi.list(firmId),
    enabled: !!firmId,
  })

  const { data: accountants = [] } = useQuery({
    queryKey: ['accountants', firmId],
    queryFn: () => accountantsApi.list(firmId),
    enabled: !!firmId,
  })

  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.summary })
  const summary = data as AccountantSummary | undefined
  const tc = summary?.txn_counts ?? { pending_review: 0, accepted: 0, rejected: 0 }
  const companyStats = summary?.company_stats ?? []

  const { data: firmAnalytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['firm-review-analytics'],
    queryFn: dashboardApi.firmReviewAnalytics,
  })
  const fa = firmAnalytics as FirmReviewAnalytics | undefined

  // Acceptance rate per company for horizontal bar
  const acceptanceRateData = companyStats
    .filter(c => c.accepted + c.rejected > 0)
    .map(c => ({
      name: short(c.name),
      rate: Math.round((c.accepted / (c.accepted + c.rejected)) * 100),
      fullName: c.name,
    }))
    .sort((a, b) => b.rate - a.rate)

  const companyChartData = companyStats.map(c => ({
    ...c,
    name: short(c.name),
  }))

  const accountantChartData = (fa?.accountant_stats ?? []).map(a => ({
    ...a,
    name: short(a.name, 14),
  }))

  const totalReviewed = tc.accepted + tc.rejected
  const firmAcceptRate = totalReviewed > 0
    ? Math.round((tc.accepted / totalReviewed) * 100)
    : null

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Firm Overview</h1>
      <p className="text-gray-500 text-sm mb-8">Company performance and team productivity at a glance</p>

      {/* Stat cards */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <StatCard value={companies.length} label="Companies" />
        <StatCard value={accountants.length} label="Accountants" />
        <StatCard value={tc.pending_review} label="Pending Review" color="text-amber-500" />
        <StatCard value={tc.accepted} label="Accepted" color="text-emerald-600"
          sub={firmAcceptRate !== null ? `${firmAcceptRate}% acceptance rate` : undefined} />
        <StatCard value={tc.rejected} label="Rejected" color="text-red-400" />
      </div>

      {analyticsLoading ? (
        <div className="text-gray-400 text-sm">Loading charts…</div>
      ) : (
        <div className="grid grid-cols-2 gap-6">

          {/* 1. Company full status breakdown */}
          <ChartCard
            title="Company Transaction Status"
            subtitle="Accepted, pending, and rejected per company"
          >
            {companyChartData.length === 0 ? (
              <div className="flex items-center justify-center h-56 text-gray-400 text-sm">No companies yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={companyChartData} margin={{ top: 4, right: 8, left: -10, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="accepted" name="Accepted" fill={C.emerald} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="pending_review" name="Pending" fill={C.amber} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="rejected" name="Rejected" fill={C.red} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* 2. Accountant review performance */}
          <ChartCard
            title="Accountant Review Performance"
            subtitle="Transactions reviewed per team member — accepted vs rejected"
          >
            {accountantChartData.length === 0 || accountantChartData.every(a => a.total_reviewed === 0) ? (
              <div className="flex items-center justify-center h-56 text-gray-400 text-sm">No reviews recorded yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={accountantChartData} margin={{ top: 4, right: 8, left: -10, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload, label }: any) => {
                      if (!active || !payload?.length) return null
                      const d = accountantChartData.find(a => a.name === label)
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
                          <p className="font-semibold text-gray-700 mb-1">{d?.name ?? label}</p>
                          {payload.map((p: any) => (
                            <p key={p.name} style={{ color: p.color }}>
                              {p.name}: <span className="font-medium">{p.value}</span>
                            </p>
                          ))}
                          {d?.acceptance_rate !== null && d?.acceptance_rate !== undefined && (
                            <p className="text-gray-500 mt-1">
                              Acceptance rate: <span className="font-medium text-emerald-600">{d.acceptance_rate}%</span>
                            </p>
                          )}
                        </div>
                      )
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="accepted" name="Accepted" fill={C.emerald} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="rejected" name="Rejected" fill={C.red} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* 3. Monthly firm-wide review throughput */}
          <ChartCard
            title="Monthly Review Activity"
            subtitle="Firm-wide accepted and rejected transactions over last 6 months"
          >
            {(fa?.monthly_reviews ?? []).every(m => m.accepted === 0 && m.rejected === 0) ? (
              <div className="flex items-center justify-center h-56 text-gray-400 text-sm">No review activity yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={fa?.monthly_reviews ?? []} margin={{ top: 4, right: 8, left: -10, bottom: 4 }}>
                  <defs>
                    <linearGradient id="accGradFirm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.emerald} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={C.emerald} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="rejGradFirm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.red} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={C.red} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B7280' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="accepted" name="Accepted" stroke={C.emerald}
                    strokeWidth={2} fill="url(#accGradFirm)" dot={{ fill: C.emerald, r: 3 }} />
                  <Area type="monotone" dataKey="rejected" name="Rejected" stroke={C.red}
                    strokeWidth={2} fill="url(#rejGradFirm)" dot={{ fill: C.red, r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* 4. Company acceptance rate + document volume */}
          <div className="flex flex-col gap-6">

            {/* Acceptance rate — horizontal bars */}
            <ChartCard
              title="Company Acceptance Rate"
              subtitle="% of reviewed transactions accepted — reflects data quality"
            >
              {acceptanceRateData.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-gray-400 text-sm">No reviewed transactions yet</div>
              ) : (
                <div className="space-y-3 pt-1">
                  {acceptanceRateData.map((c) => (
                    <div key={c.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600 font-medium truncate max-w-[140px]">{c.fullName}</span>
                        <span className={`font-semibold ${c.rate >= 80 ? 'text-emerald-600' : c.rate >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                          {c.rate}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${c.rate >= 80 ? 'bg-emerald-500' : c.rate >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${c.rate}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>

            {/* Document volume per company */}
            <ChartCard
              title="Document Volume by Company"
              subtitle="Total documents uploaded per company"
            >
              {companyChartData.length === 0 ? (
                <div className="flex items-center justify-center h-20 text-gray-400 text-sm">No companies yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={companyChartData} margin={{ top: 4, right: 8, left: -10, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total_docs" name="Documents" radius={[3, 3, 0, 0]}>
                      {companyChartData.map((_, i) => (
                        <Cell key={i} fill={[C.indigo, C.cyan, C.purple, C.emerald, C.amber][i % 5]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

          </div>

        </div>
      )}

      {/* Quick nav */}
      <div className="mt-6 flex gap-3">
        <Link to="/firm/companies"
          className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-medium rounded-lg transition">
          Manage Companies →
        </Link>
        <Link to="/firm/audit"
          className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-medium rounded-lg transition">
          Audit Trail →
        </Link>
      </div>
    </div>
  )
}
