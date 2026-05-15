import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { companiesApi, accountantsApi } from '@/api/companies'
import { dashboardApi, type AccountantSummary } from '@/api/dashboard'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

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

  const { data } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.summary,
  })
  const summary = data as AccountantSummary | undefined
  const tc = summary?.txn_counts ?? { pending_review: 0, accepted: 0, rejected: 0 }
  const companyStats = summary?.company_stats ?? []

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Firm Overview</h1>
      <p className="text-gray-500 text-sm mb-8">Manage your companies and team</p>

      {/* Top stats */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-3xl font-bold text-indigo-600">{companies.length}</div>
          <div className="text-sm text-gray-500 mt-1">Companies</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-3xl font-bold text-indigo-600">{accountants.length}</div>
          <div className="text-sm text-gray-500 mt-1">Accountants</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-3xl font-bold text-yellow-500">{tc.pending_review}</div>
          <div className="text-sm text-gray-500 mt-1">Pending Reviews</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-3xl font-bold text-green-600">{tc.accepted}</div>
          <div className="text-sm text-gray-500 mt-1">Accepted</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-3xl font-bold text-red-400">{tc.rejected}</div>
          <div className="text-sm text-gray-500 mt-1">Rejected</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Per-company bar chart */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Activity by Company</h2>
          {companyStats.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No companies yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={companyStats} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total_docs" name="Total Docs" fill="#e0e7ff" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending_review" name="Pending Review" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Companies list */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Companies</h2>
            <Link to="/firm/companies" className="text-sm text-indigo-600 hover:underline">View all →</Link>
          </div>
          {companies.length === 0 ? (
            <p className="text-gray-400 text-sm">
              No companies yet.{' '}
              <Link to="/firm/companies" className="text-indigo-600 hover:underline">Add one →</Link>
            </p>
          ) : (
            <div className="space-y-2">
              {companies.slice(0, 6).map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm font-medium text-gray-800">{c.name}</span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{c.business_type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
