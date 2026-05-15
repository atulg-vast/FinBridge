import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '@/api/reports'

function FileIcon({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return <span className="text-red-500 font-bold text-xs">PDF</span>
  if (ext === 'xlsx' || ext === 'xls') return <span className="text-green-600 font-bold text-xs">XLS</span>
  if (ext === 'csv') return <span className="text-blue-500 font-bold text-xs">CSV</span>
  return <span className="text-gray-400 font-bold text-xs">FILE</span>
}

export default function ReportsPage() {
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: () => reportsApi.list(),
  })

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Reports</h1>
      <p className="text-gray-500 text-sm mb-8">MIS reports shared by your accounting firm</p>

      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
          <p className="font-medium text-gray-500">No reports available yet</p>
          <p className="text-sm mt-1">Your accountant will upload reports here</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Title</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">File</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Date</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <FileIcon filename={r.original_filename} />
                  </td>
                  <td className="px-5 py-3 font-medium text-gray-900">{r.title}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{r.original_filename}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {new Date(r.created_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <a
                      href={reportsApi.downloadUrl(r.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:underline font-medium"
                    >
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
