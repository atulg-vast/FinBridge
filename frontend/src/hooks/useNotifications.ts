import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { notificationsApi } from '@/api/notifications'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export function useNotifications() {
  const { token, isAuthenticated } = useAuthStore()
  const { setNotifications, addNotification } = useNotificationStore()

  // Fetch existing notifications on mount
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    enabled: isAuthenticated(),
  })

  useEffect(() => {
    if (data) setNotifications(data)
  }, [data, setNotifications])

  // Connect to SSE stream
  useEffect(() => {
    if (!token || !isAuthenticated()) return

    const url = `${API_BASE}/notifications/stream?token=${token}`
    const es = new EventSource(url)

    es.addEventListener('notification', (e) => {
      try {
        const n = JSON.parse(e.data)
        addNotification(n)
      } catch {}
    })

    es.onerror = () => {
      // EventSource auto-reconnects on error
    }

    return () => es.close()
  }, [token])
}
