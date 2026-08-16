import { useCallback, useEffect, useRef, useState } from 'react'
import { Radio, RefreshCw } from 'lucide-react'
import { useSites } from '../context/useSites'
import {
  cacheTicker,
  fetchTickerItems,
  getCachedTicker,
  type TickerItem,
} from '../lib/ticker'

export function Ticker() {
  const { sites } = useSites()
  const [items, setItems] = useState<TickerItem[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    const fresh = await fetchTickerItems(sites)
    if (!mounted.current) return
    setItems(fresh)
    cacheTicker(fresh)
    setRefreshing(false)
    setLoading(false)
  }, [sites])

  useEffect(() => {
    if (sites.length === 0) {
      setItems([])
      setLoading(false)
      return
    }
    const cached = getCachedTicker()
    if (cached && cached.length) {
      setItems(cached)
      setLoading(false)
      void refresh()
    } else {
      setLoading(true)
      void refresh()
    }
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [sites, refresh])

  const group = items.filter((it) => it && it.url && it.title).slice(0, 20)
  const hasItems = group.length > 0

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex h-10 items-stretch">
        <div className="flex shrink-0 items-center gap-1.5 bg-slate-900 px-3.5 text-[11px] font-extrabold tracking-widest text-teal-400 uppercase border-r border-slate-800">
          <Radio size={13} className={loading ? 'animate-pulse text-amber-400' : 'text-teal-400'} />
          Live Ticker
        </div>

        <div className="relative min-w-0 flex-1 overflow-hidden">
          {loading && !hasItems ? (
            <div className="flex h-full items-center px-4 text-xs text-slate-500">
              Loading headlines from your sites…
            </div>
          ) : hasItems ? (
            <div className="ticker-track flex h-full items-center">
              {[0, 1].map((dup) => (
                <div key={dup} className="flex shrink-0 items-center">
                  {group.map((item, i) => (
                    <a
                      key={`${dup}-${i}`}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/tick flex shrink-0 items-center gap-2 px-4 text-xs text-slate-600 transition hover:text-slate-900"
                    >
                      <span className="font-semibold text-teal-600 group-hover/tick:text-teal-700">
                        {item.source}
                      </span>
                      <span className="max-w-72 truncate sm:max-w-md">{item.title}</span>
                      <span className="text-slate-300">•</span>
                    </a>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center px-4 text-xs text-slate-500">
              No headlines available — add more news sites to fill the ticker
            </div>
          )}
        </div>

        <button
          onClick={() => void refresh()}
          disabled={refreshing || loading}
          title="Refresh headlines"
          className="flex shrink-0 items-center gap-1.5 border-l border-slate-200 px-3 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          <span className="hidden text-[11px] font-medium sm:inline">
            {refreshing ? 'Loading' : 'Refresh'}
          </span>
        </button>
      </div>
    </div>
  )
}
