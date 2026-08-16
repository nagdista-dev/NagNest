import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Search,
  Link2,
  Globe,
  FolderKanban,
  Pin,
  Eye,
  Sparkles,
} from 'lucide-react'
import { useSites } from '../context/useSites'
import { SiteCard } from '../components/SiteCard'
import { SiteModal } from '../components/SiteModal'
import type { Site } from '../types'

type SortKey = 'recent' | 'visits' | 'alpha'
type TypeFilter = 'all' | 'website' | 'twitter'

export function Dashboard() {
  const { sites, categories, notify } = useSites()
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [sort, setSort] = useState<SortKey>('recent')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Site | null>(null)
  const [quickAddUrl, setQuickAddUrl] = useState('')
  const [quickUrl, setQuickUrl] = useState('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        setEditing(null)
        setQuickAddUrl('')
        setModalOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = sites.filter((s) => {
      if (categoryFilter !== 'all' && s.categoryId !== categoryFilter) return false
      if (typeFilter === 'twitter' && s.kind !== 'twitter') return false
      if (typeFilter === 'website' && s.kind === 'twitter') return false
      if (!q) return true
      return (
        s.title.toLowerCase().includes(q) ||
        s.domain.toLowerCase().includes(q) ||
        s.note.toLowerCase().includes(q)
      )
    })
    const pinned = list.filter((s) => s.pinned)
    const rest = list.filter((s) => !s.pinned)
    const sortFn = (a: Site, b: Site): number => {
      if (sort === 'alpha') return a.title.localeCompare(b.title)
      if (sort === 'visits') return b.visits - a.visits
      return b.createdAt - a.createdAt
    }
    return [...pinned.sort(sortFn), ...rest.sort(sortFn)]
  }, [sites, query, categoryFilter, typeFilter, sort])

  const activeCategory = categories.find((c) => c.id === categoryFilter)
  const totalVisits = sites.reduce((acc, s) => acc + s.visits, 0)
  const pinnedCount = sites.filter((s) => s.pinned).length
  const twitterCount = sites.filter((s) => s.kind === 'twitter').length

  const stats = [
    {
      label: 'Saved Sources',
      value: sites.length,
      icon: Globe,
      color: 'text-teal-400',
      bg: 'bg-teal-500/10 ring-teal-500/20',
    },
    {
      label: 'Categories',
      value: categories.length,
      icon: FolderKanban,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 ring-indigo-500/20',
    },
    {
      label: 'Pinned',
      value: pinnedCount,
      icon: Pin,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 ring-amber-500/20',
    },
    {
      label: 'Visits',
      value: totalVisits,
      icon: Eye,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 ring-emerald-500/20',
    },
  ]

  const openAdd = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const quickAdd = () => {
    if (!quickUrl.trim()) {
      notify('Paste a link first', 'error')
      return
    }
    setQuickAddUrl(quickUrl.trim())
    setQuickUrl('')
    setEditing(null)
    setModalOpen(true)
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {/* ── Nagdista FAJR Hero Banner ─────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-fajr p-5 sm:p-8 md:p-10 shadow-xl ring-1 ring-white/10 text-white">
        {/* Ambient background glows */}
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 sm:h-72 w-64 sm:w-72 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-12 h-56 sm:h-64 w-56 sm:w-64 rounded-full bg-amber-400/15 blur-3xl" />
        
        {/* Subtle Watermark Logo */}
        <div className="pointer-events-none absolute right-8 bottom-4 opacity-5 font-mono text-8xl md:text-9xl font-black select-none hidden sm:block">
          {'{N}'}
        </div>

        <div className="relative z-10 flex flex-col gap-5 sm:gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-xs font-extrabold text-amber-300 ring-1 ring-amber-400/30">
                  <Sparkles size={12} />
                  NAGDISTA ECOSYSTEM
                </span>
              </div>
              <h2 className="font-heading text-xl sm:text-3xl font-extrabold text-white tracking-tight">
                Welcome back to your nest
              </h2>
              <p className="mt-1 text-xs sm:text-sm md:text-base text-slate-300 font-medium">
                Keep Learning, Keep Building · <span className="text-teal-300 font-bold">{sites.length} sources</span>
              </p>
            </div>

            <div className="hidden md:flex items-center gap-2 self-start sm:self-center">
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-300 bg-white/10 px-3 py-1.5 rounded-full ring-1 ring-white/10">
                Press <kbd className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-xs font-bold text-amber-300">N</kbd> to add
              </span>
            </div>
          </div>

          {/* Quick Add Bar */}
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              quickAdd()
            }}
          >
            <div className="relative flex-1">
              <Link2
                size={16}
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                dir="ltr"
                value={quickUrl}
                onChange={(e) => setQuickUrl(e.target.value)}
                placeholder="Paste any link — https://openai.com/blog or @twitter"
                className="w-full rounded-2xl border border-white/15 bg-white/10 px-3.5 py-3 pl-10 text-xs sm:text-sm text-white placeholder:text-slate-400 shadow-inner backdrop-blur-md outline-none transition focus:border-teal-400 focus:bg-white/15 focus:ring-2 focus:ring-teal-400/30"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-500 px-5 py-3 text-xs sm:text-sm font-bold text-slate-950 shadow-lg shadow-teal-500/25 transition hover:bg-teal-400 hover:scale-[1.01] active:scale-[0.98]"
            >
              <Plus size={16} className="stroke-[3]" />
              Add Source
            </button>
          </form>
        </div>
      </section>

      {/* ── Stats Metric Cards ─────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-3.5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 sm:gap-3.5 rounded-2xl bg-white p-3.5 sm:p-4 shadow-sm ring-1 ring-slate-200/80 transition hover:shadow-md hover:ring-teal-200"
          >
            <div className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${s.bg} ${s.color}`}>
              <s.icon size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-xl leading-tight font-extrabold text-slate-900">{s.value}</p>
              <p className="truncate text-[11px] sm:text-xs font-semibold text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </section>

      {/* ── Filter & Search Toolbar ────────────────────────────── */}
      <section className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your saved sites, domains, notes…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-xs sm:text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          {/* Quick Kind Switcher & Sort */}
          <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex items-center rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200">
              <button
                onClick={() => setTypeFilter('all')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  typeFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setTypeFilter('website')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  typeFilter === 'website'
                    ? 'bg-white text-teal-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe size={11} />
                Web
              </button>
              <button
                onClick={() => setTypeFilter('twitter')}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold transition ${
                  typeFilter === 'twitter'
                    ? 'bg-white text-sky-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="font-bold text-[10px]">𝕏</span>
                ({twitterCount})
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 shadow-xs outline-none focus:border-teal-500"
              >
                <option value="recent">Newest</option>
                <option value="visits">Most Visited</option>
                <option value="alpha">A→Z</option>
              </select>

              <button
                onClick={openAdd}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-teal-600"
              >
                <Plus size={14} className="stroke-[3]" />
                New
              </button>
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-3.5 px-3.5 sm:mx-0 sm:px-0 sm:flex-wrap">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition ${
              categoryFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            All <span className="opacity-70">({sites.length})</span>
          </button>
          {categories.map((c) => {
            const count = sites.filter((s) => s.categoryId === c.id).length
            const active = categoryFilter === c.id
            return (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(active ? 'all' : c.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition ${
                  active
                    ? 'text-white shadow-xs'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
                style={active ? { backgroundColor: c.color } : undefined}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: active ? 'white' : c.color }}
                />
                {c.name} <span className={active ? 'opacity-80' : 'opacity-50'}>({count})</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Sites Grid ─────────────────────────────────────────── */}
      {filtered.length > 0 ? (
        <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((site) => (
            <SiteCard
              key={site.id}
              site={site}
              onEdit={(s) => {
                setEditing(s)
                setModalOpen(true)
              }}
            />
          ))}
        </section>
      ) : (
        <section className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-slate-300 bg-white/60 px-5 py-14 text-center shadow-inner">
          {sites.length === 0 ? (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-600 ring-1 ring-teal-500/20">
                <Link2 size={24} />
              </div>
              <h3 className="font-heading text-base sm:text-lg font-bold text-slate-900">
                Your nest is empty
              </h3>
              <p className="max-w-md text-xs sm:text-sm text-slate-500 leading-relaxed">
                Paste any URL or Twitter account in the box above — NagNest organizes your entire daily reading in one place.
              </p>
              <button
                onClick={openAdd}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-teal-600 transition"
              >
                <Plus size={16} />
                Add your first source
              </button>
            </>
          ) : (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 ring-1 ring-slate-200">
                <Search size={20} />
              </div>
              <h3 className="font-heading text-sm sm:text-base font-bold text-slate-900">
                No matching sources
              </h3>
              <p className="max-w-sm text-xs text-slate-500">
                {categoryFilter !== 'all'
                  ? `No sources in "${activeCategory?.name ?? ''}" match your search.`
                  : `No sources match "${query}".`}
              </p>
              <button
                onClick={() => {
                  setQuery('')
                  setCategoryFilter('all')
                  setTypeFilter('all')
                }}
                className="mt-1 text-xs font-semibold text-teal-600 hover:underline"
              >
                Clear all filters
              </button>
            </>
          )}
        </section>
      )}

      {/* Site Modal */}
      <SiteModal
        open={modalOpen}
        editing={editing}
        defaultUrl={quickAddUrl}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
          setQuickAddUrl('')
        }}
      />
    </div>
  )
}
