import apiClient from './client'

export interface QueryCard {
  id: string
  label: string
  description: string
  icon: string
}

export interface QueryResult {
  query_label: string
  answer: string
  columns: string[]
  rows: Record<string, string | number>[]
}

export const chatApi = {
  queries: () => apiClient.get<QueryCard[]>('/chat/queries').then((r) => r.data),
  run: (query_id: string) =>
    apiClient.post<QueryResult>('/chat/run', { query_id }).then((r) => r.data),
}
