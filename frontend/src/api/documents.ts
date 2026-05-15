import apiClient from './client'

export interface DocumentType {
  id: string
  name: string
  slug: string
  description: string | null
  accepted_file_formats: string[]
}

export interface Document {
  id: string
  company_id: string
  uploaded_by: string
  document_type_id: string
  original_filename: string
  status: 'pending' | 'processing' | 'extracted' | 'failed'
  error_reason: string | null
  created_at: string
  document_type: DocumentType | null
}

export const documentsApi = {
  listTypes: () =>
    apiClient.get<DocumentType[]>('/documents/types').then((r) => r.data),

  upload: (companyId: string, documentTypeSlug: string, file: File, onProgress?: (pct: number) => void) => {
    const form = new FormData()
    form.append('company_id', companyId)
    form.append('document_type_slug', documentTypeSlug)
    form.append('file', file)
    return apiClient
      .post<Document>('/documents/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total))
        },
      })
      .then((r) => r.data)
  },

  list: (companyId?: string) => {
    const params = companyId ? { company_id: companyId } : {}
    return apiClient.get<Document[]>('/documents', { params }).then((r) => r.data)
  },

  get: (id: string) => apiClient.get<Document>(`/documents/${id}`).then((r) => r.data),

  retry: (id: string) => apiClient.post<Document>(`/documents/${id}/retry`).then((r) => r.data),

  delete: (id: string) => apiClient.delete(`/documents/${id}`),
}
