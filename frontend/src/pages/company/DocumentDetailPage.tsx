import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { documentsApi } from '@/api/documents'
import { transactionsApi } from '@/api/transactions'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  extracted: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  pending_review: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

function ConfidenceBadge({ score }: { score: string | null }) {
  if (!score) return null
  const val = parseFloat(score)
  const color = val >= 0.8 ? 'text-green-600' : val >= 0.6 ? 'text-yellow-600' : 'text-red-500'
  return <span className={`text-xs font-medium ${color}`}>{Math.round(val * 100)}% confidence</span>
}

function ExtractedDataCard({ data }: { data: Record<string, unknown> }) {
  const skip = new Set(['low_confidence_fields', 'confidence_score', 'line_items', 'employees', 'transactions', 'entries'])
  const entries = Object.entries(data).filter(([k]) => !skip.has(k))

  return (
    <div className="space-y-1">
      {entries.map(([key, value]) => (
        value !== null && value !== undefined && value !== '' ? (
          <div key={key} className="flex gap-2 text-sm">
            <span className="text-gray-400 capitalize min-w-32">{key.replace(/_/g, ' ')}:</span>
            <span className="text-gray-800 font-medium">{String(value)}</span>
          </div>
        ) : null
      ))}
    </div>
  )
}

export default function DocumentDetailPage() {
  const { docId } = useParams<{ docId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: doc, isLoading: docLoading } = useQuery({
    queryKey: ['document', docId],
    queryFn: () => documentsApi.get(docId!),
    enabled: !!docId,
    refetchInterval: (query) => {
      const d = query.state.data
      return d?.status === 'pending' || d?.status === 'processing' ? 2000 : false
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => documentsApi.delete(docId!),
    onSuccess: () => navigate('/company/upload'),
  })

  const retryMutation = useMutation({
    mutationFn: () => documentsApi.retry(docId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document', docId] })
      qc.invalidateQueries({ queryKey: ['documents'] })
    },
  })

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', { document_id: docId }],
    queryFn: () => transactionsApi.list({ document_id: docId }),
    enabled: !!docId && doc?.status === 'extracted',
  })

  if (docLoading) return <div className="p-8 text-gray-400">Loading...</div>
  if (!doc) return <div className="p-8 text-gray-400">Document not found.</div>

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{doc.original_filename}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-gray-400">{doc.document_type?.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[doc.status]}`}>
              {doc.status}
              {(doc.status === 'pending' || doc.status === 'processing') && (
                <span className="ml-1 animate-pulse">•</span>
              )}
            </span>
          </div>
        </div>
        <button
          onClick={() => { if (confirm(`Delete "${doc.original_filename}"?`)) deleteMutation.mutate() }}
          disabled={deleteMutation.isPending}
          className="text-sm text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-lg px-3 py-1.5 transition disabled:opacity-50"
        >
          {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
        </button>
      </div>

      {/* Processing state */}
      {(doc.status === 'pending' || doc.status === 'processing') && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center mb-6">
          <div className="text-2xl mb-2 animate-spin inline-block">⚙</div>
          <p className="text-blue-700 font-medium">AI extraction in progress...</p>
          <p className="text-blue-500 text-sm mt-1">Claude is reading your document. This usually takes 10–30 seconds.</p>
          <button
            onClick={() => retryMutation.mutate()}
            disabled={retryMutation.isPending}
            className="mt-4 text-xs text-blue-600 border border-blue-300 rounded-lg px-3 py-1.5 hover:bg-blue-100 transition disabled:opacity-50"
          >
            Stuck? Re-trigger extraction
          </button>
        </div>
      )}

      {/* Failed state */}
      {doc.status === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-red-700 font-medium mb-1">Extraction failed</p>
              <p className="text-red-500 text-sm">{doc.error_reason || 'Unknown error'}</p>
            </div>
            <button
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
              className="ml-4 text-sm bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-4 py-1.5 rounded-lg transition flex-shrink-0"
            >
              {retryMutation.isPending ? 'Retrying...' : 'Retry'}
            </button>
          </div>
        </div>
      )}

      {/* Extracted transactions */}
      {doc.status === 'extracted' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="font-semibold text-gray-900">Extracted Records</h2>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">
              {transactions.length} record{transactions.length !== 1 ? 's' : ''} extracted
            </span>
          </div>

          {transactions.length === 0 ? (
            <div className="text-gray-400 text-sm bg-gray-50 rounded-xl p-6 text-center">
              No transactions found. The document may have been extracted but produced no records.
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((txn, idx) => (
                <div key={txn.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 font-mono">#{idx + 1}</span>
                      <span className="font-medium text-gray-800">{txn.party_name || '—'}</span>
                      {txn.amount && (
                        <span className="text-sm font-bold text-indigo-600">
                          INR {Number(txn.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <ConfidenceBadge score={txn.confidence_score} />
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[txn.status]}`}>
                        {txn.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="px-5 py-4">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-3">
                      {txn.transaction_date && (
                        <div className="flex gap-2 text-sm">
                          <span className="text-gray-400 min-w-28">Date:</span>
                          <span className="text-gray-800">{txn.transaction_date}</span>
                        </div>
                      )}
                      {txn.description && (
                        <div className="flex gap-2 text-sm">
                          <span className="text-gray-400 min-w-28">Description:</span>
                          <span className="text-gray-800">{txn.description}</span>
                        </div>
                      )}
                    </div>

                    {txn.extracted_data && (
                      <ExtractedDataCard data={txn.extracted_data as Record<string, unknown>} />
                    )}

                    {/* Low confidence warning */}
                    {txn.low_confidence_fields && txn.low_confidence_fields.length > 0 && (
                      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                        Low confidence fields: {txn.low_confidence_fields.join(', ')}
                      </div>
                    )}

                    {/* Line items */}
                    {txn.line_items && txn.line_items.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-medium text-gray-500 mb-2">LINE ITEMS</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="text-left px-3 py-2 text-gray-500">Description</th>
                                <th className="text-center px-3 py-2 text-gray-500">HSN</th>
                                <th className="text-right px-3 py-2 text-gray-500">Qty</th>
                                <th className="text-right px-3 py-2 text-gray-500">Unit Price</th>
                                <th className="text-right px-3 py-2 text-gray-500">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {txn.line_items.map((item) => (
                                <tr key={item.id}>
                                  <td className="px-3 py-2 text-gray-700">{item.description}</td>
                                  <td className="px-3 py-2 text-center text-gray-400">{item.hsn_code || '—'}</td>
                                  <td className="px-3 py-2 text-right text-gray-700">{item.quantity}</td>
                                  <td className="px-3 py-2 text-right text-gray-700">{item.unit_price}</td>
                                  <td className="px-3 py-2 text-right font-medium text-gray-900">{item.amount}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Rejection note */}
                    {txn.status === 'rejected' && txn.rejection_note && (
                      <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                        Rejected: {txn.rejection_note}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
