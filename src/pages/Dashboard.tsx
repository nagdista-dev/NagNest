import { useMemo, useState } from 'react'
import { Plus, Search, Link2 } from 'lucide-react'
import { useSites } from '../context/SitesContext'
import { SiteCard } from '../components/SiteCard'
import { SiteModal } from '../components/SiteModal'
import type { Site } from '../types'

type SortKey = 'recent' | 'visits' | 'alpha'

export function Dashboard() {
  const { sites, categories, notify } = useSites()
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [sort, setSort] = useState<SortKey>('recent')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Site | null>(null)
  const [quickAddUrl, setQuickAddUrl] = useState('')
  const [quickUrl, setQuickUrl] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = sites.filter((s) => {
      if (categoryFilter !== 'all' && s.categoryId !== categoryFilter) return false
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
  }, [sites, query, categoryFilter, sort])

  const activeCategory = categories.find((c) => c.id === categoryFilter)
  const totalVisits = sites.reduce((acc, s) => acc + s.visits, 0)

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
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 px-6 py-8 sm:px-8">
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-5">
          <div>
            <h2 className="text-xl font-bold text-white sm:text-2xl">
              Welcome back to your nest
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {sites.length} saved sites · {totalVisits} visits recorded
            </p>
          </div>

          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              quickAdd()
            }}
          >
            <div className="relative flex-1">
              <Link2
                size={15}
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                dir="ltr"
                value={quickUrl}
                onChange={(e) => setQuickUrl(e.target.value)}
                placeholder="Paste a link — https://openai.com/blog"
                className="w-full rounded-xl border-0 bg-white/10 py-2.5 pr-4 pl-10 text-sm text-white outline-none ring-1 ring-white/15 placeholder:text-slate-400 focus:bg-white/15 focus:ring-teal-400"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-400"
            >
              <Plus size={15} />
              Add site
            </button>
          </form>
        </div>
      </section>

      <section className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your sites, domains, notes…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none focus:border-teal-500"
          >
            <option value="recent">Newest</option>
            <option value="visits">Most visited</option>
            <option value="alpha">A → Z</option>
          </select>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
          >
            <Plus size={15} />
            New
          </button>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            categoryFilter === 'all'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          All <span className="opacity-60">{sites.length}</span>
        </button>
        {categories.map((c) => {
          const count = sites.filter((s) => s.categoryId === c.id).length
          const active = categoryFilter === c.id
          return (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(active ? 'all' : c.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                active ? 'text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
              style={active ? { backgroundColor: c.color } : undefined}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: active ? 'white' : c.color }}
              />
              {c.name} <span className={active ? 'opacity-70' : 'opacity-50'}>{count}</span>
            </button>
          )
        })}
      </section>

      {filtered.length > 0 ? (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((site) => (
            <SiteCard key={site.id} site={site} onEdit={(s) => {
              setEditing(s)
              setModalOpen(true)
            }} />
          ))}
        </section>
      ) : (
        <section className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center">
          {sites.length === 0 ? (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600/10 text-teal-600">
                <Link2 size={24} />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Your nest is empty</h3>
              <p className="max-w-sm text-sm text-slate-500">
                Every time you read about AI on a site you like, paste its link above —
                LinkNest keeps them all in one dashboard.
              </p>
              <button
                onClick={openAdd}
                className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
              >
                <Plus size={15} />
                Add your first site
              </button>
            </>
          ) : (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900/5 text-slate-400">
                <Search size={24} />
              </div>
              <h3 className="text-base font-semibold text-slate-900">No matches found</h3>
              <p className="max-w-sm text-sm text-slate-500">
                {categoryFilter !== 'all'
                  ? `Nothing in "${activeCategory?.name ?? ''}" matches "${query}".`
                  : `Nothing matches "${query}". Try a different keyword.`}
              </p>
              <button
                onClick={() => {
                  setQuery('')
                  setCategoryFilter('all')
                }}
                className="mt-1 text-sm font-medium text-teal-600 hover:underline"
              >
                Clear filters
              </button>
            </>
          )}
        </section>
      )}

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
