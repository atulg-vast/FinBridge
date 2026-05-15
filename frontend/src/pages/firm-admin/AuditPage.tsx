import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { auditApi, type AuditFilters } from '@/api/audit'
import { companiesApi } from '@/api/companies'

const ACTION_LABELS: Record<string, string> = {
  document_uploaded: 'Document Uploaded',
  document_extracted: 'AI Extraction Complete',
  transaction_accepted: 'Transaction Accepted',
  transaction_rejected: 'Transaction Rejected',
  report_uploaded: 'Report Uploaded',
}

const ACTION_COLORS: Record<string, string> = {
  document_uploaded: 'bg-blue-100 text-blue-700',
  document_extracted: 'bg-purple-100 text-purple-700',
  transaction_accepted: 'bg-green-100 text-green-700',
  transaction_rejected: 'bg-red-100 text-red-700',
  report_uploaded: 'bg-indigo-100 text-indigo-700',
}

function timeStr(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AuditPage() {
  const { user } = useAuthStore()
  const firmId = user?.firm_id ?? ''

  const [filters, setFilters] = useState<AuditFilters>({})
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: companies = [] } = useQuery({
    queryKey: ['companies', firmId],
    queryFn: () => companiesApi.list(firmId),
    enabled: !!firmId,
  })

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => auditApi.list(filters),
  })

  function setFilter(key: keyof AuditFilters, value: string) {
    setFilters((f) => ({ ...f, [key]: value || undefined }))
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Audit Trail</h1>
      <p className="text-gray-500 text-sm mb-6">Full activity log across your companies</p>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap gap-3">
        <select
          value={filters.company_id ?? ''}
          onChange={(e) => setFilter('company_id', e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={filters.action ?? ''}
          onChange={(e) => setFilter('action', e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Actions</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          value={filters.entity_type ?? ''}
          onChange={(e) => setFilter('entity_type', e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Types</option>
          <option value="document">Document</option>
          <option value="transaction">Transaction</option>
          <option value="report">Report</option>
        </select>

        <input
          type="date"
          value={filters.date_from ?? ''}
          onChange={(e) => setFilter('date_from', e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="From date"
        />
        <input
          type="date"
          value={filters.date_to ?? ''}
          onChange={(e) => setFilter('date_to', e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="To date"
        />

        {Object.keys(filters).length > 0 && (
          <button
            onClick={() => setFilters({})}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 transition"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
          <p className="font-medium text-gray-500">No audit entries found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Timestamp</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">User</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Action</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Company</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Entity</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <>
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {timeStr(log.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-xs font-medium text-gray-800">{log.user_name || '—'}</div>
                      <div className="text-xs text-gray-400">{log.user_email}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-600">{log.company_name || '—'}</td>
                    <td className="px-5 py-3 text-xs text-gray-400">{log.entity_type}</td>
                    <td className="px-5 py-3 text-right">
                      {log.meta && Object.keys(log.meta).length > 0 && (
                        <button
                          onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                          className="text-xs text-indigo-500 hover:text-indigo-700"
                        >
                          {expanded === log.id ? 'Hide' : 'Details'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded === log.id && log.meta && (
                    <tr key={`${log.id}-detail`} className="bg-indigo-50/30">
                      <td colSpan={6} className="px-5 py-3">
                        <div className="flex flex-wrap gap-4">
                          {Object.entries(log.meta).map(([k, v]) => (
                            <div key={k}>
                              <span className="text-xs text-gray-400 uppercase tracking-wide">{k}</span>
                              <div className="text-xs font-medium text-gray-700 mt-0.5">{String(v)}</div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
            Showing {logs.length} entries (max 100)
          </div>
        </div>
      )}
    </div>
  )
}
