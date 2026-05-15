import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { transactionsApi } from '@/api/transactions'
import { paymentHeadsApi } from '@/api/paymentHeads'
import type { Transaction } from '@/api/transactions'

function ConfidenceBadge({ score }: { score: string | null }) {
  if (!score) return null
  const val = parseFloat(score)
  const color = val >= 0.8 ? 'text-green-600 bg-green-50' : val >= 0.6 ? 'text-yellow-600 bg-yellow-50' : 'text-red-500 bg-red-50'
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${color}`}>
      {Math.round(val * 100)}% confidence
    </span>
  )
}

function TransactionDrawer({
  txn,
  onClose,
}: {
  txn: Transaction
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [rejectionNote, setRejectionNote] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [editedAmount, setEditedAmount] = useState(txn.amount ?? '')
  const [editedParty, setEditedParty] = useState(txn.party_name ?? '')
  const [editedDate, setEditedDate] = useState(txn.transaction_date ?? '')
  const [editedDesc, setEditedDesc] = useState(txn.description ?? '')
  const [selectedHead, setSelectedHead] = useState(txn.head_id ?? '')
  const [selectedSub, setSelectedSub] = useState(txn.sub_head_id ?? '')

  const { data: heads = [] } = useQuery({
    queryKey: ['payment-heads', txn.company_id],
    queryFn: () => paymentHeadsApi.list(txn.company_id),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['transactions'] })
    onClose()
  }

  const updateMutation = useMutation({
    mutationFn: () => transactionsApi.update(txn.id, {
      party_name: editedParty || undefined,
      amount: editedAmount ? Number(editedAmount) : undefined,
      transaction_date: editedDate || undefined,
      description: editedDesc || undefined,
      head_id: selectedHead || null,
      sub_head_id: selectedSub || null,
    }),
  })

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (updateMutation.isIdle) {
        await transactionsApi.update(txn.id, {
          party_name: editedParty || undefined,
          amount: editedAmount ? Number(editedAmount) : undefined,
          transaction_date: editedDate || undefined,
          description: editedDesc || undefined,
          head_id: selectedHead || null,
          sub_head_id: selectedSub || null,
        })
      }
      return transactionsApi.accept(txn.id)
    },
    onSuccess: invalidate,
  })

  const rejectMutation = useMutation({
    mutationFn: () => transactionsApi.reject(txn.id, rejectionNote),
    onSuccess: invalidate,
  })

  const selectedHeadData = heads.find((h) => h.id === selectedHead)

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="font-bold text-gray-900">Review Transaction</h2>
            <p className="text-xs text-gray-400 mt-0.5">{txn.description}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Confidence */}
          <div className="flex items-center gap-2">
            <ConfidenceBadge score={txn.confidence_score} />
            {txn.low_confidence_fields && txn.low_confidence_fields.length > 0 && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                Low confidence: {txn.low_confidence_fields.join(', ')}
              </span>
            )}
          </div>

          {/* Editable fields */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Party / Vendor Name</label>
              <input
                value={editedParty}
                onChange={(e) => setEditedParty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Amount (INR)</label>
                <input
                  type="number"
                  value={editedAmount}
                  onChange={(e) => setEditedAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                <input
                  type="date"
                  value={editedDate}
                  onChange={(e) => setEditedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
              <input
                value={editedDesc}
                onChange={(e) => setEditedDesc(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Payment head / sub-head */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Payment Head</label>
                <select
                  value={selectedHead}
                  onChange={(e) => { setSelectedHead(e.target.value); setSelectedSub('') }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— Select head —</option>
                  {heads.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Sub-Head</label>
                <select
                  value={selectedSub}
                  onChange={(e) => setSelectedSub(e.target.value)}
                  disabled={!selectedHead}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
                >
                  <option value="">— Select sub-head —</option>
                  {selectedHeadData?.sub_heads.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Extracted data (read-only reference) */}
          {txn.extracted_data && (
            <div>
              <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">AI Extracted Data</p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                {Object.entries(txn.extracted_data as Record<string, unknown>)
                  .filter(([k]) => !['low_confidence_fields', 'confidence_score', 'line_items', 'employees', 'transactions', 'entries'].includes(k))
                  .map(([k, v]) => v !== null && v !== undefined && v !== '' ? (
                    <div key={k} className="flex gap-2 text-xs">
                      <span className="text-gray-400 capitalize min-w-28">{k.replace(/_/g, ' ')}:</span>
                      <span className="text-gray-700">{String(v)}</span>
                    </div>
                  ) : null)}
              </div>
            </div>
          )}

          {/* Line items */}
          {txn.line_items && txn.line_items.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Line Items</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-2 py-1.5 text-gray-500">Description</th>
                    <th className="text-right px-2 py-1.5 text-gray-500">Qty</th>
                    <th className="text-right px-2 py-1.5 text-gray-500">Unit Price</th>
                    <th className="text-right px-2 py-1.5 text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {txn.line_items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-2 py-1.5 text-gray-700">{item.description}</td>
                      <td className="px-2 py-1.5 text-right">{item.quantity}</td>
                      <td className="px-2 py-1.5 text-right">{item.unit_price}</td>
                      <td className="px-2 py-1.5 text-right font-medium">{item.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Reject form */}
          {showReject && (
            <div className="border border-red-200 rounded-lg p-3 bg-red-50">
              <label className="block text-xs font-medium text-red-700 mb-1">Rejection reason (required)</label>
              <textarea
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                rows={3}
                placeholder="Explain why this transaction is being rejected..."
                className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => rejectMutation.mutate()}
                  disabled={!rejectionNote.trim() || rejectMutation.isPending}
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-xs rounded-lg transition"
                >
                  {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Reject'}
                </button>
                <button onClick={() => setShowReject(false)} className="px-4 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={() => setShowReject(true)}
            disabled={rejectMutation.isPending || acceptMutation.isPending || showReject}
            className="flex-1 px-4 py-2.5 border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 rounded-lg text-sm font-medium transition"
          >
            Reject
          </button>
          <button
            onClick={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending || rejectMutation.isPending}
            className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg text-sm font-medium transition"
          >
            {acceptMutation.isPending ? 'Accepting...' : 'Accept'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ReviewPage() {
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [filterCompany, setFilterCompany] = useState('')

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', { status: 'pending_review' }],
    queryFn: () => transactionsApi.list({ status: 'pending_review' }),
  })

  const companies = Array.from(new Set(transactions.map((t) => t.company_id)))

  const filtered = filterCompany
    ? transactions.filter((t) => t.company_id === filterCompany)
    : transactions

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Queue</h1>
          <p className="text-gray-500 text-sm mt-1">{transactions.length} transaction{transactions.length !== 1 ? 's' : ''} pending review</p>
        </div>
        {companies.length > 1 && (
          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All companies</option>
            {companies.map((id) => <option key={id} value={id}>{id.slice(0, 8)}…</option>)}
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-4xl mb-3">✓</div>
          <p className="font-medium">All caught up!</p>
          <p className="text-sm mt-1">No transactions pending review.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Party</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Description</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Date</th>
                <th className="text-right px-5 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-center px-5 py-3 font-medium text-gray-600">Confidence</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((txn) => (
                <tr
                  key={txn.id}
                  className="hover:bg-gray-50 cursor-pointer transition"
                  onClick={() => setSelected(txn)}
                >
                  <td className="px-5 py-3 font-medium text-gray-900">{txn.party_name || '—'}</td>
                  <td className="px-5 py-3 text-gray-500 max-w-xs truncate">{txn.description || '—'}</td>
                  <td className="px-5 py-3 text-gray-400">{txn.transaction_date || '—'}</td>
                  <td className="px-5 py-3 text-right font-bold text-indigo-600">
                    {txn.amount ? `INR ${Number(txn.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <ConfidenceBadge score={txn.confidence_score} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelected(txn) }}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Review →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <TransactionDrawer txn={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
