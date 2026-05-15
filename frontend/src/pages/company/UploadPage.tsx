import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { documentsApi } from '@/api/documents'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  extracted: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}

export default function UploadPage() {
  const { user } = useAuthStore()
  const companyId = user?.company_id ?? ''
  const qc = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents', companyId] }),
  })

  const [selectedType, setSelectedType] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')

  const { data: docTypes = [] } = useQuery({
    queryKey: ['document-types'],
    queryFn: documentsApi.listTypes,
  })

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents', companyId],
    queryFn: () => documentsApi.list(companyId),
    enabled: !!companyId,
    refetchInterval: (query) => {
      const docs = query.state.data as typeof documents | undefined
      const hasProcessing = docs?.some((d) => d.status === 'pending' || d.status === 'processing')
      return hasProcessing ? 3000 : false
    },
  })

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!selectedType) { setUploadError('Please select a document type first'); return }
      if (!companyId) return
      const file = acceptedFiles[0]
      if (!file) return

      setUploading(true)
      setUploadError('')
      setUploadSuccess('')
      setUploadProgress(0)

      try {
        await documentsApi.upload(companyId, selectedType, file, setUploadProgress)
        qc.invalidateQueries({ queryKey: ['documents', companyId] })
        setUploadSuccess(`"${file.name}" uploaded successfully. AI extraction will start shortly.`)
        setUploadProgress(0)
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        setUploadError(msg || 'Upload failed. Please try again.')
      } finally {
        setUploading(false)
      }
    },
    [selectedType, companyId, qc]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png'], 'application/pdf': ['.pdf'] },
    multiple: false,
    disabled: uploading,
  })

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Upload Documents</h1>
      <p className="text-gray-500 text-sm mb-8">Upload financial documents for AI-powered extraction</p>

      <div className="max-w-2xl">
        {/* Step 1: Select document type */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">1. Select document type</h2>
          <div className="grid grid-cols-2 gap-2">
            {docTypes.map((dt) => (
              <button
                key={dt.id}
                onClick={() => { setSelectedType(dt.slug); setUploadError('') }}
                className={`text-left px-4 py-3 rounded-lg border text-sm transition ${
                  selectedType === dt.slug
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                    : 'border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium">{dt.name}</div>
                {dt.description && (
                  <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{dt.description}</div>
                )}
              </button>
            ))}
            {docTypes.length === 0 && (
              <p className="text-gray-400 text-sm col-span-2">Loading document types...</p>
            )}
          </div>
        </div>

        {/* Step 2: Drop zone */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">2. Upload file</h2>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${
              isDragActive
                ? 'border-indigo-400 bg-indigo-50'
                : uploading
                ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                : selectedType
                ? 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
                : 'border-gray-200 opacity-60 cursor-not-allowed'
            }`}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <div>
                <div className="text-gray-600 text-sm mb-3">Uploading...</div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-1">{uploadProgress}%</div>
              </div>
            ) : isDragActive ? (
              <p className="text-indigo-600 text-sm font-medium">Drop the file here</p>
            ) : (
              <div>
                <div className="text-3xl mb-3">📄</div>
                <p className="text-gray-600 text-sm font-medium">
                  {selectedType ? 'Drag & drop or click to select' : 'Select a document type first'}
                </p>
                <p className="text-gray-400 text-xs mt-1">Supports PDF, JPG, PNG · Max 20 MB</p>
              </div>
            )}
          </div>

          {uploadError && (
            <div className="mt-3 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{uploadError}</div>
          )}
          {uploadSuccess && (
            <div className="mt-3 text-green-700 text-sm bg-green-50 px-3 py-2 rounded-lg">{uploadSuccess}</div>
          )}
        </div>
      </div>

      {/* Recent uploads */}
      <div className="max-w-3xl">
        <h2 className="font-semibold text-gray-900 mb-3">Recent Uploads</h2>
        {isLoading ? (
          <div className="text-gray-400 text-sm">Loading...</div>
        ) : documents.length === 0 ? (
          <div className="text-gray-400 text-sm">No documents uploaded yet.</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">File</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Type</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Uploaded</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900 max-w-xs truncate">
                    <Link to={`/company/documents/${doc.id}`} className="hover:text-indigo-600 hover:underline">
                      {doc.original_filename}
                    </Link>
                  </td>
                    <td className="px-5 py-3 text-gray-500">{doc.document_type?.name ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[doc.status]}`}>
                        {doc.status}
                        {(doc.status === 'pending' || doc.status === 'processing') && (
                          <span className="ml-1 animate-pulse">•</span>
                        )}
                      </span>
                      {doc.status === 'failed' && doc.error_reason && (
                        <div className="text-xs text-red-500 mt-0.5 max-w-xs truncate">{doc.error_reason}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{new Date(doc.created_at).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${doc.original_filename}"?`)) deleteMutation.mutate(doc.id)
                        }}
                        className="text-xs text-red-400 hover:text-red-600 transition"
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
    </div>
  )
}
