import { useQuery } from '@tanstack/react-query'
import { firmsApi } from '@/api/firms'
import { Link } from 'react-router-dom'

export default function AdminDashboard() {
  const { data: firms = [] } = useQuery({ queryKey: ['firms'], queryFn: firmsApi.list })

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Platform Overview</h1>
      <p className="text-gray-500 text-sm mb-8">Manage accounting firms on FinBridge</p>

      <div className="grid grid-cols-3 gap-5 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-3xl font-bold text-indigo-600">{firms.length}</div>
          <div className="text-sm text-gray-500 mt-1">Accounting Firms</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-3xl font-bold text-gray-300">—</div>
          <div className="text-sm text-gray-500 mt-1">Total Companies</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-3xl font-bold text-gray-300">—</div>
          <div className="text-sm text-gray-500 mt-1">Total Users</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Recent Firms</h2>
          <Link to="/admin/firms" className="text-sm text-indigo-600 hover:underline">View all →</Link>
        </div>
        {firms.length === 0 ? (
          <p className="text-gray-400 text-sm">No firms yet. <Link to="/admin/firms" className="text-indigo-600 hover:underline">Add one →</Link></p>
        ) : (
          <div className="space-y-2">
            {firms.slice(0, 5).map((f) => (
              <div key={f.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm font-medium text-gray-800">{f.name}</span>
                <span className="text-xs text-gray-400">{new Date(f.created_at).toLocaleDateString('en-IN')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
