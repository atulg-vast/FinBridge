import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { accountantsApi } from '@/api/companies'
import { useSetPageHeader } from '@/hooks/useSetPageHeader'
import { PageActions } from '@/components/PageActions'
import type { AccountantCreatePayload, AccountantCreateResponse } from '@/api/companies'

export default function AccountantsPage() {
  const { user } = useAuthStore()
  const firmId = user?.firm_id ?? ''
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState<AccountantCreateResponse | null>(null)
  const [form, setForm] = useState({ full_name: '', email: '' })
  const [error, setError] = useState('')

  const { data: accountants = [], isLoading } = useQuery({
    queryKey: ['accountants', firmId],
    queryFn: () => accountantsApi.list(firmId),
    enabled: !!firmId,
  })

  const createMutation = useMutation({
    mutationFn: (payload: AccountantCreatePayload) => accountantsApi.create(firmId, payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['accountants', firmId] })
      setCreatedCredentials(data)
      setShowModal(false)
      setForm({ full_name: '', email: '' })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Failed to create accountant')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    createMutation.mutate(form)
  }

  useSetPageHeader('Accountants', `${accountants.length} accountant${accountants.length !== 1 ? 's' : ''}`)

  return (
    <div className="p-8">
      <PageActions>
        <button
          onClick={() => { setShowModal(true); setError(''); setCreatedCredentials(null) }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          + Add Accountant
        </button>
      </PageActions>

      {createdCredentials && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-green-800 mb-2">Accountant added! Share these credentials:</h3>
              <div className="space-y-1 text-sm">
                <div><span className="text-gray-600">Name:</span> <span className="font-medium">{createdCredentials.full_name}</span></div>
                <div><span className="text-gray-600">Email:</span> <span className="font-mono font-medium">{createdCredentials.email}</span></div>
                <div><span className="text-gray-600">Password:</span> <span className="font-mono font-medium bg-green-100 px-2 py-0.5 rounded">{createdCredentials.temp_password}</span></div>
              </div>
            </div>
            <button onClick={() => setCreatedCredentials(null)} className="text-green-600 hover:text-green-800 text-lg">×</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : accountants.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">👤</div>
          <p className="font-medium">No accountants yet</p>
          <p className="text-sm mt-1">Add accountants to your team</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {accountants.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-3 font-medium text-gray-900">{a.full_name}</td>
                  <td className="px-5 py-3 text-gray-500">{a.email}</td>
                  <td className="px-5 py-3 text-gray-400">{new Date(a.created_at).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Add Accountant</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="e.g. Arjun Kapoor"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="arjun@abcaccounting.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {error && <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium transition">
                  {createMutation.isPending ? 'Adding...' : 'Add Accountant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
