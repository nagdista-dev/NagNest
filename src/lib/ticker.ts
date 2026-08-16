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
  reply?: boolean
  replyTo?: string
  image?: string
}

export interface HeadlinesOptions {
  perSite?: number
  maxSites?: number
  includeTwitter?: boolean
  onItems?: (items: TickerItem[]) => void
}

const CACHE_KEY = 'nagnest:ticker:v6'
export const FEED_CACHE_KEY = 'nagnest:feed:v7'
const TTL = 20 * 60 * 1000
const MAX_SITES = 12
const MAX_PER_SITE = 2

/* ── Client-side pipeline (works with or without the API server) ── */

const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url='
const RAW_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest=',
]
const CONCURRENCY = 4
const SITE_BUDGET_MS = 12000
const REQUEST_TIMEOUT_MS = 8000
const STAGGER_MS = 250
const SERVER_TIMEOUT_MS = 5000

const TWITTER_FEED_SOURCES = [
  'https://rsshub.app/twitter/user/{user}',
  'https://twiiit.com/{user}/rss',
  'https://nitter.net/{user}/rss',
]

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

export function isItem(it: unknown): it is TickerItem {
  return (
    !!it &&
    typeof (it as TickerItem).title === 'string' &&
    typeof (it as TickerItem).url === 'string' &&
    typeof (it as TickerItem).source === 'string' &&
    typeof (it as TickerItem).domain === 'string'
  )
}

function loadFeedMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem('nagnest:ticker-feeds:v1') ?? '{}') as Record<
      string,
      string
    >
  } catch {
    return {}
  }
}

function saveFeedMap(map: Record<string, string>): void {
  try {
    localStorage.setItem('nagnest:ticker-feeds:v1', JSON.stringify(map))
  } catch {
    // ignore
  }
}

function feedCandidates(origin: string, domain: string): string[] {
  const saved = loadFeedMap()[domain]
  if (saved && saved !== `gnews:${domain}`) return [saved]
  const known = KNOWN_FEEDS[domain]
  if (known) return [known]
  return [`${origin}/feed`, `${origin}/rss`]
}

async function fetchText(url: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<string> {
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function withBudget<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('budget')), ms)),
  ])
}

interface RawEntry {
  title: string
  url: string
  pubDate?: string
  image?: string
}

function parseRssXml(xml: string): RawEntry[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  if (doc.querySelector('parsererror')) return []
  const nodes = Array.from(doc.querySelectorAll('item, entry'))
  return nodes.flatMap((node): RawEntry[] => {
    const linkNode = node.querySelector('link')
    const link = linkNode?.getAttribute('href') || linkNode?.textContent || ''
    const html = node.querySelector('description')?.textContent ?? ''
    const imageMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i)
    const mediaUrl =
      node.querySelector('media\\:content, media\\:thumbnail')?.getAttribute('url') ?? null
    const encUrl = node.querySelector('enclosure')?.getAttribute('url') ?? null
    const entry: RawEntry = {
      title: (node.querySelector('title')?.textContent ?? '').trim(),
      url: link.trim(),
      pubDate: node.querySelector('pubDate, published')?.textContent ?? undefined,
      image: (mediaUrl ?? encUrl) ?? (imageMatch ? imageMatch[1] : undefined),
    }
    return entry.title && entry.url ? [entry] : []
  })
}

function toItems(
  entries: RawEntry[],
  source: string,
  domain: string,
  perSite: number,
  username?: string,
): TickerItem[] {
  return entries.slice(0, perSite).map((it) => {
    const published = it.pubDate ? Date.parse(it.pubDate) : Number.NaN
    return {
      title: it.title,
      url: it.url,
      source,
      domain,
      username,
      publishedAt: Number.isFinite(published) ? published : undefined,
      image: normalizeImage(it.image),
    }
  })
}

