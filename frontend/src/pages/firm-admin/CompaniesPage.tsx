import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { companiesApi } from '@/api/companies'
import type { CompanyCreatePayload, CompanyCreateResponse } from '@/api/companies'

const BUSINESS_TYPES = ['Manufacturing', 'IT', 'Services', 'Trading', 'Other']

export default function CompaniesPage() {
  const { user } = useAuthStore()
  const firmId = user?.firm_id ?? ''
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState<CompanyCreateResponse | null>(null)
  const [form, setForm] = useState({ name: '', business_type: 'IT', admin_full_name: '', admin_email: '' })
  const [error, setError] = useState('')

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies', firmId],
    queryFn: () => companiesApi.list(firmId),
    enabled: !!firmId,
  })

  const createMutation = useMutation({
    mutationFn: (payload: CompanyCreatePayload) => companiesApi.create(firmId, payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['companies', firmId] })
      setCreatedCredentials(data)
      setShowModal(false)
      setForm({ name: '', business_type: 'IT', admin_full_name: '', admin_email: '' })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Failed to create company')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    createMutation.mutate(form)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
          <p className="text-gray-500 text-sm mt-1">{companies.length} compan{companies.length !== 1 ? 'ies' : 'y'} registered</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setError(''); setCreatedCredentials(null) }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          + Add Company
        </button>
      </div>

      {createdCredentials && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-green-800 mb-2">Company created! Share these credentials with the company admin:</h3>
              <div className="space-y-1 text-sm">
                <div><span className="text-gray-600">Company:</span> <span className="font-medium">{createdCredentials.company.name}</span></div>
                <div><span className="text-gray-600">Email:</span> <span className="font-mono font-medium">{createdCredentials.admin_email}</span></div>
                <div><span className="text-gray-600">Password:</span> <span className="font-mono font-medium bg-green-100 px-2 py-0.5 rounded">{createdCredentials.admin_password}</span></div>
              </div>
            </div>
            <button onClick={() => setCreatedCredentials(null)} className="text-green-600 hover:text-green-800 text-lg">×</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : companies.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🏗️</div>
          <p className="font-medium">No companies yet</p>
          <p className="text-sm mt-1">Add your first company to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Company Name</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Business Type</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Created</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {companies.map((company) => (
                <tr key={company.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-3 font-medium text-gray-900">{company.name}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium">{company.business_type}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-400">{new Date(company.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/firm/companies/${company.id}/payment-heads`} className="text-xs text-indigo-600 hover:underline">Configure heads</Link>
                  </td>
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
              <h2 className="text-lg font-bold text-gray-900">Add Company</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. TechCorp Pvt Ltd"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
                <select
                  value={form.business_type}
                  onChange={(e) => setForm({ ...form, business_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Full Name</label>
                <input
                  required
                  value={form.admin_full_name}
                  onChange={(e) => setForm({ ...form, admin_full_name: e.target.value })}
                  placeholder="e.g. Priya Mehta"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
                <input
                  required
                  type="email"
                  value={form.admin_email}
                  onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                  placeholder="admin@techcorp.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {error && <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium transition">
                  {createMutation.isPending ? 'Creating...' : 'Create Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
