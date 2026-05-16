import { useEffect } from 'react'
import { useSetHeader } from '@/contexts/PageHeaderContext'

export function useSetPageHeader(title: string, description?: string, back?: boolean) {
  const setHeader = useSetHeader()
  useEffect(() => {
    setHeader({ title, description, back })
    return () => setHeader({ title: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, back])
}