function normalizeImage(src: string | undefined): string | undefined {
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

async function fetchRawXml(
  feed: string,
  source: string,
  domain: string,
  perSite: number,
  username?: string,
): Promise<TickerItem[]> {
  for (const proxy of RAW_PROXIES) {
    try {
      const xml = await fetchText(proxy + encodeURIComponent(feed))
      if (!/<(item|entry)[\s>]/i.test(xml)) continue
      const items = toItems(parseRssXml(xml), source, domain, perSite, username)
      if (items.length) return items
    } catch {
      // try next proxy
    }
  }
  return []
}

async function fetchViaRss2Json(
  feed: string,
  source: string,
  domain: string,
  perSite: number,
  username?: string,
): Promise<TickerItem[]> {
  try {
    const text = await fetchText(RSS2JSON + encodeURIComponent(feed))
    const json = JSON.parse(text) as {
      status?: string
      items?: { title?: string; link?: string; pubDate?: string; description?: string }[]
    }
    if (json.status !== 'ok' || !Array.isArray(json.items)) return []
    return json.items
      .filter((it): it is NonNullable<(typeof json.items)[number]> => !!it)
      .filter((it) => it.title && it.link)
      .slice(0, perSite)
      .map((it) => {
        const published = it.pubDate ? Date.parse(it.pubDate) : Number.NaN
        const imgMatch = `${it.description ?? ''}`.match(/<img[^>]+src=["']([^"']+)["']/i)
        return {
          title: String(it.title),
          url: username ? toTwitterUrl(String(it.link)) : String(it.link),
          source,
          domain,
          username,
          publishedAt: Number.isFinite(published) ? published : undefined,
          image: imgMatch ? normalizeImage(imgMatch[1]) : undefined,
        }
      })
  } catch {
    return []
  }
}

async function fetchGoogleNews(site: Site, perSite: number): Promise<TickerItem[]> {
  const feed = `https://news.google.com/rss/search?q=${encodeURIComponent(
    `site:${site.domain}`,
  )}&hl=en-US&gl=US&ceid=US:en`
  for (const proxy of RAW_PROXIES) {
    try {
      const xml = await fetchText(proxy + encodeURIComponent(feed))
      if (!/<item[\s>]/i.test(xml)) continue
      const items = toItems(parseRssXml(xml), site.title, site.domain, perSite)
      if (items.length) {
        saveFeedMap({ ...loadFeedMap(), [site.domain]: `gnews:${site.domain}` })
        return items
      }
    } catch {
      // try next proxy
    }
  }
  return []
}

async function fetchForSite(site: Site, perSite: number): Promise<TickerItem[]> {
  if (site.kind === 'twitter') {
    return fetchTwitterForSite(site, perSite)
  }
  const origin = new URL(site.url).origin
  for (const feed of feedCandidates(origin, site.domain)) {
    let items = await fetchRawXml(feed, site.title, site.domain, perSite)
    if (!items.length) {
      items = await fetchViaRss2Json(feed, site.title, site.domain, perSite)
    }
    if (items.length) {
      const map = loadFeedMap()
      if (map[site.domain] !== feed) saveFeedMap({ ...map, [site.domain]: feed })
      return items
    }
  }
  return fetchGoogleNews(site, perSite)
}

async function fetchTwitterForSite(site: Site, perSite: number): Promise<TickerItem[]> {
  const user = extractTwitterUsername(site.url)
  if (!user) return []
  for (const template of TWITTER_FEED_SOURCES) {
    const feed = template.replace('{user}', user)
    let items = await fetchRawXml(feed, site.title, site.domain, perSite, user)
    if (!items.length) {
      items = await fetchViaRss2Json(feed, site.title, site.domain, perSite, user)
    }
    if (items.length) {
      return items.map((it) => parseTwitterItem({ ...it, url: toTwitterUrl(it.url) }, user))
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

async function fetchClientSide(
  sites: Site[],
  perSite: number,
  onItems?: (items: TickerItem[]) => void,
): Promise<TickerItem[]> {
  const all: TickerItem[] = []
  for (let i = 0; i < sites.length; i += CONCURRENCY) {
    const chunk = sites.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      chunk.map((site, j) =>
        withBudget(
          () => sleep(j * STAGGER_MS).then(() => fetchForSite(site, perSite)),
          SITE_BUDGET_MS,
        ),
      ),
    )
    for (const r of results) {
      if (r.status === 'fulfilled') all.push(...r.value)
    }
    all.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
    onItems?.(all.slice())
  }
  return all
}

/* ── Headlines entry: try the API server, fall back to client-side ── */

const inFlight = new Map<string, Promise<TickerItem[]>>()

export async function fetchHeadlines(
  sites: Site[],
  {
    perSite = MAX_PER_SITE,
    maxSites = MAX_SITES,
    includeTwitter = false,
    onItems,
  }: HeadlinesOptions = {},
): Promise<TickerItem[]> {
  const targets = sites
    .filter((s) => (includeTwitter ? true : s.kind !== 'twitter'))
    .slice(0, maxSites)

  if (targets.length === 0) return []

  const key = `${targets.map((s) => s.id).join(',')}|${perSite}|${includeTwitter ? 1 : 0}`
  const existing = inFlight.get(key)
  if (existing) return existing

  const promise = (async () => {
    try {
      const res = await fetch('/api/headlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sites: targets, perSite, includeTwitter }),
        signal: AbortSignal.timeout(SERVER_TIMEOUT_MS),
      })
      if (res.ok) {
        const json = (await res.json()) as { items?: TickerItem[] }
        const items = (Array.isArray(json.items) ? json.items : []).filter(isItem)
        if (items.length) {
          onItems?.(items)
          return items
        }
      }
    } catch {
      // server unavailable — fall through to client-side fetching
    }
    return fetchClientSide(targets, perSite, onItems)
  })().finally(() => inFlight.delete(key))

  inFlight.set(key, promise)
  return promise
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
