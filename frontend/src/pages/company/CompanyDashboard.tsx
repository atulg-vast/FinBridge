import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useSetPageHeader } from '@/hooks/useSetPageHeader'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { dashboardApi, type CompanySummary } from '@/api/dashboard'

const PIE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6']

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  )
}

export default function CompanyDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.summary,
  })

  const summary = data as CompanySummary | undefined

  if (isLoading) {
    return <div className="p-8 text-gray-400 text-sm">Loading dashboard...</div>
  }

  const dc = summary?.doc_counts ?? { total: 0, pending: 0, extracted: 0, failed: 0 }
  const tc = summary?.txn_counts ?? { pending_review: 0, accepted: 0, rejected: 0 }
  const monthly = summary?.monthly_spend ?? []
  const heads = summary?.head_breakdown ?? []

  const txnPie = [
    { name: 'Pending Review', value: tc.pending_review },
    { name: 'Accepted', value: tc.accepted },
    { name: 'Rejected', value: tc.rejected },
  ].filter((d) => d.value > 0)

  useSetPageHeader('Company Dashboard', 'Overview of your financial documents and transactions')

  return (
    <div className="p-8">

      {/* Document stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Documents" value={dc.total} color="text-indigo-600" />
        <StatCard label="Pending / Processing" value={dc.pending} color="text-yellow-500" />
        <StatCard label="Extracted" value={dc.extracted} color="text-green-500" />
        <StatCard label="Failed" value={dc.failed} color="text-red-400" />
      </div>

      {/* Transaction stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Pending Review" value={tc.pending_review} color="text-yellow-500" />
        <StatCard label="Accepted Transactions" value={tc.accepted} color="text-green-600" />
        <StatCard label="Rejected Transactions" value={tc.rejected} color="text-red-400" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Monthly spend chart */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Monthly Spend (Accepted Transactions)</h2>
          {monthly.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              No accepted transactions yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthly}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [`INR ${Number(v).toLocaleString('en-IN')}`, 'Amount']} />
                <Area type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2} fill="url(#spendGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Transaction status pie / head breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          {heads.length > 0 ? (
            <>
              <h2 className="font-semibold text-gray-900 mb-4">Top Expense Heads</h2>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={heads} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={false}>
                    {heads.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `INR ${Number(v).toLocaleString('en-IN')}`} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </>
          ) : txnPie.length > 0 ? (
            <>
              <h2 className="font-semibold text-gray-900 mb-4">Transaction Status</h2>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={txnPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                    {txnPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm gap-2">
              <p>No transaction data yet</p>
              <Link to="/company/upload" className="text-indigo-600 hover:underline text-xs">Upload a document →</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
