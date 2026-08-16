import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BadgeCheck,
  Eye,
  Heart,
  Languages,
  Link2,
  ExternalLink,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  Repeat2,
  Search,
  Share2,
  Sparkles,
  UserPlus,
  Check,
  Globe,
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
  twitterAvatarSources,
} from '../lib/url'

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

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
    rsquo: "'",
    lsquo: "'",
    rdquo: '"',
    ldquo: '"',
    ndash: '-',
    mdash: '-',
  }
  let next = value
  for (let i = 0; i < 2; i++) {
    next = next
      .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
        String.fromCodePoint(Number.parseInt(code, 16)),
      )
      .replace(/&#(\d+);/g, (_, code: string) =>
        String.fromCodePoint(Number.parseInt(code, 10)),
      )
      .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match)
  }
  return next
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
        className={`flex shrink-0 items-center justify-center bg-slate-900 font-extrabold text-teal-400 ${rounded}`}
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
      className={`shrink-0 bg-white object-cover ring-1 ring-slate-200 shadow-sm ${rounded}`}
      style={{ width: size, height: size }}
    />
  )
}

function FeedAvatar({ item, size = 40 }: { item: FeedItem; size?: number }) {
  const user = item.repost ? item.originalAuthor : item.username
  const sources = user
    ? twitterAvatarSources(user)
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
    <div className="flex animate-pulse gap-3 px-3.5 py-4 border-b border-slate-100 sm:gap-3.5 sm:px-5">
      <div className="h-9 w-9 shrink-0 rounded-full bg-slate-200 sm:h-10 sm:w-10" />
      <div className="flex-1 space-y-2.5 pt-1">
        <div className="flex gap-2">
          <div className="h-3.5 w-28 rounded bg-slate-200" />
          <div className="h-3.5 w-16 rounded bg-slate-100" />
        </div>
        <div className="h-3.5 w-full rounded bg-slate-100" />
        <div className="h-3.5 w-4/5 rounded bg-slate-100" />
        <div className="flex gap-8 pt-2">
          <div className="h-3 w-10 rounded bg-slate-100" />
          <div className="h-3 w-10 rounded bg-slate-100" />
          <div className="h-3 w-10 rounded bg-slate-100" />
        </div>
      </div>
    </div>
  )
}

