import { useState, useCallback, useRef, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { documentsApi, type Document } from '@/api/documents'

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  extracted:  'bg-green-100 text-green-700',
  failed:     'bg-red-100 text-red-700',
}

const EXTRACTION_STEPS = [
  'Queuing document for processing…',
  'Reading document pages…',
  'Sending to Claude AI…',
  'Extracting fields and amounts…',
  'Mapping to transaction records…',
  'Calculating confidence scores…',
]

function ExtractionProgressCard({
  doc,
  onDismiss,
}: {
  doc: Document
  onDismiss: () => void
}) {
  const [stepIdx, setStepIdx] = useState(0)
  const isProcessing = doc.status === 'pending' || doc.status === 'processing'
  const isDone = doc.status === 'extracted'
  const isFailed = doc.status === 'failed'

  useEffect(() => {
    if (!isProcessing) return
    const t = setInterval(() => setStepIdx((i) => (i + 1) % EXTRACTION_STEPS.length), 3200)
    return () => clearInterval(t)
  }, [isProcessing])

  return (
    <div className={`rounded-xl border p-5 mb-6 transition-all ${
      isDone  ? 'bg-green-50 border-green-200' :
      isFailed? 'bg-red-50 border-red-200'     :
                'bg-indigo-50 border-indigo-200'
    }`}>
      <div className="flex items-start gap-4">

        {/* Icon / spinner */}
        <div className="flex-shrink-0 mt-0.5">
          {isProcessing && (
            <div className="w-9 h-9 rounded-full border-[3px] border-indigo-200 border-t-indigo-600 animate-spin" />
          )}
          {isDone && (
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-lg font-bold">
              ✓
            </div>
          )}
          {isFailed && (
            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-500 text-lg font-bold">
              ✕
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-sm font-semibold truncate ${
              isDone ? 'text-green-800' : isFailed ? 'text-red-700' : 'text-indigo-800'
            }`}>
              {isDone   ? 'AI Extraction Complete'  :
               isFailed ? 'Extraction Failed'       :
                          'AI Extraction in Progress'}
            </p>
            <button
              onClick={onDismiss}
              className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              Dismiss
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-0.5 truncate">{doc.original_filename}</p>

          {isProcessing && (
            <>
              {/* Step progress bar */}
              <div className="mt-3 mb-2">
                <div className="flex items-center gap-1.5 mb-1.5">
                  {EXTRACTION_STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                        i <= stepIdx ? 'bg-indigo-500' : 'bg-indigo-100'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-indigo-700 font-medium">
                  {EXTRACTION_STEPS[stepIdx]}
                </p>
              </div>
              <p className="text-xs text-indigo-400 mt-1">
                This usually takes 10–30 seconds depending on document size.
                The table below will update automatically.
              </p>
            </>
          )}

          {isDone && (
            <p className="text-xs text-green-700 mt-1">
              Transactions extracted and ready for accountant review.{' '}
              <Link to={`/company/documents/${doc.id}`} className="underline font-medium">
                View results →
              </Link>
            </p>
          )}

          {isFailed && (
            <p className="text-xs text-red-600 mt-1">
              {doc.error_reason || 'Extraction failed. You can retry from the document detail page.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
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
  const [processingDocId, setProcessingDocId] = useState<string | null>(null)

  const { data: docTypes = [] } = useQuery({
    queryKey: ['document-types'],
    queryFn: documentsApi.listTypes,
  })

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents', companyId],
    queryFn: () => documentsApi.list(companyId),
    enabled: !!companyId,
    refetchInterval: (query) => {
      const docs = query.state.data as Document[] | undefined
      const hasProcessing = docs?.some(
        (d: Document) => d.status === 'pending' || d.status === 'processing'
      )
      return hasProcessing ? 3000 : false
    },
  })

  const processingDoc = processingDocId
    ? documents.find((d) => d.id === processingDocId) ?? null
    : null

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!selectedType) { setUploadError('Please select a document type first'); return }
      if (!companyId) return
      const file = acceptedFiles[0]
      if (!file) return

      setUploading(true)
      setUploadError('')
      setProcessingDocId(null)
      setUploadProgress(0)

      try {
        const doc = await documentsApi.upload(companyId, selectedType, file, setUploadProgress)
        qc.invalidateQueries({ queryKey: ['documents', companyId] })
        setProcessingDocId(doc.id)
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

  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleCameraFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) onDrop([file])
      e.target.value = ''
    },
    [onDrop]
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

        {/* Extraction progress card */}
        {processingDoc && (
          <ExtractionProgressCard
            doc={processingDoc}
            onDismiss={() => setProcessingDocId(null)}
          />
        )}

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
                <div className="w-8 h-8 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
                <div className="text-gray-600 text-sm mb-2 font-medium">Uploading file…</div>
                <div className="w-full bg-gray-200 rounded-full h-2 max-w-xs mx-auto">
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
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-600 text-sm font-medium">
                  {selectedType ? 'Drag & drop or click to select' : 'Select a document type first'}
                </p>
                <p className="text-gray-400 text-xs mt-1">Supports PDF, JPG, PNG · Max 20 MB</p>
              </div>
            )}
          </div>

          {/* Camera capture for mobile */}
          {!uploading && selectedType && (
            <div className="mt-3 flex justify-center">
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleCameraFile}
              />
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Take Photo
              </button>
            </div>
          )}

          {uploadError && (
            <div className="mt-3 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{uploadError}</div>
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
                {documents.map((doc: Document) => {
                  const isActive = processingDocId === doc.id
                  return (
                    <tr key={doc.id} className={`hover:bg-gray-50 transition ${isActive ? 'bg-indigo-50/40' : ''}`}>
                      <td className="px-5 py-3 font-medium text-gray-900 max-w-xs truncate">
                        <Link to={`/company/documents/${doc.id}`} className="hover:text-indigo-600 hover:underline">
                          {doc.original_filename}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-gray-500">{doc.document_type?.name ?? '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[doc.status]}`}>
                          {doc.status === 'pending'     ? 'Queued'     :
                           doc.status === 'processing'  ? 'Extracting' :
                           doc.status === 'extracted'   ? 'Extracted'  : 'Failed'}
                          {(doc.status === 'pending' || doc.status === 'processing') && (
                            <span className="ml-1 animate-pulse">•</span>
                          )}
                        </span>
                        {doc.status === 'failed' && doc.error_reason && (
                          <div className="text-xs text-red-500 mt-0.5 max-w-xs truncate">{doc.error_reason}</div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs">
                        {new Date(doc.created_at).toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${doc.original_filename}"?`)) {
                              if (processingDocId === doc.id) setProcessingDocId(null)
                              deleteMutation.mutate(doc.id)
                            }
                          }}
                          className="text-xs text-red-400 hover:text-red-600 transition"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
