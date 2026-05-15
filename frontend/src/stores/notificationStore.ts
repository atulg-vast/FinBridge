import { create } from 'zustand'

export interface AppNotification {
  id: string
  message: string
  type: string
  entity_id: string | null
  entity_type: string | null
  is_read: boolean
  created_at: string
}

interface NotificationState {
  notifications: AppNotification[]
  unreadCount: number
  setNotifications: (n: AppNotification[]) => void
  addNotification: (n: AppNotification) => void
  markRead: (id: string) => void
  markAllRead: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (notifications) =>
    set({ notifications, unreadCount: notifications.filter((n) => !n.is_read).length }),

  addNotification: (n) =>
    set((state) => ({
      notifications: [n, ...state.notifications].slice(0, 50),
      unreadCount: state.unreadCount + (n.is_read ? 0 : 1),
    })),

  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) => n.id === id ? { ...n, is_read: true } : n),
      unreadCount: Math.max(0, state.unreadCount - (state.notifications.find((n) => n.id === id && !n.is_read) ? 1 : 0)),
    })),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    })),
}))
