import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

const nav = [
  { to: '/firm', label: 'Dashboard', end: true },
  { to: '/firm/companies', label: 'Companies' },
  { to: '/firm/accountants', label: 'Accountants' },
]

export default function FirmAdminLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100">
          <span className="text-lg font-bold text-indigo-600">FinBridge</span>
          <div className="text-xs text-gray-400 mt-0.5">Firm Admin</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-gray-100">
          <div className="text-xs text-gray-500 truncate mb-2">{user?.email}</div>
          <button
            onClick={handleLogout}
            className="w-full text-left text-xs text-red-500 hover:text-red-700 transition"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
