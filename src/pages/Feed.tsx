import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BadgeCheck,
  Check,
  Copy,
  ExternalLink,
  Eye,
  Heart,
  Image as ImageIcon,
  Languages,
  Link2,
  MessageCircle,
  MessageSquare,
  Newspaper,
  RefreshCw,
  Repeat2,
  X,
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
  size = 42,
}: {
  sources: string[]
  letter: string
  size?: number
}) {
  const [failed, setFailed] = useState(0)
  if (failed >= sources.length) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full bg-slate-900 font-extrabold text-teal-400 select-none shadow-xs"
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
      className="shrink-0 rounded-full bg-white object-cover ring-1 ring-slate-200/90 shadow-xs"
      style={{ width: size, height: size }}
    />
  )
}

function FeedAvatar({ item, size = 42 }: { item: FeedItem; size?: number }) {
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
    <div className="flex animate-pulse gap-3.5 px-4 py-5 border-b border-slate-100 sm:px-6">
      <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200" />
      <div className="flex-1 space-y-2.5 pt-1">
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-32 rounded-md bg-slate-200" />
          <div className="h-3.5 w-20 rounded-md bg-slate-100" />
          <div className="h-3 w-10 rounded-md bg-slate-100" />
        </div>
        <div className="h-4 w-full rounded-md bg-slate-100" />
        <div className="h-4 w-4/5 rounded-md bg-slate-100" />
        <div className="h-36 w-full rounded-2xl bg-slate-100/80 pt-2" />
        <div className="flex gap-10 pt-2">
          <div className="h-3.5 w-12 rounded-md bg-slate-100" />
          <div className="h-3.5 w-12 rounded-md bg-slate-100" />
          <div className="h-3.5 w-12 rounded-md bg-slate-100" />
        </div>
      </div>
    </div>
  )
}

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
          clean = u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname.slice(0, 16) + '…' : '')
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
            className="mx-0.5 inline-flex max-w-full items-center gap-1 rounded-lg bg-teal-50 px-1.5 py-0.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-100 hover:text-teal-950 ring-1 ring-teal-200/60"
            dir="ltr"
          >
            <Link2 size={11} className="shrink-0 text-teal-600" />
            <span className="max-w-[160px] truncate sm:max-w-[240px]">{clean}</span>
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
            className="font-bold text-sky-600 hover:underline hover:text-sky-700 transition"
            dir="ltr"
          >
            {token}
          </a>
        )
      }
      if (/^#[A-Za-z0-9_\u0600-\u06FF]+$/i.test(token)) {
        return (
          <span key={idx} className="font-bold text-teal-600 hover:underline">
            {token}
          </span>
        )
      }
      return token
    })
  }, [text])

  return (
    <p className="mt-1.5 overflow-hidden break-words text-[15px] leading-relaxed whitespace-pre-wrap text-slate-900 font-medium sm:text-[15.5px]">
      {parts}
    </p>
  )
}

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

  const rtMatch = title.match(/^\s*RT\s+by\s+@([A-Za-z0-9_]+):\s*(.*)$/s) || title.match(/^\s*RT\s+@([A-Za-z0-9_]+):\s*(.*)$/s)
  if (rtMatch) {
    isRepost = true
    repostedBy = item.username || repostedBy
    originalAuthor = rtMatch[1]
    title = rtMatch[2]?.trim() || title
  }

  const replyMatch = title.match(/^\s*(?:R\s+to|Replying\s+to|In\s+reply\s+to)\s+@([A-Za-z0-9_]+):\s*(.*)$/si)
  if (replyMatch) {
    replyTo = replyMatch[1]
    title = replyMatch[2]?.trim() || title
  }

  const imgUrlMatch = title.match(/(https?:\/\/[^\s]+?\.(?:png|jpe?g|webp|gif))/i)
  if (imgUrlMatch && !displayImage) {
    displayImage = imgUrlMatch[1]
    title = title.replace(imgUrlMatch[0], '').trim()
  }

  title = title
    .replace(/\[\s*image\s*\]/gi, '')
    .replace(/(?:https?:\/\/)?pic\.twitter\.com\/\S+/gi, '')
    .replace(/\s*-\s*x\.com$/i, '')
    .replace(/\s*-\s*Twitter$/i, '')
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
  const { sites, notify } = useSites()
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [liked, setLiked] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('nagnest:feed:liked') ?? '[]'))
    } catch {
      return new Set()
    }
  })
  const [translations, setTranslations] = useState<Map<string, string>>(new Map())
  const [translatingId, setTranslatingId] = useState<string | null>(null)
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const fresh = await fetchFeedItems(sites)
      if (!mounted.current) return
      setItems(fresh)
      cacheFeed(fresh)
    } finally {
      if (mounted.current) {
        setRefreshing(false)
        setLoading(false)
      }
    }
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
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [sites, refresh])

  const toggleLike = (id: string) => {
    setLiked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem('nagnest:feed:liked', JSON.stringify(Array.from(next)))
      } catch {}
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
      notify('Translation unavailable', 'error')
    }
    setTranslatingId(null)
  }

  const copyPostUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id)
      notify('Post link copied!')
      setTimeout(() => setCopiedId(null), 2000)
    }).catch(() => {
      notify('Could not copy link', 'error')
    })
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-3 sm:px-4 pt-2 pb-10">
      
      {/* ── Sleek Minimalist Top Header ── */}
      <div className="sticky top-16 z-30 mb-3 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 px-4 py-3 sm:px-5 shadow-xs backdrop-blur-md flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-black text-slate-900 sm:text-lg tracking-tight">
              Feed
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-extrabold text-teal-700 ring-1 ring-teal-200/80">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-teal-500" />
              Live
            </span>
          </div>
          <p className="text-[11px] font-semibold text-slate-400">
            {items.length} latest updates from your {sites.length} source{sites.length === 1 ? '' : 's'}
          </p>
        </div>

        <button
          onClick={() => void refresh()}
          disabled={refreshing || loading}
          className="flex h-9 items-center gap-1.5 rounded-2xl bg-slate-900 px-3.5 text-xs font-extrabold text-white shadow-xs transition hover:bg-teal-600 disabled:opacity-50"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin text-teal-300' : ''} />
          <span>{refreshing ? 'Syncing...' : 'Sync'}</span>
        </button>
      </div>

      {/* ── Feed Timeline ── */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        {loading && items.length === 0 ? (
          <div>
            <TweetSkeleton />
            <TweetSkeleton />
            <TweetSkeleton />
            <TweetSkeleton />
          </div>
        ) : items.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {items.map((item, i) => {
              const itemId = `${item.domain}-${i}-${item.publishedAt ?? ''}`
              const isLiked = liked.has(itemId)
              const urlHash = hashNum(item.url)
              const baseLikes = 18 + (urlHash % 500)
              const likes = baseLikes + (isLiked ? 1 : 0)
              const replies = 4 + (hashNum(item.url + 'r') % 80)
              const reposts = 6 + (hashNum(item.url + 'p') % 120)
              const views = 1400 + (urlHash % 25000)

              const parsed = parseTweetDisplay(item)
              const isTwitterItem = !!item.username

              return (
                <article
                  key={itemId}
                  className="group relative flex cursor-pointer gap-3.5 p-4 transition duration-150 hover:bg-slate-50/90 sm:gap-4 sm:p-5"
                  onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') window.open(item.url, '_blank', 'noopener,noreferrer')
                  }}
                >
                  {/* Left Column: Avatar */}
                  <div className="flex flex-col items-center">
                    <FeedAvatar item={item} size={42} />
                    {isTwitterItem && (
                      <div className="mt-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 font-mono text-[10px] font-black text-white ring-2 ring-white">
                        𝕏
                      </div>
                    )}
                  </div>

                  {/* Right Column: Post Body */}
                  <div className="min-w-0 flex-1">
                    
                    {/* Repost Indicator */}
                    {parsed.isRepost && (
                      <div
                        className="mb-1.5 flex max-w-full items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 w-fit ring-1 ring-emerald-200/60"
                        dir="ltr"
                      >
                        <Repeat2 size={12} className="shrink-0" />
                        <span className="truncate">@{parsed.repostedBy || item.username || ''} reposted</span>
                      </div>
                    )}

                    {/* Author Header */}
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 leading-tight">
                      <span className="max-w-[180px] truncate font-extrabold text-slate-900 text-[15px] group-hover:text-teal-800 transition sm:max-w-[260px]">
                        {parsed.isRepost && parsed.originalAuthor
                          ? `@${parsed.originalAuthor}`
                          : item.source}
                      </span>
                      
                      {isTwitterItem && (
                        <BadgeCheck size={16} className="text-sky-500 shrink-0" fill="#0ea5e9" color="#fff" />
                      )}

                      <span
                        className={`max-w-[140px] truncate font-bold text-xs sm:max-w-[220px] ${
                          isTwitterItem ? 'text-sky-600' : 'text-teal-700'
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
                      <span className="shrink-0 text-slate-400 text-xs font-semibold">
                        {item.publishedAt ? timeAgo(item.publishedAt) : 'just now'}
                      </span>
                    </div>

                    {/* Reply indicator */}
                    {parsed.replyTo && (
                      <div
                        className="mt-1 mb-1 flex min-w-0 items-center gap-1.5 text-xs text-slate-500 font-medium"
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

                    {/* Post Text */}
                    <FormattedPostContent text={parsed.cleanTitle} />

                    {/* Embedded Image Attachment */}
                    {parsed.displayImage && (
                      <div
                        className="mt-3 overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-950/5 shadow-xs transition hover:shadow-md max-h-80 sm:max-h-96 relative group/img"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (parsed.displayImage) setLightboxImg(parsed.displayImage)
                        }}
                      >
                        <img
                          src={parsed.displayImage}
                          alt="Post media"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="max-h-80 w-full object-cover transition duration-200 group-hover/img:scale-[1.01] sm:max-h-96"
                          onError={(e) => {
                            (e.target as HTMLElement).parentElement?.classList.add('hidden')
                          }}
                        />
                        <div className="absolute bottom-2.5 right-2.5 rounded-full bg-slate-950/70 p-1.5 text-white backdrop-blur-md opacity-0 group-hover/img:opacity-100 transition shadow-md">
                          <ImageIcon size={14} />
                        </div>
                      </div>
                    )}

                    {/* Inline Arabic Translation */}
                    {!containsArabic(parsed.cleanTitle) && (
                      <div className="mt-2.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            void toggleTranslate(itemId, parsed.cleanTitle)
                          }}
                          disabled={translatingId === itemId}
                          className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-sky-50/80 px-3 py-1 text-xs font-bold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50 ring-1 ring-sky-200/70"
                        >
                          <Languages
                            size={13}
                            className={translatingId === itemId ? 'animate-spin' : ''}
                          />
                          {translations.has(itemId)
                            ? 'Original text'
                            : translatingId === itemId
                              ? 'Translating...'
                              : 'ترجمة إلى العربية'}
                        </button>
                        {translations.has(itemId) && (
                          <div
                            dir="rtl"
                            className="mt-2 rounded-2xl bg-teal-50/70 p-3.5 text-sm leading-relaxed text-slate-900 ring-1 ring-teal-200/80 font-medium animate-in fade-in"
                          >
                            {translations.get(itemId)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* External Link Indicator (for web articles) */}
                    {!isTwitterItem && (
                      <div className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-900 transition">
                        <ExternalLink size={13} />
                        <span>Read full story on {item.domain}</span>
                      </div>
                    )}

                    {/* Interactive Action Toolbar */}
                    <div className="mt-3.5 flex max-w-md items-center justify-between text-slate-500 pt-1">
                      
                      {/* Reply */}
                      <button
                        onClick={(e) => e.stopPropagation()}
                        title="Reply"
                        className="flex items-center gap-1.5 rounded-full p-1.5 text-xs font-semibold transition hover:bg-sky-500/10 hover:text-sky-600"
                      >
                        <MessageCircle size={16} />
                        <span>{fmtCount(replies)}</span>
                      </button>

                      {/* Repost */}
                      <button
                        onClick={(e) => e.stopPropagation()}
                        title="Repost"
                        className="flex items-center gap-1.5 rounded-full p-1.5 text-xs font-semibold transition hover:bg-emerald-500/10 hover:text-emerald-600"
                      >
                        <Repeat2 size={16} />
                        <span>{fmtCount(reposts)}</span>
                      </button>

                      {/* Like */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleLike(itemId)
                        }}
                        title="Like"
                        className={`flex items-center gap-1.5 rounded-full p-1.5 text-xs font-semibold transition ${
                          isLiked
                            ? 'text-rose-500 font-bold'
                            : 'hover:bg-rose-500/10 hover:text-rose-500'
                        }`}
                      >
                        <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
                        <span>{fmtCount(likes)}</span>
                      </button>

                      {/* Views */}
                      <div
                        title="Impressions"
                        className="flex items-center gap-1.5 rounded-full p-1.5 text-xs font-semibold text-slate-400 select-none"
                      >
                        <Eye size={16} />
                        <span>{fmtCount(views)}</span>
                      </div>

                      {/* Copy Link */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          copyPostUrl(itemId, item.url)
                        }}
                        title="Copy post link"
                        className="flex items-center rounded-full p-1.5 transition hover:bg-sky-500/10 hover:text-sky-600 text-slate-400"
                      >
                        {copiedId === itemId ? <Check size={16} className="text-teal-600" /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="px-6 py-20 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 mb-3 shadow-xs">
              <Newspaper size={26} />
            </div>
            <p className="text-base font-extrabold text-slate-900">
              No feed updates yet
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs font-medium text-slate-500">
              Add websites or X accounts in your Dashboard and hit Sync.
            </p>
          </div>
        )}
      </div>

      {/* ── Image Lightbox Modal ── */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md animate-in fade-in"
          onClick={() => setLightboxImg(null)}
        >
          <button
            onClick={() => setLightboxImg(null)}
            className="absolute top-5 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md hover:bg-white/20 transition"
          >
            <X size={20} />
          </button>
          <img
            src={lightboxImg}
            alt="Full view"
            className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl ring-1 ring-white/20"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
