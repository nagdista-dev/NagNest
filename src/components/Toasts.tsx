import { CheckCircle2, XCircle } from 'lucide-react'
import { useSites } from '../context/useSites'

export function Toasts() {
  const { toasts } = useSites()
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex w-max max-w-[92vw] -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-3 rounded-full bg-slate-800 py-2 pr-4 pl-3 text-sm text-white shadow-lg ring-1 ring-slate-700"
        >
          {t.type === 'success' ? (
            <CheckCircle2 size={15} className="shrink-0 text-teal-400" />
          ) : (
            <XCircle size={15} className="shrink-0 text-rose-400" />
          )}
          <span className="min-w-0 truncate">{t.message}</span>
          {t.action && (
            <button
              onClick={t.action.onClick}
              className="shrink-0 rounded-full bg-teal-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-teal-500"
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
