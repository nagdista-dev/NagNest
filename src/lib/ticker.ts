import type { Site } from '../types'
import { extractTwitterUsername, toTwitterUrl } from './url'

export interface TickerItem {
  title: string
  url: string
  source: string
  domain: string
  username?: string
  publishedAt?: number
  repost?: boolean
  repostedBy?: string
  originalAuthor?: string
  image?: string
}

export interface HeadlinesOptions {
  perSite?: number
  maxSites?: number
  includeTwitter?: boolean
}

const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url='
const CACHE_KEY = 'nagnest:ticker:v3'
const FEED_MAP_KEY = 'nagnest:ticker-feeds:v1'
const TTL = 20 * 60 * 1000
const MAX_SITES = 12
const MAX_PER_SITE = 2

const TWITTER_FEED_SOURCES = [
  'https://rsshub.app/twitter/user/{user}',
  'https://twiiit.com/{user}/rss',
  'https://nitter.net/{user}/rss',
]

export function isItem(it: unknown): it is TickerItem {
  return (
    !!it &&
    typeof (it as TickerItem).title === 'string' &&
    typeof (it as TickerItem).url === 'string' &&
    typeof (it as TickerItem).source === 'string' &&
    typeof (it as TickerItem).domain === 'string'
  )
}

const KNOWN_FEEDS: Record<string, string> = {
  'openai.com': 'https://openai.com/blog/rss.xml',
  'techcrunch.com': 'https://techcrunch.com/feed/',
  'theverge.com': 'https://www.theverge.com/rss/index.xml',
  'arstechnica.com': 'https://feeds.arstechnica.com/arstechnica/index',
  'wired.com': 'https://www.wired.com/feed/rss',
  'venturebeat.com': 'https://venturebeat.com/feed/',
  'engadget.com': 'https://www.engadget.com/rss.xml',
  'thenextweb.com': 'https://thenextweb.com/feed/',
  'mashable.com': 'https://mashable.com/feeds/rss/',
  'nytimes.com': 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',
  'theguardian.com': 'https://www.theguardian.com/technology/rss',
  'cnbc.com': 'https://www.cnbc.com/id/10000664/device/rss/rss.html',
  'bbc.com': 'https://feeds.bbci.co.uk/news/technology/rss.xml',
  'bbc.co.uk': 'https://feeds.bbci.co.uk/news/technology/rss.xml',
  'npr.org': 'https://feeds.npr.org/1001/rss.xml',
  'medium.com': 'https://medium.com/feed/',
  'semiengineering.com': 'https://semiengineering.com/feed/',
  'analyticsindiamag.com': 'https://analyticsindiamag.com/feed/',
  'marktechpost.com': 'https://www.marktechpost.com/feed/',
  'unite.ai': 'https://www.unite.ai/feed/',
  'artificialintelligence-news.com': 'https://artificialintelligence-news.com/feed/',
  'aitrends.com': 'https://aitrends.com/feed/',
  'topai.tools': 'https://topai.tools/feed',
}

function loadFeedMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(FEED_MAP_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

function saveFeedMap(map: Record<string, string>): void {
  try {
    localStorage.setItem(FEED_MAP_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

function feedCandidates(origin: string, domain: string): string[] {
  const known = KNOWN_FEEDS[domain]
  const generic = [
    `${origin}/feed`,
    `${origin}/rss`,
    `${origin}/rss.xml`,
    `${origin}/feed.xml`,
    `${origin}/index.xml`,
  ]
  return known ? [known, ...generic] : generic
}

async function fetchText(url: string, timeoutMs = 9000): Promise<string> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

async function fetchViaRss2Json(
  feed: string,
  source: string,
  domain: string,
  perSite: number,
): Promise<TickerItem[]> {
  const text = await fetchText(RSS2JSON + encodeURIComponent(feed))
  const json = JSON.parse(text) as {
    status?: string
    items?: {
      title?: string
      link?: string
      pubDate?: string
      description?: string
      content?: string
      thumbnail?: string
      enclosure?: unknown
    }[]
  }
  if (json.status !== 'ok' || !Array.isArray(json.items)) return []
  return json.items
    .filter((it): it is NonNullable<(typeof json.items)[number]> => !!it)
    .filter((it) => it.title && it.link)
    .slice(0, perSite)
    .map((it) => {
      const published = it.pubDate ? Date.parse(it.pubDate) : Number.NaN
      return {
        title: String(it.title),
        url: String(it.link),
        source,
        domain,
        publishedAt: Number.isFinite(published) ? published : undefined,
        image: extractImage(it),
      }
    })
}

function extractImage(it: {
  thumbnail?: string
  enclosure?: unknown
  description?: string
  content?: string
}): string | undefined {
  const thumb =
    typeof it.thumbnail === 'string' && it.thumbnail ? normalizeImage(it.thumbnail) : undefined
  if (thumb) return thumb

  const enc = it.enclosure
  if (typeof enc === 'string') {
    const img = normalizeImage(enc)
    if (img) return img
  }
  if (enc && typeof enc === 'object') {
    const obj = enc as { url?: string; type?: string }
    if (typeof obj.url === 'string' && (!obj.type || String(obj.type).startsWith('image'))) {
      const img = normalizeImage(obj.url)
      if (img) return img
    }
  }

  const html = `${it.description ?? ''}${it.content ?? ''}`
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (match) {
    const img = normalizeImage(match[1])
    if (img) return img
  }
  return undefined
}

function normalizeImage(src: string): string | undefined {
  if (!src || !/^https?:\/\//i.test(src)) return undefined
  if (src.startsWith('https://nitter.net/pic/')) {
    try {
      const decoded = decodeURIComponent(src).replace('https://nitter.net/pic/', '')
      return `https://pbs.twimg.com/${decoded}`
    } catch {
      return undefined
    }
  }
  return src
}

async function fetchForSite(site: Site, perSite: number): Promise<TickerItem[]> {
  if (site.kind === 'twitter') {
    return fetchTwitterForSite(site, perSite)
  }
  const origin = new URL(site.url).origin
  const feedMap = loadFeedMap()
  const savedFeed = feedMap[site.domain]
  const candidates = savedFeed
    ? [savedFeed, ...feedCandidates(origin, site.domain).filter((f) => f !== savedFeed)]
    : feedCandidates(origin, site.domain)

  for (const feed of candidates) {
    try {
      const items = await fetchViaRss2Json(feed, site.title, site.domain, perSite)
      if (items.length) {
        if (feedMap[site.domain] !== feed) {
          saveFeedMap({ ...feedMap, [site.domain]: feed })
        }
        return items
      }
    } catch {
      // try next candidate
    }
  }
  return []
}

async function fetchTwitterForSite(site: Site, perSite: number): Promise<TickerItem[]> {
  const user = extractTwitterUsername(site.url)
  if (!user) return []
  for (const template of TWITTER_FEED_SOURCES) {
    try {
      const items = await fetchViaRss2Json(
        template.replace('{user}', user),
        site.title,
        site.domain,
        perSite,
      )
      if (items.length) {
        return items.map((it) => parseTwitterItem({ ...it, username: user, url: toTwitterUrl(it.url) }, user))
      }
    } catch {
      // try next source
    }
  }
  return []
}

function parseTwitterItem(item: TickerItem, user: string): TickerItem {
  const match = item.title.match(/^\s*RT\s+by\s+@([A-Za-z0-9_]+):\s*(.*)$/s)
  const matchShort = match ?? item.title.match(/^\s*RT\s+@([A-Za-z0-9_]+):\s*(.*)$/s)
  const final = matchShort ?? match
  if (!final) return item
  const original = extractTwitterUsername(item.url)
  return {
    ...item,
    title: final[2]?.trim() || item.title,
    repost: true,
    repostedBy: user,
    originalAuthor: original ?? final[1],
  }
}

export async function fetchHeadlines(
  sites: Site[],
  { perSite = MAX_PER_SITE, maxSites = MAX_SITES, includeTwitter = false }: HeadlinesOptions = {},
): Promise<TickerItem[]> {
  const targets = sites
    .filter((s) => (includeTwitter ? true : s.kind !== 'twitter'))
    .slice(0, maxSites)
  const results = await Promise.allSettled(targets.map((s) => fetchForSite(s, perSite)))
  const items = results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .filter(isItem)
  return items.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
}

export async function fetchTickerItems(sites: Site[]): Promise<TickerItem[]> {
  return fetchHeadlines(sites, { perSite: MAX_PER_SITE, maxSites: MAX_SITES })
}

export function getCachedItems(key: string, ttl: number): TickerItem[] | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { fetchedAt: number; items: TickerItem[] }
    if (!Array.isArray(parsed.items)) return null
    if (Date.now() - parsed.fetchedAt > ttl) return null
    return parsed.items.filter(isItem)
  } catch {
    return null
  }
}

export function cacheItems(key: string, items: TickerItem[]): void {
  try {
    localStorage.setItem(key, JSON.stringify({ fetchedAt: Date.now(), items }))
  } catch {
    // storage full — ignore
  }
}

export function getCachedTicker(): TickerItem[] | null {
  return getCachedItems(CACHE_KEY, TTL)
}

export function cacheTicker(items: TickerItem[]): void {
  cacheItems(CACHE_KEY, items)
}
