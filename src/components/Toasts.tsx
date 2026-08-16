import { CheckCircle2, XCircle } from 'lucide-react'
import { useSites } from '../context/SitesContext'

export function Toasts() {
  const { toasts } = useSites()
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg"
        >
          {t.type === 'success' ? (
            <CheckCircle2 size={15} className="text-teal-400" />
          ) : (
            <XCircle size={15} className="text-rose-400" />
          )}
          {t.message}
        </div>
      ))}
    </div>
  )
}
