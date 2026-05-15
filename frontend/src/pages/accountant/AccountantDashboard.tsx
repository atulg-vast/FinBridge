import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { transactionsApi } from '@/api/transactions'

export default function AccountantDashboard() {
  const { data: pending = [] } = useQuery({
    queryKey: ['transactions', { status: 'pending_review' }],
    queryFn: () => transactionsApi.list({ status: 'pending_review' }),
  })

  const { data: all = [] } = useQuery({
    queryKey: ['transactions', {}],
    queryFn: () => transactionsApi.list({}),
  })

  const accepted = all.filter((t) => t.status === 'accepted').length
  const rejected = all.filter((t) => t.status === 'rejected').length

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Accountant Dashboard</h1>
      <p className="text-gray-500 text-sm mb-8">Review AI-extracted transactions from your companies</p>

      <div className="grid grid-cols-3 gap-5 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-3xl font-bold text-yellow-500">{pending.length}</div>
          <div className="text-sm text-gray-500 mt-1">Pending Review</div>
          {pending.length > 0 && (
            <Link to="/accountant/review" className="text-xs text-indigo-600 hover:underline mt-2 block">
              Review now →
            </Link>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-3xl font-bold text-green-500">{accepted}</div>
          <div className="text-sm text-gray-500 mt-1">Accepted</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-3xl font-bold text-red-400">{rejected}</div>
          <div className="text-sm text-gray-500 mt-1">Rejected</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Pending Review</h2>
          <Link to="/accountant/review" className="text-sm text-indigo-600 hover:underline">View all →</Link>
        </div>
        {pending.length === 0 ? (
          <p className="text-gray-400 text-sm">All caught up! No transactions pending review.</p>
        ) : (
          <div className="space-y-2">
            {pending.slice(0, 6).map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <span className="text-sm font-medium text-gray-800">{t.party_name || '—'}</span>
                  {t.description && (
                    <span className="text-xs text-gray-400 ml-2">{t.description}</span>
                  )}
                </div>
                {t.amount && (
                  <span className="text-sm font-bold text-indigo-600">
                    INR {Number(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
