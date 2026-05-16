import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { chatApi, type QueryCard, type QueryResult } from '@/api/chat'

function QueryIcon({ name }: { name: string }) {
  const map: Record<string, string> = {
    clock: '⏱',
    'chart-bar': '📊',
    building: '🏢',
    alert: '⚠️',
    'x-circle': '❌',
    'trending-up': '📈',
    list: '📋',
  }
  return <span className="text-xl leading-none">{map[name] ?? '🔍'}</span>
}

function QueryCardGrid({
  queries,
  onSelect,
}: {
  queries: QueryCard[]
  onSelect: (id: string) => void
}) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-3 font-medium">Select a query to run against your live data:</p>
      <div className="flex flex-col gap-2">
        {queries.map((q) => (
          <button
            key={q.id}
            onClick={() => onSelect(q.id)}
            className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-200 transition-all text-left group"
          >
            <div className="mt-0.5 shrink-0 w-7 text-center">
              <QueryIcon name={q.icon} />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-800 group-hover:text-indigo-700 transition-colors">
                {q.label}
              </div>
              <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">{q.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function ResultView({ result, onReset }: { result: QueryResult; onReset: () => void }) {
  function fmt(val: string | number) {
    if (typeof val === 'number') {
      return `INR ${val.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
    }
    return val
  }

  function isAmount(col: string) {
    return col.includes('INR') || col.includes('Spend') || col.includes('Paid')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-gray-700">{result.query_label}</div>
        <button
          onClick={onReset}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
        >
          ← Ask another
        </button>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-4">
        <div className="flex gap-2 items-start">
          <span className="text-base shrink-0 mt-0.5">✨</span>
          <p className="text-sm text-gray-700 leading-relaxed">{result.answer}</p>
        </div>
      </div>

      {result.rows.length > 0 ? (
        <div className="rounded-xl border border-gray-100 overflow-auto max-h-80">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                {result.columns.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap border-b border-gray-100"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {result.columns.map((col) => (
                    <td
                      key={col}
                      className={`px-3 py-2 whitespace-nowrap ${
                        isAmount(col) ? 'text-gray-900 font-medium tabular-nums' : 'text-gray-600'
                      }`}
                    >
                      {isAmount(col) ? fmt(row[col]) : row[col]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-sm text-gray-400 text-center py-8">No records found</div>
      )}

      {result.rows.length >= 50 && (
        <p className="text-xs text-gray-400 mt-2 text-center">Showing top 50 results</p>
      )}
    </div>
  )
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)

  // Draggable position — starts bottom-right
  const [pos, setPos] = useState(() => ({
    x: window.innerWidth - 140,
    y: window.innerHeight - 76,
  }))
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef({ startMouseX: 0, startMouseY: 0, startPosX: 0, startPosY: 0, moved: false })

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    dragRef.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPosX: pos.x,
      startPosY: pos.y,
      moved: false,
    }
    setDragging(true)

    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - dragRef.current.startMouseX
      const dy = ev.clientY - dragRef.current.startMouseY
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragRef.current.moved = true
      setPos({
        x: Math.max(8, Math.min(window.innerWidth - 130, dragRef.current.startPosX + dx)),
        y: Math.max(8, Math.min(window.innerHeight - 52, dragRef.current.startPosY + dy)),
      })
    }

    function onUp() {
      setDragging(false)
      if (!dragRef.current.moved) setOpen(true)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function handleClose() {
    setOpen(false)
    setResult(null)
  }

  const { data: queries = [] } = useQuery({
    queryKey: ['chat-queries'],
    queryFn: chatApi.queries,
    enabled: open,
    staleTime: Infinity,
  })

  const { mutate: runQuery, isPending, isError } = useMutation({
    mutationFn: chatApi.run,
    onSuccess: (data) => setResult(data),
  })

  const widget = (
    <>
      {/* Floating trigger button — draggable */}
      {!open && (
        <button
          onMouseDown={onMouseDown}
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            zIndex: 9999,
            cursor: dragging ? 'grabbing' : 'grab',
            userSelect: 'none',
          }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-full shadow-lg hover:bg-indigo-700 transition-colors select-none"
          title="Drag to reposition · Click to open AI Insights"
        >
          <span style={{ fontSize: '14px', lineHeight: 1 }}>✨</span>
          <span className="text-sm font-semibold">Ask AI</span>
          {/* subtle drag indicator */}
          <svg className="w-3 h-3 opacity-50 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
        </button>
      )}

      {/* Slide-in panel */}
      {open && (
        <div
          style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '420px', zIndex: 9999 }}
          className="bg-white border-l border-gray-200 shadow-2xl flex flex-col"
        >
          <div className="flex items-center justify-between px-5 py-4 bg-indigo-600 shrink-0">
            <div className="flex items-center gap-2 text-white">
              <span style={{ fontSize: '16px' }}>✨</span>
              <span className="font-semibold text-sm">AI Insights</span>
            </div>
            <button
              onClick={handleClose}
              className="text-indigo-200 hover:text-white transition-colors text-lg leading-none w-6 h-6 flex items-center justify-center"
            >
              ✕
            </button>
          </div>

          <div className="px-5 py-2 bg-indigo-50 border-b border-indigo-100">
            <p className="text-xs text-indigo-600">Powered by Claude — running against your live data</p>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {isPending ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <div className="text-sm">Analyzing your data...</div>
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center h-full text-red-400 gap-3">
                <span style={{ fontSize: '30px' }}>⚠️</span>
                <div className="text-sm text-center">Something went wrong. Please try again.</div>
                <button
                  onClick={() => setResult(null)}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  ← Back to queries
                </button>
              </div>
            ) : result ? (
              <ResultView result={result} onReset={() => setResult(null)} />
            ) : (
              <QueryCardGrid queries={queries} onSelect={(id) => runQuery(id)} />
            )}
          </div>
        </div>
      )}
    </>
  )

  return createPortal(widget, document.body)
}
