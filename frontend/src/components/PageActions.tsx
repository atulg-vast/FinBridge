import { useLayoutEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function PageActions({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<Element | null>(null)

  useLayoutEffect(() => {
    setTarget(document.getElementById('__page-actions__'))
  }, [])

  if (!target) return null
  return createPortal(children, target)
}
