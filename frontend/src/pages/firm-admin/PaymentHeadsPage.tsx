import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { paymentHeadsApi } from '@/api/paymentHeads'
import type { PaymentHead } from '@/api/paymentHeads'

export default function PaymentHeadsPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const id = companyId ?? ''

  const [selectedHead, setSelectedHead] = useState<PaymentHead | null>(null)
  const [newHeadName, setNewHeadName] = useState('')
  const [newSubName, setNewSubName] = useState('')
  const [presetMsg, setPresetMsg] = useState('')

  const { data: heads = [], isLoading } = useQuery({
    queryKey: ['payment-heads', id],
    queryFn: () => paymentHeadsApi.list(id),
    enabled: !!id,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['payment-heads', id] })

  const addHeadMutation = useMutation({
    mutationFn: (name: string) => paymentHeadsApi.createHead(id, name),
    onSuccess: (head: PaymentHead) => { invalidate(); setNewHeadName(''); setSelectedHead(head) },
  })

  const deleteHeadMutation = useMutation({
    mutationFn: (headId: string) => paymentHeadsApi.deleteHead(id, headId),
    onSuccess: () => { invalidate(); setSelectedHead(null) },
  })

  const addSubMutation = useMutation({
    mutationFn: (name: string) => paymentHeadsApi.createSubHead(id, selectedHead!.id, name),
    onSuccess: () => { invalidate(); setNewSubName('') },
  })

  const deleteSubMutation = useMutation({
    mutationFn: ({ headId, subId }: { headId: string; subId: string }) =>
      paymentHeadsApi.deleteSubHead(id, headId, subId),
    onSuccess: () => invalidate(),
  })

  const presetMutation = useMutation({
    mutationFn: () => paymentHeadsApi.applyPreset(id),
    onSuccess: (data: unknown) => {
      invalidate()
      setPresetMsg((data as { message: string }).message)
    },
  })

  // Keep selected head in sync after refetch
  const currentSelected = selectedHead
    ? heads.find((h) => h.id === selectedHead.id) ?? null
    : null

  function handleAddHead(e: React.FormEvent) {
    e.preventDefault()
    if (newHeadName.trim()) addHeadMutation.mutate(newHeadName.trim())
  }

  function handleAddSub(e: React.FormEvent) {
    e.preventDefault()
    if (newSubName.trim()) addSubMutation.mutate(newSubName.trim())
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Heads</h1>
          <p className="text-gray-500 text-sm mt-0.5">Configure expense categories for this company</p>
        </div>
      </div>

      {presetMsg && (
        <div className="mb-5 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800 flex justify-between items-center">
          <span>{presetMsg}</span>
          <button onClick={() => setPresetMsg('')} className="text-green-600 hover:text-green-800">×</button>
        </div>
      )}

      <div className="flex gap-6">
        {/* Left: Heads list */}
        <div className="w-72 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="font-semibold text-gray-800 text-sm">Payment Heads</span>
              {heads.length === 0 && !isLoading && (
                <button
                  onClick={() => presetMutation.mutate()}
                  disabled={presetMutation.isPending}
                  className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
                >
                  Apply preset
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="px-4 py-6 text-sm text-gray-400">Loading...</div>
            ) : heads.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">
                <p>No heads yet.</p>
                <button
                  onClick={() => presetMutation.mutate()}
                  disabled={presetMutation.isPending}
                  className="mt-2 text-indigo-600 hover:underline text-xs disabled:opacity-50"
                >
                  Apply preset template →
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {heads.map((head) => (
                  <li
                    key={head.id}
                    onClick={() => setSelectedHead(head)}
                    className={`flex items-center justify-between px-4 py-2.5 cursor-pointer text-sm transition ${
                      currentSelected?.id === head.id
                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span className="truncate">{head.name}</span>
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      <span className="text-xs text-gray-400">{head.sub_heads.length}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteHeadMutation.mutate(head.id) }}
                        className="text-red-400 hover:text-red-600 text-xs px-1"
                        title="Delete head"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-gray-100 p-3">
              <form onSubmit={handleAddHead} className="flex gap-2">
                <input
                  value={newHeadName}
                  onChange={(e) => setNewHeadName(e.target.value)}
                  placeholder="New head..."
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!newHeadName.trim() || addHeadMutation.isPending}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:bg-indigo-300 transition"
                >
                  Add
                </button>
              </form>
            </div>
          </div>

          {heads.length > 0 && (
            <button
              onClick={() => presetMutation.mutate()}
              disabled={presetMutation.isPending}
              className="mt-3 w-full text-xs text-gray-500 hover:text-indigo-600 border border-dashed border-gray-300 rounded-lg py-2 transition disabled:opacity-50"
            >
              {presetMutation.isPending ? 'Applying...' : 'Re-apply preset template'}
            </button>
          )}
        </div>

        {/* Right: Sub-heads */}
        <div className="flex-1">
          {!currentSelected ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 flex items-center justify-center h-64 text-gray-400 text-sm">
              Select a payment head to manage its sub-heads
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-gray-800">{currentSelected.name}</span>
                  <span className="text-xs text-gray-400 ml-2">sub-heads</span>
                </div>
                <span className="text-xs text-gray-400">{currentSelected.sub_heads.length} items</span>
              </div>

              {currentSelected.sub_heads.length === 0 ? (
                <div className="px-5 py-8 text-center text-gray-400 text-sm">
                  No sub-heads yet. Add one below.
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {currentSelected.sub_heads.map((sub) => (
                    <li key={sub.id} className="flex items-center justify-between px-5 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                      <span>{sub.name}</span>
                      <button
                        onClick={() => deleteSubMutation.mutate({ headId: currentSelected.id, subId: sub.id })}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-t border-gray-100 p-4">
                <form onSubmit={handleAddSub} className="flex gap-2">
                  <input
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    placeholder={`Add sub-head to "${currentSelected.name}"...`}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={!newSubName.trim() || addSubMutation.isPending}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 transition"
                  >
                    Add
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
