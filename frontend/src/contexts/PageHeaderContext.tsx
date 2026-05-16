import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'

export interface PageHeaderState {
  title: string
  description?: string
  back?: boolean
}

type SetHeaderFn = (state: PageHeaderState) => void

const PageHeaderStateCtx = createContext<PageHeaderState>({ title: '' })
const PageHeaderSetterCtx = createContext<SetHeaderFn>(() => {})

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PageHeaderState>({ title: '' })

  const setHeader = useCallback<SetHeaderFn>((next) => {
    setState((prev) =>
      prev.title === next.title &&
      prev.description === next.description &&
      prev.back === next.back
        ? prev
        : next
    )
  }, [])

  return (
    <PageHeaderSetterCtx.Provider value={setHeader}>
      <PageHeaderStateCtx.Provider value={state}>
        {children}
      </PageHeaderStateCtx.Provider>
    </PageHeaderSetterCtx.Provider>
  )
}

export const usePageHeader = () => useContext(PageHeaderStateCtx)
export const useSetHeader = () => useContext(PageHeaderSetterCtx)
