import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BadgeCheck,
  Eye,
  Heart,
  Home,
  Languages,
  Link2,
  MessageCircle,
  Newspaper,
  Plus,
  RefreshCw,
  Repeat2,
  Search,
  Share2,
  Sparkles,
  FolderKanban,
  DatabaseBackup,
  UserPlus,
  Check,
} from 'lucide-react'
import { useSites } from '../context/useSites'
import {
  cacheFeed,
  fetchFeedItems,
  getCachedFeed,
  type FeedItem,
} from '../lib/feed'
import { translateToArabic, containsArabic } from '../lib/translate'
import {
  faviconUrl,
  faviconFallbackUrl,
  domainInitial,
  timeAgo,
  twitterAvatarUrl,
  twitterAvatarFallbackUrl,
} from '../lib/url'
import { SiteModal } from '../components/SiteModal'

function hashNum(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

function CircleAvatar({
  sources,
  letter,
  size = 40,
  rounded = 'rounded-full',
}: {
  sources: string[]
  letter: string
  size?: number
  rounded?: string
}) {
  const [failed, setFailed] = useState(0)
  if (failed >= sources.length) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center bg-slate-200 font-bold text-slate-600 ${rounded}`}
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {letter}
      </div>
    )
  }
  return (
    <img
      src={sources[failed]}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed((f) => f + 1)}
      className={`shrink-0 bg-white object-cover ring-1 ring-slate-200 ${rounded}`}
      style={{ width: size, height: size }}
    />
  )
}

function FeedAvatar({ item, size = 40 }: { item: FeedItem; size?: number }) {
  const user = item.repost ? item.originalAuthor : item.username
  const sources = user
    ? [twitterAvatarUrl(user), twitterAvatarFallbackUrl(user)]
    : [faviconUrl(item.domain), faviconFallbackUrl(item.domain)]
  return (
    <CircleAvatar
      sources={sources}
      letter={domainInitial(user ?? item.domain)}
      size={size}
    />
  )
}

function TweetSkeleton() {
  return (
    <div className="flex animate-pulse gap-3 px-4 py-3">
      <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="flex gap-2">
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="h-3 w-16 rounded bg-slate-100" />
        </div>
        <div className="h-3 w-full rounded bg-slate-100" />
        <div className="h-3 w-5/6 rounded bg-slate-100" />
        <div className="mt-2 h-20 w-full rounded-xl bg-slate-100" />
        <div className="flex gap-10 pt-1">
          <div className="h-3 w-10 rounded bg-slate-100" />
          <div className="h-3 w-10 rounded bg-slate-100" />
          <div className="h-3 w-10 rounded bg-slate-100" />
        </div>
      </div>
    </div>
  )
}

export function Feed() {
  const { sites } = useSites()
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [liked, setLiked] = useState<Set<string>>(new Set())
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [translations, setTranslations] = useState<Map<string, string>>(new Map())
  const [translatingId, setTranslatingId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [quickUrl, setQuickUrl] = useState('')
  const [composer, setComposer] = useState('')
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    const fresh = await fetchFeedItems(sites)
    if (!mounted.current) return
    setItems(fresh)
    cacheFeed(fresh)
    setRefreshing(false)
    setLoading(false)
  }, [sites])

  useEffect(() => {
    if (sites.length === 0) {
      setItems([])
      setLoading(false)
      return
    }
    const cached = getCachedFeed()
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
    }, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [sites, refresh])

  const trending = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of items) {
      const key = item.username ?? item.domain
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [items])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? items.filter(
          (it) =>
            it.title.toLowerCase().includes(q) ||
            it.source.toLowerCase().includes(q) ||
            (it.username ?? it.domain).toLowerCase().includes(q),
        )
      : items
    return list.slice(0, 40)
  }, [items, query])

  const toggleLike = (id: string) => {
    setLiked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleFollow = (key: string) => {
    setFollowing((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleTranslate = async (itemId: string, text: string) => {
    if (translations.has(itemId)) {
      setTranslations((prev) => {
        const next = new Map(prev)
        next.delete(itemId)
        return next
      })
      return
    }
    setTranslatingId(itemId)
    try {
      const translated = await translateToArabic(text)
      setTranslations((prev) => new Map(prev).set(itemId, translated))
    } catch {
      // translation service unavailable — keep original
    }
    setTranslatingId(null)
  }

  const openModalWith = (url: string) => {
    setQuickUrl(url)
    setModalOpen(true)
  }

  return (
    <div className="mx-auto flex max-w-6xl items-start gap-6">
      {/* ── Left nav (Twitter-style) ─────────────────────────── */}
      <aside className="sticky top-20 hidden w-56 shrink-0 flex-col gap-1 lg:flex">
        <button
          onClick={() => openModalWith('')}
          className="mb-2 flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700"
        >
          <Plus size={16} />
          Add site
        </button>
        <a
          href="#/"
          className="flex items-center gap-3 rounded-full px-3 py-2.5 text-[15px] font-medium text-slate-700 transition hover:bg-slate-900/5 hover:text-slate-900"
        >
          <Home size={22} />
          Home
        </a>
        <a
          href="#/feed"
          className="flex items-center gap-3 rounded-full bg-slate-900 px-3 py-2.5 text-[15px] font-bold text-white transition"
        >
          <Newspaper size={22} />
          Latest News
        </a>
        <a
          href="#/categories"
          className="flex items-center gap-3 rounded-full px-3 py-2.5 text-[15px] font-medium text-slate-700 transition hover:bg-slate-900/5 hover:text-slate-900"
        >
          <FolderKanban size={22} />
          Categories
        </a>
        <a
          href="#/backup"
          className="flex items-center gap-3 rounded-full px-3 py-2.5 text-[15px] font-medium text-slate-700 transition hover:bg-slate-900/5 hover:text-slate-900"
        >
          <DatabaseBackup size={22} />
          Backup
        </a>
        <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-bold text-slate-900">Your nest</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {sites.length} sources · {items.length} headlines right now
          </p>
        </div>
      </aside>

      {/* ── Center feed column ───────────────────────────────── */}
      <div className="min-w-0 flex-1 sm:max-w-[620px]">
        <div className="sticky top-16 z-30 -mx-4 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-0 sm:rounded-t-2xl sm:border-x sm:border-t">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-extrabold text-slate-900">Latest News</h2>
            <Sparkles size={18} className="text-amber-500" />
          </div>
          <button
            onClick={() => void refresh()}
            disabled={refreshing || loading}
            title="Refresh"
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-teal-600 disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="overflow-hidden rounded-b-2xl bg-white shadow-sm ring-1 ring-slate-200 sm:rounded-2xl sm:ring-0">
          {/* Composer — like "What's happening?" */}
          <div className="border-b border-slate-200 px-4 pt-3 pb-2.5">
            <label className="block text-[15px] font-bold text-slate-900">
              What are you reading?
            </label>
            <p className="mt-0.5 text-xs text-slate-500">
              Paste a link to save it to your nest
            </p>
            <form
              className="mt-2.5 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                openModalWith(composer)
                setComposer('')
              }}
            >
              <div className="relative flex-1">
                <Link2
                  size={14}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  dir="ltr"
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  placeholder="https://…"
                  className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pr-3 pl-8 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>
              <button
                type="submit"
                className="rounded-full bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-teal-700"
              >
                Add
              </button>
            </form>
          </div>

          {/* Timeline */}
          {loading && visible.length === 0 ? (
            <div>
              <TweetSkeleton />
              <TweetSkeleton />
              <TweetSkeleton />
              <TweetSkeleton />
            </div>
          ) : visible.length > 0 ? (
            <div>
              {visible.map((item, i) => {
                const itemId = `${item.domain}-${i}-${item.publishedAt ?? ''}`
                const isLiked = liked.has(itemId)
                const urlHash = hashNum(item.url)
                const baseLikes = 8 + (urlHash % 400)
                const likes = baseLikes + (isLiked ? 1 : 0)
                const replies = 2 + (hashNum(item.url + 'r') % 60)
                const reposts = 3 + (hashNum(item.url + 'p') % 90)
                const views = 800 + (urlHash % 12000)
                return (
                  <article
                    key={itemId}
                    className="group flex cursor-pointer gap-3 border-b border-slate-200 px-4 py-3 transition hover:bg-slate-50"
                    onClick={() =>
                      window.open(item.url, '_blank', 'noopener,noreferrer')
                    }
                    role="link"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        window.open(item.url, '_blank', 'noopener,noreferrer')
                      }
                    }}
                  >
                    <FeedAvatar item={item} />
                    <div className="min-w-0 flex-1">
                      {item.repost && (
                        <div
                          className="mb-1 flex items-center gap-1.5 text-xs text-slate-500"
                          dir="ltr"
                        >
                          <Repeat2 size={13} />
                          <span>
                            @{item.repostedBy ?? ''} reposted
                          </span>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-x-1 text-[15px] leading-tight">
                        <span className="font-bold text-slate-900 hover:underline">
                          {item.repost && item.originalAuthor
                            ? `@${item.originalAuthor}`
                            : item.source}
                        </span>
                        <BadgeCheck
                          size={16}
                          className={
                            item.username && !item.repost ? 'text-sky-500' : 'text-slate-400'
                          }
                        />
                        <span className="truncate text-slate-500">
                          @
                          {item.repost && item.originalAuthor
                            ? item.originalAuthor
                            : item.username ?? item.domain}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="shrink-0 text-slate-500">
                          {item.publishedAt ? timeAgo(item.publishedAt) : 'just now'}
                        </span>
                      </div>

                      <p className="mt-0.5 text-[15px] leading-snug whitespace-pre-wrap text-slate-900">
                        {item.title}
                      </p>

                      {item.username && !containsArabic(item.title) && (
                        <div className="mt-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              void toggleTranslate(itemId, item.title)
                            }}
                            disabled={translatingId === itemId}
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-sky-600 transition hover:bg-sky-500/10 disabled:opacity-50"
                          >
                            <Languages
                              size={13}
                              className={translatingId === itemId ? 'animate-pulse' : ''}
                            />
                            {translations.has(itemId)
                              ? 'Show original'
                              : translatingId === itemId
                                ? 'Translating…'
                                : 'Translate'}
                          </button>
                          {translations.has(itemId) && (
                            <div
                              dir="rtl"
                              className="mt-1.5 rounded-2xl bg-teal-600/5 px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 ring-1 ring-teal-600/15"
                            >
                              {translations.get(itemId)}
                            </div>
                          )}
                        </div>
                      )}

                      {!item.username && (
                        <div
                          className="mt-3 flex items-center gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 transition group-hover:border-slate-300"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <CircleAvatar
                            sources={[
                              faviconUrl(item.domain),
                              faviconFallbackUrl(item.domain),
                            ]}
                            letter={domainInitial(item.domain)}
                            size={36}
                            rounded="rounded-xl"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {item.title}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500" dir="ltr">
                              {item.domain}
                              <span className="text-slate-400">↗</span>
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="mt-2.5 flex max-w-[425px] items-center justify-between text-slate-500">
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 rounded-full p-1.5 text-xs transition hover:bg-sky-500/10 hover:text-sky-500"
                        >
                          <MessageCircle size={15} />
                          <span>{fmtCount(replies)}</span>
                        </button>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 rounded-full p-1.5 text-xs transition hover:bg-emerald-500/10 hover:text-emerald-500"
                        >
                          <Repeat2 size={16} />
                          <span>{fmtCount(reposts)}</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleLike(itemId)
                          }}
                          className={`flex items-center gap-1.5 rounded-full p-1.5 text-xs transition ${
                            isLiked
                              ? 'text-rose-500'
                              : 'hover:bg-rose-500/10 hover:text-rose-500'
                          }`}
                        >
                          <Heart size={15} fill={isLiked ? 'currentColor' : 'none'} />
                          <span>{fmtCount(likes)}</span>
                        </button>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 rounded-full p-1.5 text-xs transition hover:bg-slate-900/5"
                        >
                          <Eye size={16} />
                          <span>{fmtCount(views)}</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigator.clipboard.writeText(item.url).catch(() => undefined)
                          }}
                          title="Copy link"
                          className="rounded-full p-1.5 transition hover:bg-sky-500/10 hover:text-sky-500"
                        >
                          <Share2 size={15} />
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="px-6 py-14 text-center">
              <p className="text-sm font-semibold text-slate-900">
                {query ? 'No headlines match your search' : 'No headlines yet'}
              </p>
              <p className="mx-auto mt-1 max-w-xs text-xs text-slate-500">
                {query
                  ? 'Try a different keyword.'
                  : 'Hit refresh, or add more news sites and Twitter accounts.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Right sidebar ────────────────────────────────────── */}
      <aside className="sticky top-20 hidden w-80 shrink-0 flex-col gap-4 xl:flex">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search news"
            className="w-full rounded-full border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
        </div>

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <h3 className="px-4 pt-3 pb-1 text-lg font-extrabold text-slate-900">
            Trending in your nest
          </h3>
          {trending.length > 0 ? (
            trending.map(([key, count], i) => (
              <button
                key={key}
                onClick={() => setQuery(key)}
                className="block w-full px-4 py-2.5 text-left transition hover:bg-slate-50"
              >
                <p className="text-xs text-slate-500">Trending {i + 1}</p>
                <p className="text-[15px] font-bold text-slate-900">@{key}</p>
                <p className="text-xs text-slate-500">
                  {count} post{count === 1 ? '' : 's'} · your sources
                </p>
              </button>
            ))
          ) : (
            <p className="px-4 py-6 text-center text-xs text-slate-400">
              No headlines yet
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <h3 className="px-4 pt-3 pb-1 text-lg font-extrabold text-slate-900">
            Who to follow
          </h3>
          {sites.slice(0, 5).map((site) => {
            const key = site.kind === 'twitter' ? extractUser(site.url) : site.domain
            const isFollowing = following.has(key)
            return (
              <div
                key={site.id}
                className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-slate-50"
              >
                <CircleAvatar
                  sources={
                    site.kind === 'twitter'
                      ? [twitterAvatarUrl(extractUser(site.url)), twitterAvatarFallbackUrl(extractUser(site.url))]
                      : [faviconUrl(site.domain), faviconFallbackUrl(site.domain)]
                  }
                  letter={domainInitial(site.kind === 'twitter' ? extractUser(site.url) : site.domain)}
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-sm font-bold text-slate-900">
                    {site.title}
                    {site.kind === 'twitter' && (
                      <BadgeCheck size={14} className="shrink-0 text-sky-500" />
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-500" dir="ltr">
                    @{site.kind === 'twitter' ? extractUser(site.url) : site.domain}
                  </p>
                </div>
                <button
                  onClick={() => toggleFollow(key)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                    isFollowing
                      ? 'bg-slate-900/5 text-slate-900 ring-1 ring-slate-300'
                      : 'bg-slate-900 text-white hover:bg-teal-700'
                  }`}
                >
                  {isFollowing ? (
                    <span className="inline-flex items-center gap-1">
                      <Check size={12} />
                      Following
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <UserPlus size={12} />
                      Follow
                    </span>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </aside>

      <SiteModal
        open={modalOpen}
        editing={null}
        defaultUrl={quickUrl}
        onClose={() => {
          setModalOpen(false)
          setQuickUrl('')
        }}
      />
    </div>
  )
}

function extractUser(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/^\/+/, '').replace(/\/+$/, '')
    return path.split('/')[0] ?? url
  } catch {
    return url
  }
}
