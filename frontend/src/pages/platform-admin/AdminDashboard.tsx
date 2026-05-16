import { useQuery } from '@tanstack/react-query'
import { dashboardApi, type PlatformSummary, type FirmStat } from '@/api/dashboard'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts'

const COLORS = {
  indigo: '#4F46E5',
  emerald: '#10B981',
  amber: '#F59E0B',
  red: '#EF4444',
  purple: '#8B5CF6',
  cyan: '#06B6D4',
}

const PIE_COLORS = [COLORS.emerald, COLORS.amber, COLORS.red]

function StatCard({ value, label, color = 'text-indigo-600' }: { value: number | string; label: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="mb-4">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

const fmtINR = (v: number) =>
  v >= 10000000 ? `₹${(v / 10000000).toFixed(1)}Cr`
  : v >= 100000 ? `₹${(v / 100000).toFixed(1)}L`
  : `₹${v.toLocaleString('en-IN')}`

const CustomTooltipBar = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <span className="font-medium">{p.value}</span></p>
      ))}
    </div>
  )
}

const CustomTooltipPie = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold" style={{ color: payload[0].payload.fill }}>{name}</p>
      <p className="text-gray-700">{value.toLocaleString()} transactions</p>
    </div>
  )
}

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null
  const RADIAN = Math.PI / 180
  const r = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export default function AdminDashboard() {
  const { data: summary } = useQuery({ queryKey: ['dashboard-summary'], queryFn: dashboardApi.summary })
  const { data: analytics, isLoading } = useQuery({ queryKey: ['firm-analytics'], queryFn: dashboardApi.firmAnalytics })

  const s = summary as PlatformSummary | undefined

  const txnPieData = analytics ? [
    { name: 'Accepted', value: analytics.txn_status.accepted },
    { name: 'Pending Review', value: analytics.txn_status.pending_review },
    { name: 'Rejected', value: analytics.txn_status.rejected },
  ].filter(d => d.value > 0) : []

  const firmBarData: (FirmStat & { name: string })[] = (analytics?.firm_stats ?? []).map(f => ({
    ...f,
    name: f.firm_name.length > 14 ? f.firm_name.slice(0, 13) + '…' : f.firm_name,
  }))

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Platform Overview</h1>
      <p className="text-gray-500 text-sm mb-8">Real-time health of FinBridge across all firms</p>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        <StatCard value={s?.firms ?? '—'} label="Accounting Firms" />
        <StatCard value={s?.companies ?? '—'} label="Total Companies" />
        <StatCard value={s?.users ?? '—'} label="Total Users" />
        <StatCard value={s?.documents ?? '—'} label="Documents Uploaded" color="text-purple-600" />
        <StatCard value={s?.transactions ?? '—'} label="Total Transactions" color="text-emerald-600" />
        <StatCard value={s?.pending_review ?? '—'} label="Pending Review" color="text-amber-600" />
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading charts…</div>
      ) : (
        <div className="grid grid-cols-2 gap-6">

          {/* Firm-wise: Companies & Users */}
          <ChartCard
            title="Firms — Companies & Users"
            subtitle="How many companies and users each firm manages"
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={firmBarData} margin={{ top: 4, right: 8, left: -10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} allowDecimals={false} />
                <Tooltip content={<CustomTooltipBar />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="companies" name="Companies" fill={COLORS.indigo} radius={[3, 3, 0, 0]} />
                <Bar dataKey="users" name="Users" fill={COLORS.cyan} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Transaction status donut */}
          <ChartCard
            title="Transaction Status"
            subtitle="Platform-wide accepted vs pending vs rejected"
          >
            {txnPieData.length === 0 ? (
              <div className="flex items-center justify-center h-[260px] text-gray-400 text-sm">No transactions yet</div>
            ) : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="55%" height={260}>
                  <PieChart>
                    <Pie
                      data={txnPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      dataKey="value"
                      labelLine={false}
                      label={renderCustomLabel}
                    >
                      {txnPieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltipPie />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-3 text-sm">
                  {txnPieData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: PIE_COLORS[i] }} />
                      <div>
                        <div className="font-medium text-gray-800">{d.value.toLocaleString()}</div>
                        <div className="text-xs text-gray-400">{d.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ChartCard>

          {/* Firm-wise pending vs accepted */}
          <ChartCard
            title="Firms — Pending vs Accepted"
            subtitle="Review workload distribution across firms"
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={firmBarData} margin={{ top: 4, right: 8, left: -10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} allowDecimals={false} />
                <Tooltip content={<CustomTooltipBar />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="accepted" name="Accepted" fill={COLORS.emerald} radius={[3, 3, 0, 0]} />
                <Bar dataKey="pending_review" name="Pending Review" fill={COLORS.amber} radius={[3, 3, 0, 0]} />
                <Bar dataKey="rejected" name="Rejected" fill={COLORS.red} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Monthly document uploads */}
          <ChartCard
            title="Document Uploads — Last 6 Months"
            subtitle="Platform-wide monthly upload volume"
          >
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={analytics?.monthly_docs ?? []} margin={{ top: 4, right: 8, left: -10, bottom: 4 }}>
                <defs>
                  <linearGradient id="docGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.purple} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={COLORS.purple} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B7280' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} allowDecimals={false} />
                <Tooltip
                  content={({ active, payload, label }: any) =>
                    active && payload?.length ? (
                      <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
                        <p className="font-semibold text-gray-700">{label}</p>
                        <p className="text-purple-600 font-medium">{payload[0].value} documents</p>
                      </div>
                    ) : null
                  }
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Documents"
                  stroke={COLORS.purple}
                  strokeWidth={2}
                  fill="url(#docGrad)"
                  dot={{ fill: COLORS.purple, r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

        </div>
      )}
    </div>
  )
}
