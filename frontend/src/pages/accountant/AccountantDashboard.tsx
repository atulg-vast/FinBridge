import { useQuery } from '@tanstack/react-query'
import { useSetPageHeader } from '@/hooks/useSetPageHeader'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts'
import { dashboardApi, type AccountantSummary } from '@/api/dashboard'

const C = {
  indigo: '#4F46E5',
  emerald: '#10B981',
  amber: '#F59E0B',
  red: '#EF4444',
  purple: '#8B5CF6',
}

function StatCard({ label, value, color, sub }: {
  label: string; value: number | string; color: string; sub?: string
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
      <p className="font-semibold text-gray-700 mb-1 truncate max-w-[180px]">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-medium">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

const short = (name: string, max = 12) =>
  name.length > max ? name.slice(0, max - 1) + '…' : name

export default function AccountantDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.summary,
  })

  const summary = data as AccountantSummary | undefined

  if (isLoading) {
    return <div className="p-8 text-gray-400 text-sm">Loading dashboard…</div>
  }

  const tc = summary?.txn_counts ?? { pending_review: 0, accepted: 0, rejected: 0 }
  const companies = summary?.company_stats ?? []
  const monthly = summary?.monthly_spend ?? []
  const myReviews = summary?.my_monthly_reviews ?? []

  const totalReviewed = tc.accepted + tc.rejected
  const myAcceptRate = totalReviewed > 0
    ? Math.round((tc.accepted / totalReviewed) * 100)
    : null

  const companyChartData = companies.map(c => ({
    ...c,
    name: short(c.name),
  }))

  const acceptanceRateData = companies
    .filter(c => c.accepted + c.rejected > 0)
    .map(c => ({
      name: short(c.name),
      rate: Math.round((c.accepted / (c.accepted + c.rejected)) * 100),
      fullName: c.name,
    }))
    .sort((a, b) => b.rate - a.rate)

  const hasMonthlySpend = monthly.some(m => m.amount > 0)
  const hasMyReviews = myReviews.some(m => m.accepted > 0 || m.rejected > 0)

  useSetPageHeader('My Dashboard', 'Your review queue and performance across companies')

  return (
    <div className="p-8">

      {/* Stat cards */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <StatCard label="Pending Review" value={tc.pending_review} color="text-amber-500" />
        <StatCard
          label="Accepted" value={tc.accepted} color="text-emerald-600"
          sub={myAcceptRate !== null ? `${myAcceptRate}% acceptance rate` : undefined}
        />
        <StatCard label="Rejected" value={tc.rejected} color="text-red-400" />
        <StatCard label="Docs This Week" value={summary?.docs_this_week ?? 0} color="text-indigo-600" />
        <StatCard label="Reports Uploaded" value={summary?.reports_count ?? 0} color="text-purple-500" />
      </div>

      <div className="grid grid-cols-2 gap-6">

        {/* 1. Company full status breakdown */}
        <ChartCard
          title="Companies — Transaction Status"
          subtitle="Full accepted / pending / rejected breakdown per company"
        >
          {companyChartData.length === 0 ? (
            <div className="flex items-center justify-center h-56 text-gray-400 text-sm">No companies assigned</div>
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

        {/* 2. My monthly review activity */}
        <ChartCard
          title="My Review Activity — Last 6 Months"
          subtitle="Transactions I accepted and rejected each month"
        >
          {!hasMyReviews ? (
            <div className="flex items-center justify-center h-56 text-gray-400 text-sm">No reviews recorded yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={myReviews} margin={{ top: 4, right: 8, left: -10, bottom: 4 }}>
                <defs>
                  <linearGradient id="myAccGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.emerald} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={C.emerald} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="myRejGrad" x1="0" y1="0" x2="0" y2="1">
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
                  strokeWidth={2} fill="url(#myAccGrad)" dot={{ fill: C.emerald, r: 3 }} />
                <Area type="monotone" dataKey="rejected" name="Rejected" stroke={C.red}
                  strokeWidth={2} fill="url(#myRejGrad)" dot={{ fill: C.red, r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* 3. Monthly spend trend */}
        <ChartCard
          title="Monthly Spend — Accepted Transactions"
          subtitle="Total accepted spend across all my companies (INR)"
        >
          {!hasMonthlySpend ? (
            <div className="flex items-center justify-center h-56 text-gray-400 text-sm">No accepted transactions yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthly} margin={{ top: 4, right: 8, left: -10, bottom: 4 }}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.indigo} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={C.indigo} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B7280' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(0)}L` : `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Accepted Spend']}
                />
                <Area type="monotone" dataKey="amount" name="Spend" stroke={C.indigo}
                  strokeWidth={2} fill="url(#spendGrad)" dot={{ fill: C.indigo, r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* 4. Right column: acceptance rate + quick links */}
        <div className="flex flex-col gap-6">

          {/* Acceptance rate per company */}
          <ChartCard
            title="Acceptance Rate by Company"
            subtitle="% of reviewed transactions accepted — highlights data quality"
          >
            {acceptanceRateData.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-gray-400 text-sm">No reviewed transactions yet</div>
            ) : (
              <div className="space-y-3 pt-1">
                {acceptanceRateData.map((c) => (
                  <div key={c.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 font-medium truncate max-w-[160px]">{c.fullName}</span>
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

          {/* Quick links */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
            <h2 className="font-semibold text-gray-900">Quick Actions</h2>
            <Link
              to="/accountant/review"
              className="flex items-center justify-between p-3 rounded-lg bg-amber-50 hover:bg-amber-100 transition"
            >
              <span className="text-sm font-medium text-amber-800">Review Queue</span>
              <span className="text-lg font-bold text-amber-600">{tc.pending_review}</span>
            </Link>
            <Link
              to="/accountant/reports"
              className="flex items-center justify-between p-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition"
            >
              <span className="text-sm font-medium text-indigo-800">Upload Report</span>
              <span className="text-xs text-indigo-400">→</span>
            </Link>
          </div>

        </div>

      </div>
    </div>
  )
}
