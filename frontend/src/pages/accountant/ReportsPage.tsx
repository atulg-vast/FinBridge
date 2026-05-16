import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { reportsApi } from '@/api/reports'
import { companiesApi } from '@/api/companies'
import { useSetPageHeader } from '@/hooks/useSetPageHeader'
import { useAuthStore } from '@/stores/authStore'

function FileIcon({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return <span className="text-red-500">PDF</span>
  if (ext === 'xlsx' || ext === 'xls') return <span className="text-green-600">XLS</span>
  if (ext === 'csv') return <span className="text-blue-500">CSV</span>
  return <span className="text-gray-400">FILE</span>
}

export default function ReportsPage() {
  const { user } = useAuthStore()
  const firmId = user?.firm_id ?? ''
  const qc = useQueryClient()

  const [title, setTitle] = useState('')
  const [selectedCompany, setSelectedCompany] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const { data: companies = [] } = useQuery({
    queryKey: ['companies', firmId],
    queryFn: () => companiesApi.list(firmId),
    enabled: !!firmId,
  })

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: () => reportsApi.list(),
  })

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => { setSelectedFile(files[0]); setError('') },
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    multiple: false,
  })

  const uploadMutation = useMutation({
    mutationFn: () => reportsApi.upload(selectedCompany, title, selectedFile!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] })
      setTitle('')
      setSelectedCompany('')
      setSelectedFile(null)
      setSuccess('Report uploaded successfully.')
      setTimeout(() => setSuccess(''), 4000)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Upload failed')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reportsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!selectedFile) { setError('Please select a file'); return }
    if (!selectedCompany) { setError('Please select a company'); return }
    if (!title.trim()) { setError('Please enter a title'); return }
    uploadMutation.mutate()
  }

  useSetPageHeader('Reports', 'Upload MIS reports for your companies')

  return (
    <div className="p-8">

      {/* Upload form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 max-w-2xl">
        <h2 className="font-semibold text-gray-800 mb-4">Upload New Report</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select company...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Report Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. March 2025 MIS Report"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
              isDragActive ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
            }`}
          >
            <input {...getInputProps()} />
            {selectedFile ? (
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm font-medium text-gray-700">{selectedFile.name}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSelectedFile(null) }}
                  className="text-gray-400 hover:text-red-500 text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-500">{isDragActive ? 'Drop here' : 'Drag & drop or click to select'}</p>
                <p className="text-xs text-gray-400 mt-1">PDF, XLSX, XLS, CSV · Max 50 MB</p>
              </div>
            )}
          </div>

          {error && <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
          {success && <div className="text-green-700 text-sm bg-green-50 px-3 py-2 rounded-lg">{success}</div>}

          <button
            type="submit"
            disabled={uploadMutation.isPending}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium transition"
          >
            {uploadMutation.isPending ? 'Uploading...' : 'Upload Report'}
          </button>
        </form>
      </div>

      {/* Reports list */}
      <h2 className="font-semibold text-gray-900 mb-3">Uploaded Reports</h2>
      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
          <p className="font-medium">No reports uploaded yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Title</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">File</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Uploaded</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-xs font-bold">
                    <FileIcon filename={r.original_filename} />
                  </td>
                  <td className="px-5 py-3 font-medium text-gray-900">{r.title}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{r.original_filename}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-5 py-3 text-right flex items-center justify-end gap-3">
                    <a
                      href={reportsApi.downloadUrl(r.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Download
                    </a>
                    <button
                      onClick={() => { if (confirm(`Delete "${r.title}"?`)) deleteMutation.mutate(r.id) }}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Delete
                    </button>
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
