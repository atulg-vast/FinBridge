import { useNavigate } from 'react-router-dom'
import { usePageHeader } from '@/contexts/PageHeaderContext'
import NotificationBell from '@/components/NotificationBell'

export function AppHeader({ notifications = true }: { notifications?: boolean }) {
  const { title, description, back } = usePageHeader()
  const navigate = useNavigate()

  return (
    <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center gap-3 shrink-0">
      {back && (
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          aria-label="Go back"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </button>
      )}

      <div className="flex-1 min-w-0">
        {title ? (
          <>
            <h1 className="text-sm font-semibold text-slate-900 truncate leading-none">{title}</h1>
            {description && (
              <p className="text-xs text-slate-400 mt-0.5 truncate">{description}</p>
            )}
          </>
        ) : null}
      </div>

      <div id="__page-actions__" className="flex items-center gap-2 shrink-0" />

      {notifications && (
        <div className="shrink-0 pl-3 border-l border-slate-200">
          <NotificationBell />
        </div>
      )}
    </header>
  )
}
