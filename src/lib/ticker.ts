import type { Site } from '../types'

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
const FEED_CACHE_KEY = 'nagnest:feed:v7'
const TTL = 20 * 60 * 1000
const MAX_SITES = 12
const MAX_PER_SITE = 2

export function isItem(it: unknown): it is TickerItem {
  return (
    !!it &&
    typeof (it as TickerItem).title === 'string' &&
    typeof (it as TickerItem).url === 'string' &&
    typeof (it as TickerItem).source === 'string' &&
    typeof (it as TickerItem).domain === 'string'
  )
}

/** In-flight deduplication: same sites+options key → single request */
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
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const json = (await res.json()) as { items: TickerItem[] }
      const items = (Array.isArray(json.items) ? json.items : []).filter(isItem)
      onItems?.(items)
      return items
    } catch (err) {
      console.warn('[nagnest] /api/headlines failed, falling back to empty:', err)
      return []
    }
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

// Re-export feed cache keys so feed.ts can use a different namespace
export { FEED_CACHE_KEY }
