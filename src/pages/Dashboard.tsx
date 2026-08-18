import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Search,
  Link2,
  Globe,
  FolderKanban,
  Pin,
  Eye,
  X,
  SlidersHorizontal,
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
  const [quickUrl, setQuickUrl] = useState('')
  const [quickAddUrl, setQuickAddUrl] = useState('')

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

  const totalVisits = sites.reduce((acc, s) => acc + s.visits, 0)
  const pinnedCount = sites.filter((s) => s.pinned).length
  const twitterCount = sites.filter((s) => s.kind === 'twitter').length

  const stats = [
    {
      label: 'Sources',
      value: sites.length,
      icon: Globe,
      color: 'text-teal-600',
      bg: 'bg-teal-50 ring-teal-200/70',
    },
    {
      label: 'Categories',
      value: categories.length,
      icon: FolderKanban,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50 ring-indigo-200/70',
    },
    {
      label: 'Pinned',
      value: pinnedCount,
      icon: Pin,
      color: 'text-amber-600',
      bg: 'bg-amber-50 ring-amber-200/70',
    },
    {
      label: 'Visits',
      value: totalVisits,
      icon: Eye,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 ring-emerald-200/70',
    },
  ]

  const openAdd = () => {
    setEditing(null)
    setQuickAddUrl('')
    setModalOpen(true)
  }

  const quickAdd = () => {
    if (!quickUrl.trim()) {
      notify('Paste a link or handle first', 'error')
      return
    }
    setQuickAddUrl(quickUrl.trim())
    setQuickUrl('')
    setEditing(null)
    setModalOpen(true)
  }

  return (
    <div className="flex flex-col gap-3.5 px-3 pt-2 pb-12 sm:gap-6 sm:px-4 max-w-7xl mx-auto w-full">
      
      {/* ── Top Header & Quick Add Hub ── */}
      <section className="rounded-3xl bg-white p-4 sm:p-6 shadow-sm ring-1 ring-slate-200/80">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                Dashboard
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-black text-white">
                <Sparkles size={10} className="text-amber-400" />
                {sites.length} Active
              </span>
            </div>
            <p className="mt-0.5 text-xs font-semibold text-slate-400">
              Manage your personal feed hub & monitored accounts
            </p>
          </div>
          
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 rounded-2xl bg-slate-900 px-3.5 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-teal-600 active:scale-[0.98]"
          >
            <Plus size={15} />
            <span>New Source</span>
          </button>
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
              placeholder="Paste any website URL or @TwitterHandle…"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/80 pr-4 pl-10 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
            />
            {quickUrl && (
              <button
                type="button"
                onClick={() => setQuickUrl('')}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-teal-500 px-5 text-xs sm:text-sm font-black text-slate-950 shadow-md shadow-teal-500/20 transition hover:bg-teal-400 active:scale-[0.98]"
          >
            <Plus size={16} className="stroke-[3]" />
            <span>Add to Nest</span>
          </button>
        </form>
      </section>

      {/* ── Metric Stats Cards (2 cols on mobile, 4 cols on desktop) ── */}
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3.5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 rounded-2xl bg-white p-3 sm:p-4 shadow-xs ring-1 ring-slate-200/80 transition hover:shadow-sm"
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${s.bg} ${s.color}`}>
              <s.icon size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-black leading-tight text-slate-900 sm:text-xl">{s.value}</p>
              <p className="truncate text-[11px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
            </div>
          </div>
        ))}
      </section>

      {/* ── Search, Type Filter & Sort Controls ── */}
      <section className="rounded-3xl bg-white p-3 sm:p-4 shadow-xs ring-1 ring-slate-200/80 flex flex-col gap-3">
        
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          
          {/* Search bar */}
          <div className="relative flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, domain, or notes…"
              className="h-10 w-full rounded-2xl border border-slate-200 bg-slate-50/80 pr-9 pl-10 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Kind Switcher & Sort Toolbar */}
          <div className="flex items-center justify-between gap-2 sm:justify-start">
            
            {/* Kind filter tabs */}
            <div className="flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200/80">
              <button
                onClick={() => setTypeFilter('all')}
                className={`rounded-lg px-2.5 py-1 text-xs font-black transition ${
                  typeFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                All ({sites.length})
              </button>
              <button
                onClick={() => setTypeFilter('website')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-black transition ${
                  typeFilter === 'website'
                    ? 'bg-white text-teal-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Globe size={12} />
                <span>Web</span>
              </button>
              <button
                onClick={() => setTypeFilter('twitter')}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-black transition ${
                  typeFilter === 'twitter'
                    ? 'bg-white text-sky-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <span className="font-mono text-xs">𝕏</span>
                <span>({twitterCount})</span>
              </button>
            </div>

            {/* Sort selection */}
            <div className="flex items-center gap-1">
              <SlidersHorizontal size={13} className="text-slate-400 hidden sm:inline" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-9 rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 text-xs font-bold text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white"
              >
                <option value="recent">Newest First</option>
                <option value="visits">Most Visited</option>
                <option value="alpha">Alphabetical (A→Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Categories horizontal scroll pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 border-t border-slate-100">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-extrabold transition ${
              categoryFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Categories
          </button>
          {categories.map((c) => {
            const active = categoryFilter === c.id
            const count = sites.filter((s) => s.categoryId === c.id).length
            return (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(active ? 'all' : c.id)}
                className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold transition ${
                  active
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                <span>{c.name}</span>
                <span className="opacity-60 text-[10px]">({count})</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Sites Grid ── */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-4">
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
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 mb-3 shadow-xs">
            <Globe size={26} />
          </div>
          <p className="text-base font-black text-slate-900">
            {query || categoryFilter !== 'all' || typeFilter !== 'all'
              ? 'No sources match your filters'
              : 'Your nest is empty'}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs font-semibold text-slate-400">
            {query || categoryFilter !== 'all' || typeFilter !== 'all'
              ? 'Try resetting the category filter or clearing your search term.'
              : 'Add websites, blogs, or Twitter handles above to start organizing.'}
          </p>
        </div>
      )}

      {/* Add / Edit Site Modal */}
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
