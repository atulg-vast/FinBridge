import apiClient from './client'
import type { AppNotification } from '@/stores/notificationStore'

export const notificationsApi = {
  list: () => apiClient.get<AppNotification[]>('/notifications').then((r) => r.data),
  markRead: (id: string) => apiClient.post(`/notifications/${id}/read`),
  markAllRead: () => apiClient.post('/notifications/read-all'),
}
