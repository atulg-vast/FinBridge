import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts'
import { dashboardApi, type AccountantSummary } from '@/api/dashboard'

function StatCard({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

export default function AccountantDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.summary,
  })

  const summary = data as AccountantSummary | undefined

  if (isLoading) {
    return <div className="p-8 text-gray-400 text-sm">Loading dashboard...</div>
  }

  const tc = summary?.txn_counts ?? { pending_review: 0, accepted: 0, rejected: 0 }
  const companies = summary?.company_stats ?? []
  const monthly = summary?.monthly_spend ?? []

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Accountant Dashboard</h1>
      <p className="text-gray-500 text-sm mb-8">Review queue and activity across your companies</p>

      {/* Stat cards */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <StatCard label="Pending Review" value={tc.pending_review} color="text-yellow-500" />
        <StatCard label="Accepted" value={tc.accepted} color="text-green-600" />
        <StatCard label="Rejected" value={tc.rejected} color="text-red-400" />
        <StatCard label="Docs This Week" value={summary?.docs_this_week ?? 0} color="text-indigo-600" />
        <StatCard label="Reports Uploaded" value={summary?.reports_count ?? 0} color="text-purple-500" />
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Monthly spend */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Monthly Spend Across Companies</h2>
          {monthly.length === 0 || monthly.every((m) => m.amount === 0) ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              No accepted transactions yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthly}>
                <defs>
                  <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [`INR ${Number(v).toLocaleString('en-IN')}`, 'Amount']} />
                <Area type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2} fill="url(#aGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Quick links */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
          <h2 className="font-semibold text-gray-900">Quick Links</h2>
          <Link to="/accountant/review" className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 hover:bg-yellow-100 transition">
            <span className="text-sm font-medium text-yellow-800">Review Queue</span>
            <span className="text-lg font-bold text-yellow-600">{tc.pending_review}</span>
          </Link>
          <Link to="/accountant/reports" className="flex items-center justify-between p-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition">
            <span className="text-sm font-medium text-indigo-800">Upload Report</span>
            <span className="text-xs text-indigo-400">→</span>
          </Link>
        </div>
      </div>

      {/* Per-company bar chart */}
      {companies.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Pending Reviews by Company</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={companies} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="pending_review" name="Pending Review" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="total_docs" name="Total Docs" fill="#e0e7ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
