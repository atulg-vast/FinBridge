import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { companyUsersApi, type CompanyUser, type CompanyUserCreateResponse } from '@/api/companies'
import { useSetPageHeader } from '@/hooks/useSetPageHeader'
import { PageActions } from '@/components/PageActions'

function timeStr(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function CredentialCard({ data, onClose }: { data: CompanyUserCreateResponse; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-lg">✓</div>
          <div>
            <h2 className="font-bold text-gray-900">User Added</h2>
            <p className="text-xs text-gray-400">{data.message}</p>
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 space-y-3 mb-4">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Email</p>
            <p className="text-sm font-medium text-gray-800">{data.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Temporary Password</p>
            <p className="text-sm font-mono font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg inline-block">{data.temp_password}</p>
          </div>
        </div>
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mb-4">
          Share these credentials with the user. They should change their password after first login.
        </p>
        <button
          onClick={onClose}
          className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition"
        >
          Done
        </button>
      </div>
    </div>
  )
}

function EditRow({
  user,
  onSave,
  onCancel,
  isSaving,
}: {
  user: CompanyUser
  onSave: (fullName: string) => void
  onCancel: () => void
  isSaving: boolean
}) {
  const [fullName, setFullName] = useState(user.full_name)
  return (
    <tr className="bg-indigo-50/40">
      <td className="px-5 py-2.5">
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full px-3 py-1.5 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          autoFocus
        />
      </td>
      <td className="px-5 py-2.5 text-gray-400 text-sm">{user.email}</td>
      <td className="px-5 py-2.5">
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">Company User</span>
      </td>
      <td className="px-5 py-2.5 text-gray-400 text-xs">{timeStr(user.created_at)}</td>
      <td className="px-5 py-2.5 text-right">
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => onSave(fullName.trim())}
            disabled={!fullName.trim() || isSaving}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-xs rounded-lg transition"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition"
          >
            Cancel
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function TeamPage() {
  const qc = useQueryClient()

  const [showForm, setShowForm] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [newUser, setNewUser] = useState<CompanyUserCreateResponse | null>(null)
  const [formError, setFormError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: users = [], isLoading, isError } = useQuery({
    queryKey: ['company-users'],
    queryFn: companyUsersApi.list,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['company-users'] })

  const addMutation = useMutation({
    mutationFn: () => companyUsersApi.create({ full_name: fullName.trim(), email: email.trim() }),
    onSuccess: (data) => {
      invalidate()
      setNewUser(data)
      setShowForm(false)
      setFullName('')
      setEmail('')
      setFormError('')
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.detail ?? 'Failed to add user.')
    },
  })

  const editMutation = useMutation({
    mutationFn: ({ id, full_name }: { id: string; full_name: string }) =>
      companyUsersApi.update(id, { full_name }),
    onSuccess: () => { invalidate(); setEditingId(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => companyUsersApi.remove(id),
    onSuccess: () => { invalidate(); setDeletingId(null) },
  })

  useSetPageHeader('Team', 'Manage users who can access your company portal')

  return (
    <div className="p-8">
      <PageActions>
        <button
          onClick={() => { setShowForm(true); setFormError('') }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition"
        >
          + Add User
        </button>
      </PageActions>

      {/* Add user form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h3 className="font-semibold text-gray-800 mb-4 text-sm">New Company User</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Rahul Sharma"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rahul@company.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          {formError && <p className="text-xs text-red-600 mb-3">{formError}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => addMutation.mutate()}
              disabled={!fullName.trim() || !email.trim() || addMutation.isPending}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-lg transition"
            >
              {addMutation.isPending ? 'Adding...' : 'Add User'}
            </button>
            <button
              onClick={() => { setShowForm(false); setFormError('') }}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="font-bold text-gray-900 mb-2">Remove User?</h2>
            <p className="text-sm text-gray-500 mb-5">
              This will permanently remove the user's access to your company portal.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => deleteMutation.mutate(deletingId)}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-medium rounded-lg transition"
              >
                {deleteMutation.isPending ? 'Removing...' : 'Remove'}
              </button>
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-medium rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users table */}
      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : isError ? (
        <div className="text-center py-20 bg-white rounded-xl border border-red-100 text-red-400">
          <p className="font-medium">Failed to load team members</p>
          <p className="text-xs mt-1 text-gray-400">Check your connection and try refreshing.</p>
        </div>
      ) : users.length === 0 && !showForm ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200 text-gray-400">
          <div className="text-4xl mb-3">👥</div>
          <p className="font-medium text-gray-500">No team members yet</p>
          <p className="text-sm mt-1">Add users so your team can upload documents and track status.</p>
        </div>
      ) : users.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Role</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Added</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) =>
                editingId === u.id ? (
                  <EditRow
                    key={u.id}
                    user={u}
                    onSave={(name) => editMutation.mutate({ id: u.id, full_name: name })}
                    onCancel={() => setEditingId(null)}
                    isSaving={editMutation.isPending}
                  />
                ) : (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{u.full_name}</td>
                    <td className="px-5 py-3 text-gray-500">{u.email}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                        Company User
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{timeStr(u.created_at)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex gap-3 justify-end">
                        <button
                          onClick={() => setEditingId(u.id)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeletingId(u.id)}
                          className="text-xs text-red-500 hover:text-red-700 transition"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {newUser && <CredentialCard data={newUser} onClose={() => setNewUser(null)} />}
    </div>
  )
}
