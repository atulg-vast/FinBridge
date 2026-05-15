import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { documentsApi } from '@/api/documents'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  extracted: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}

export default function CompanyDashboard() {
  const { user } = useAuthStore()
  const companyId = user?.company_id ?? ''

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', companyId],
    queryFn: () => documentsApi.list(companyId),
    enabled: !!companyId,
  })

  const counts = {
    total: documents.length,
    pending: documents.filter((d) => d.status === 'pending' || d.status === 'processing').length,
    extracted: documents.filter((d) => d.status === 'extracted').length,
    failed: documents.filter((d) => d.status === 'failed').length,
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Company Dashboard</h1>
      <p className="text-gray-500 text-sm mb-8">Overview of your financial documents</p>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-3xl font-bold text-indigo-600">{counts.total}</div>
          <div className="text-sm text-gray-500 mt-1">Total Documents</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-3xl font-bold text-yellow-500">{counts.pending}</div>
          <div className="text-sm text-gray-500 mt-1">Pending / Processing</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-3xl font-bold text-green-500">{counts.extracted}</div>
          <div className="text-sm text-gray-500 mt-1">Extracted</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-3xl font-bold text-red-400">{counts.failed}</div>
          <div className="text-sm text-gray-500 mt-1">Failed</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Recent Documents</h2>
          <Link to="/company/upload" className="text-sm text-indigo-600 hover:underline">Upload new →</Link>
        </div>
        {documents.length === 0 ? (
          <p className="text-gray-400 text-sm">
            No documents yet. <Link to="/company/upload" className="text-indigo-600 hover:underline">Upload your first document →</Link>
          </p>
        ) : (
          <div className="space-y-2">
            {documents.slice(0, 6).map((doc) => (
              <div key={doc.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <span className="text-sm font-medium text-gray-800">{doc.original_filename}</span>
                  <span className="text-xs text-gray-400 ml-2">{doc.document_type?.name}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[doc.status]}`}>{doc.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