/** Rich formatting for tweet text: highlights links, mentions, hashtags */
function FormattedPostContent({ text }: { text: string }) {
  const parts = useMemo(() => {
    const cleanText = decodeHtmlEntities(text)
    const regex = /(https?:\/\/[^\s]+|@[A-Za-z0-9_]+|#[A-Za-z0-9_\u0600-\u06FF]+)/g
    const tokens = cleanText.split(regex)
    return tokens.map((token, idx) => {
      if (/^https?:\/\//i.test(token)) {
        let clean = token
        try {
          const u = new URL(token)
          clean = u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname.slice(0, 15) + '…' : '')
        } catch {
          clean = token.slice(0, 24) + '…'
        }
        return (
          <a
            key={idx}
            href={token}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mx-0.5 inline-flex max-w-full items-center gap-1 rounded-md bg-teal-50 px-1.5 py-0.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-100 hover:text-teal-900"
            dir="ltr"
          >
            <Link2 size={11} className="shrink-0 text-teal-600" />
            <span className="max-w-[150px] truncate sm:max-w-[220px]">{clean}</span>
          </a>
        )
      }
      if (/^@[A-Za-z0-9_]+$/i.test(token)) {
        const handle = token.replace(/^@/, '')
        return (
          <a
            key={idx}
            href={`https://x.com/${handle}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-sky-600 hover:underline hover:text-sky-700"
            dir="ltr"
          >
            {token}
          </a>
        )
      }
      if (/^#[A-Za-z0-9_\u0600-\u06FF]+$/i.test(token)) {
        return (
          <span key={idx} className="font-semibold text-teal-600 hover:underline">
            {token}
          </span>
        )
      }
      return token
    })
  }, [text])

  return <p className="mt-1 overflow-hidden break-words text-[15px] leading-relaxed whitespace-pre-wrap text-slate-950 font-semibold sm:text-[16px]">{parts}</p>
}

/** Parses raw tweet title to extract clean text, image URLs, and reply/repost metadata */
function parseTweetDisplay(item: FeedItem): {
  cleanTitle: string
  replyTo?: string
  isRepost: boolean
  repostedBy?: string
  originalAuthor?: string
  displayImage?: string
} {
  let title = decodeHtmlEntities(item.title)
  let replyTo = item.replyTo
  let isRepost = !!item.repost
  let repostedBy = item.repostedBy
  let originalAuthor = item.originalAuthor
  let displayImage = item.image

  // Check for RT
  const rtMatch = title.match(/^\s*RT\s+by\s+@([A-Za-z0-9_]+):\s*(.*)$/s) || title.match(/^\s*RT\s+@([A-Za-z0-9_]+):\s*(.*)$/s)
  if (rtMatch) {
    isRepost = true
    repostedBy = item.username || repostedBy
    originalAuthor = rtMatch[1]
    title = rtMatch[2]?.trim() || title
  }

  // Check for Reply
  const replyMatch = title.match(/^\s*(?:R\s+to|Replying\s+to|In\s+reply\s+to)\s+@([A-Za-z0-9_]+):\s*(.*)$/si)
  if (replyMatch) {
    replyTo = replyMatch[1]
    title = replyMatch[2]?.trim() || title
  }

  // Extract inline image if found in text and not in item.image
  const imgUrlMatch = title.match(/(https?:\/\/[^\s]+?\.(?:png|jpe?g|webp|gif))/i)
  if (imgUrlMatch && !displayImage) {
    displayImage = imgUrlMatch[1]
    title = title.replace(imgUrlMatch[0], '').trim()
  }

  // Clean raw [image] tags or pic.twitter.com from text
  title = title
    .replace(/\[\s*image\s*\]/gi, '')
    .replace(/(?:https?:\/\/)?pic\.twitter\.com\/\S+/gi, '')
    .trim()

  return {
    cleanTitle: title,
    replyTo,
    isRepost,
    repostedBy,
    originalAuthor,
    displayImage,
  }
}

export function Feed() {
  const { sites } = useSites()
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'twitter' | 'web'>('all')
  const [liked, setLiked] = useState<Set<string>>(new Set())
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [translations, setTranslations] = useState<Map<string, string>>(new Map())
  const [translatingId, setTranslatingId] = useState<string | null>(null)
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
    let list = items

    if (filterType === 'twitter') {
      list = list.filter((it) => !!it.username)
    } else if (filterType === 'web') {
      list = list.filter((it) => !it.username)
    }

    if (q) {
      list = list.filter(
        (it) =>
          it.title.toLowerCase().includes(q) ||
          it.source.toLowerCase().includes(q) ||
          (it.username ?? it.domain).toLowerCase().includes(q),
      )
    }
    return list.slice(0, 40)
  }, [items, query, filterType])

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
      // ignore
    }
    setTranslatingId(null)
  }

  const twitterCount = items.filter((it) => !!it.username).length
  const webCount = items.filter((it) => !it.username).length

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-4 overflow-x-hidden px-3.5 pt-0 sm:px-0 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[260px_minmax(0,1fr)_300px]">
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] min-w-0 flex-col gap-4 overflow-y-auto py-3 xl:flex">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-extrabold leading-tight text-slate-900">
                  Latest News
                </h2>
                <span className="flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-teal-500" />
              </div>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                {items.length} headlines from {sites.length} source{sites.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <button
            onClick={() => void refresh()}
            disabled={refreshing || loading}
            title="Refresh timeline"
            className="mt-4 flex h-10 w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-slate-900 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin text-teal-300' : ''} />
            <span>{refreshing ? 'Updating...' : 'Refresh'}</span>
          </button>

          <label className="relative mt-3 block">
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search news"
              className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pr-4 pl-9 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
            />
          </label>

          <div className="mt-4 grid gap-1">
            <button
              onClick={() => setFilterType('all')}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                filterType === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span>All</span>
              <span>{items.length}</span>
            </button>
            <button
              onClick={() => setFilterType('twitter')}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                filterType === 'twitter'
                  ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-100'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span>X / Twitter</span>
              <span>{twitterCount}</span>
            </button>
            <button
              onClick={() => setFilterType('web')}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                filterType === 'web'
                  ? 'bg-teal-50 text-teal-700 ring-1 ring-teal-100'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <Globe size={12} />
                Web
              </span>
              <span>{webCount}</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 py-3 sm:py-0 xl:py-3">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm xl:hidden">
          <div className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5 sm:py-3.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-extrabold leading-tight text-slate-900">
                  Latest News
                </h2>
                <span className="flex h-2 w-2 shrink-0 rounded-full bg-teal-500 animate-pulse" />
              </div>
              <p className="mt-0.5 truncate text-xs font-semibold text-slate-500 sm:text-sm">
                {items.length} headlines from {sites.length} source{sites.length === 1 ? '' : 's'}
              </p>
            </div>
            <button
              onClick={() => void refresh()}
              disabled={refreshing || loading}
              title="Refresh timeline"
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-slate-900 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50 sm:bg-slate-100 sm:text-slate-700 sm:hover:bg-teal-50 sm:hover:text-teal-700"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin text-teal-600' : ''} />
              <span>{refreshing ? 'Updating...' : 'Refresh'}</span>
            </button>
          </div>

          <div className="px-4 pb-2 lg:hidden">
            <label className="relative block">
              <Search
                size={15}
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search news and posts"
                className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pr-4 pl-9 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
              />
            </label>
          </div>

          {/* Quick Sub-tabs */}
          <div className="flex border-t border-slate-100 px-2 sm:px-4">
            <button
              onClick={() => setFilterType('all')}
              className={`flex-1 truncate px-1 py-3 text-center text-[11px] font-bold transition border-b-2 sm:text-xs ${
                filterType === 'all'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setFilterType('twitter')}
              className={`flex-1 px-1 py-3 text-center text-[11px] font-bold transition border-b-2 flex items-center justify-center gap-1 sm:text-xs ${
                filterType === 'twitter'
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <span className="text-[11px]">X</span>
              <span className="hidden min-[380px]:inline">Twitter</span>
              <span>({twitterCount})</span>
            </button>
            <button
              onClick={() => setFilterType('web')}
              className={`flex-1 px-1 py-3 text-center text-[11px] font-bold transition border-b-2 flex items-center justify-center gap-1 sm:text-xs ${
                filterType === 'web'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Globe size={12} /> Web ({webCount})
            </button>
          </div>
        </div>

        {/* Feed Posts */}
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm xl:mt-0">
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
                const baseLikes = 12 + (urlHash % 450)
                const likes = baseLikes + (isLiked ? 1 : 0)
                const replies = 3 + (hashNum(item.url + 'r') % 70)
                const reposts = 4 + (hashNum(item.url + 'p') % 110)
                const views = 1200 + (urlHash % 15000)

                const parsed = parseTweetDisplay(item)

                return (
                  <article
                    key={itemId}
                    className="group flex cursor-pointer gap-3 border-b border-slate-100 px-4 py-4 transition last:border-b-0 hover:bg-slate-50/90 sm:gap-4 sm:px-5 sm:py-5"
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
                    <FeedAvatar item={item} size={40} />
                    <div className="min-w-0 flex-1">
                      {/* Repost Header */}
                      {parsed.isRepost && (
                        <div
                          className="mb-1.5 flex max-w-full items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 w-fit"
                          dir="ltr"
                        >
                          <Repeat2 size={12} />
                          <span className="truncate">@{parsed.repostedBy || item.username || ''} reposted</span>
                        </div>
                      )}

                      {/* Header Info */}
                      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[14px] leading-tight sm:text-[15px]">
                        <span className="max-w-[160px] truncate font-bold text-slate-900 hover:underline sm:max-w-[220px]">
                          {parsed.isRepost && parsed.originalAuthor
                            ? `@${parsed.originalAuthor}`
                            : item.source}
                        </span>
                        {item.username && !parsed.isRepost && (
                          <BadgeCheck size={16} className="text-sky-500" />
                        )}
                        <span
                          className={`max-w-[130px] truncate font-semibold text-xs sm:max-w-[200px] sm:text-sm ${
                            item.username ? 'text-sky-600' : 'text-teal-600'
                          }`}
                          dir="ltr"
                        >
                          {parsed.isRepost && parsed.originalAuthor
                            ? `@${parsed.originalAuthor}`
                            : item.username
                              ? `@${item.username}`
                              : item.domain}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="shrink-0 text-slate-400 text-xs font-medium">
                          {item.publishedAt ? timeAgo(item.publishedAt) : 'just now'}
                        </span>
                      </div>

                      {/* Reply indicator */}
                      {parsed.replyTo && (
                        <div
                          className="mt-0.5 mb-1 flex min-w-0 items-center gap-1.5 text-xs text-slate-500 font-medium"
                          dir="ltr"
                        >
                          <MessageSquare size={12} className="text-slate-400 shrink-0" />
                          <span className="min-w-0 truncate">
                            Replying to{' '}
                            <span className="font-bold text-sky-600 hover:underline">
                              @{parsed.replyTo}
                            </span>
                          </span>
                        </div>
                      )}

                      {/* Tweet / Post Content */}
                      <FormattedPostContent text={parsed.cleanTitle} />

                      {/* Embedded Image Preview (Twitter / Post media) */}
                      {parsed.displayImage && (
                        <div
                          className="mt-3 max-h-80 overflow-hidden rounded-xl border border-slate-200/90 bg-slate-950/5 shadow-sm transition hover:shadow-md sm:max-h-96"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(parsed.displayImage, '_blank', 'noopener,noreferrer')
                          }}
                        >
                          <img
                            src={parsed.displayImage}
                            alt="Post attachment"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="max-h-80 w-full object-cover transition hover:scale-[1.01] sm:max-h-96"
                            onError={(e) => {
                              (e.target as HTMLElement).parentElement?.classList.add('hidden')
                            }}
                          />
                        </div>
                      )}

                      {/* Translation action */}
                      {item.username && !containsArabic(parsed.cleanTitle) && (
                        <div className="mt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              void toggleTranslate(itemId, parsed.cleanTitle)
                            }}
                            disabled={translatingId === itemId}
                            className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50 ring-1 ring-sky-200"
                          >
                            <Languages
                              size={13}
                              className={translatingId === itemId ? 'animate-pulse' : ''}
                            />
                            {translations.has(itemId)
                              ? 'Show original'
                              : translatingId === itemId
                                ? 'Translating...'
                                : 'Translate to Arabic'}
                          </button>
                          {translations.has(itemId) && (
                            <div
                              dir="rtl"
                              className="mt-2 rounded-2xl bg-teal-500/10 p-3.5 text-sm leading-relaxed text-slate-900 ring-1 ring-teal-500/20 font-medium"
                            >
                              {translations.get(itemId)}
                            </div>
                          )}
                        </div>
                      )}

                      {!item.username && (
                        <div className="mt-3 flex items-center gap-2 text-xs font-bold text-teal-700">
                          <ExternalLink size={13} />
                          <span>Open source</span>
                        </div>
                      )}

                      {/* Action Bar */}
                      <div className="mt-3 grid grid-cols-5 items-center text-slate-500 sm:flex sm:max-w-[425px] sm:justify-between">
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="flex min-w-0 items-center justify-center gap-1 rounded-full p-1.5 text-[11px] transition hover:bg-sky-500/10 hover:text-sky-500 sm:justify-start sm:gap-1.5 sm:text-xs"
                        >
                          <MessageCircle size={16} />
                          <span className="font-semibold">{fmtCount(replies)}</span>
                        </button>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="flex min-w-0 items-center justify-center gap-1 rounded-full p-1.5 text-[11px] transition hover:bg-emerald-500/10 hover:text-emerald-500 sm:justify-start sm:gap-1.5 sm:text-xs"
                        >
                          <Repeat2 size={17} />
                          <span className="font-semibold">{fmtCount(reposts)}</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleLike(itemId)
                          }}
                          className={`flex min-w-0 items-center justify-center gap-1 rounded-full p-1.5 text-[11px] transition sm:justify-start sm:gap-1.5 sm:text-xs ${
                            isLiked
                              ? 'text-rose-500 font-bold'
                              : 'hover:bg-rose-500/10 hover:text-rose-500 font-semibold'
                          }`}
                        >
                          <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
                          <span>{fmtCount(likes)}</span>
                        </button>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="flex min-w-0 items-center justify-center gap-1 rounded-full p-1.5 text-[11px] transition hover:bg-slate-900/5 sm:justify-start sm:gap-1.5 sm:text-xs"
                        >
                          <Eye size={17} />
                          <span className="font-semibold">{fmtCount(views)}</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigator.clipboard.writeText(item.url).catch(() => undefined)
                          }}
                          title="Copy link"
                          className="flex justify-center rounded-full p-1.5 transition hover:bg-sky-500/10 hover:text-sky-500"
                        >
                          <Share2 size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
                <Search size={22} />
              </div>
              <p className="text-sm font-bold text-slate-900">
                {query ? 'No headlines match your search' : 'No headlines yet'}
              </p>
              <p className="mx-auto mt-1 max-w-xs text-xs text-slate-500">
                {query
                  ? 'Try a different keyword or check other filter tabs.'
                  : 'Hit refresh or add more news sites from the Dashboard.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Right sidebar ────────────────────────────────────── */}
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] min-w-0 flex-col gap-4 overflow-y-auto py-3 lg:flex">
        {/* Search */}
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search news and posts…"
            className="w-full rounded-full border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
        </div>

        {/* Trending Sources */}
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
          <h3 className="px-2 pt-1 pb-2 text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Sparkles size={16} className="text-amber-500" />
            Trending in your nest
          </h3>
          {trending.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {trending.map(([key, count], i) => (
                <button
                  key={key}
                  onClick={() => setQuery(key)}
                  className="block w-full rounded-2xl px-3 py-2.5 text-left transition hover:bg-slate-50"
                >
                  <p className="text-[11px] font-semibold text-slate-400">#{i + 1} Trending Source</p>
                  <p className="text-sm font-bold text-slate-900">@{key}</p>
                  <p className="text-xs text-slate-500 font-medium">
                    {count} headline{count === 1 ? '' : 's'} today
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="px-3 py-4 text-center text-xs text-slate-400">
              No headlines yet
            </p>
          )}
        </div>

        {/* Who to Follow */}
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
          <h3 className="px-2 pt-1 pb-2 text-base font-extrabold text-slate-900">
            Suggested Sources
          </h3>
          <div className="flex flex-col gap-1">
            {sites.slice(0, 5).map((site) => {
              const key = site.kind === 'twitter' ? extractUser(site.url) : site.domain
              const isFollowing = following.has(key)
              return (
                <div
                  key={site.id}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-slate-50"
                >
                  <CircleAvatar
                    sources={
                      site.kind === 'twitter'
                        ? twitterAvatarSources(extractUser(site.url))
                        : [faviconUrl(site.domain), faviconFallbackUrl(site.domain)]
                    }
                    letter={domainInitial(site.kind === 'twitter' ? extractUser(site.url) : site.domain)}
                    size={36}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate text-xs font-bold text-slate-900">
                      {site.title}
                      {site.kind === 'twitter' && (
                        <BadgeCheck size={13} className="shrink-0 text-sky-500" />
                      )}
                    </p>
                    <p className="truncate text-[11px] text-slate-400 font-medium" dir="ltr">
                      @{site.kind === 'twitter' ? extractUser(site.url) : site.domain}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleFollow(key)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition ${
                      isFollowing
                        ? 'bg-slate-100 text-slate-900 ring-1 ring-slate-200'
                        : 'bg-slate-900 text-white hover:bg-teal-600 shadow-sm'
                    }`}
                  >
                    {isFollowing ? (
                      <span className="inline-flex items-center gap-1">
                        <Check size={11} />
                        Done
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <UserPlus size={11} />
                        Follow
                      </span>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </aside>
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
