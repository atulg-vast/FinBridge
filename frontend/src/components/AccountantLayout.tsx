import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useNotifications } from '@/hooks/useNotifications'
import { PageHeaderProvider } from '@/contexts/PageHeaderContext'
import { AppHeader } from '@/components/AppHeader'
import ChatWidget from '@/components/ChatWidget'

const ICON_HOME = 'm2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25'
const ICON_REVIEW = 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'
const ICON_DOCUMENT = 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z'
const ICON_SIGNOUT = 'M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15M12 9l3 3m0 0-3 3m3-3H2.25'

const nav = [
  { to: '/accountant', label: 'Dashboard', end: true, icon: ICON_HOME },
  { to: '/accountant/review', label: 'Review Queue', end: false, icon: ICON_REVIEW },
  { to: '/accountant/reports', label: 'Reports', end: false, icon: ICON_DOCUMENT },
]

function NavIcon({ d }: { d: string }) {
  return (
    <svg className="w-4.5 h-4.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name) {
    const parts = name.trim().split(' ')
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
  }
  return (email?.[0] ?? 'U').toUpperCase()
}

export default function AccountantLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  useNotifications()

  const initials = getInitials(user?.full_name, user?.email)

  return (
    <PageHeaderProvider>
      <div className="flex h-screen bg-slate-50">
        <aside className="w-60 bg-slate-900 flex flex-col shrink-0">
          <div className="flex items-center gap-2.5 px-5 py-5">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
              </svg>
            </div>
            <div>
              <div className="text-white font-bold text-sm leading-none tracking-tight">FinBridge</div>
              <div className="text-slate-500 text-xs mt-0.5">Accountant</div>
            </div>
          </div>

          <nav className="flex-1 px-3 py-2 space-y-0.5">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                  }`
                }
              >
                <NavIcon d={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="px-3 py-4 border-t border-slate-800">
            <div className="flex items-center gap-2.5 px-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-semibold">{initials}</span>
              </div>
              <div className="min-w-0">
                <div className="text-white text-xs font-medium truncate leading-none mb-0.5">
                  {user?.full_name || user?.email}
                </div>
                <div className="text-slate-500 text-xs truncate">Accountant</div>
              </div>
            </div>
            <button
              onClick={() => { logout(); navigate('/login') }}
              className="w-full flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-red-400 hover:bg-white/5 rounded-lg text-xs transition-colors"
            >
              <NavIcon d={ICON_SIGNOUT} />
              Sign out
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-auto flex flex-col min-w-0">
          <AppHeader />
          <div className="flex-1 overflow-auto">
            <Outlet />
          </div>
        </main>

        <ChatWidget />
      </div>
    </PageHeaderProvider>
  )
}
