import express from 'express'
import { createClient } from 'redis'
import { XMLParser } from 'fast-xml-parser'

const PORT = process.env.PORT || 4170
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const CACHE_TTL = 30 * 60 // 30 minutes per-domain cache
const NEGATIVE_TTL = 60 * 60 // cache failures for 1h to avoid hammering dead feeds
const CONCURRENCY = 3
const SITE_DELAY_MS = 300
const FETCH_TIMEOUT_MS = 7000

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })

const app = express()
app.use(express.json({ limit: '256kb' }))

// Allow requests from the Vite dev server
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (_req.method === 'OPTIONS') { res.sendStatus(204); return }
  next()
})


/* ── Cache layer: Redis with in-memory fallback ─────────────── */

let redis = null
const memCache = new Map()

async function connectRedis() {
  try {
    const client = createClient({ url: REDIS_URL })
    client.on('error', () => {})
    await client.connect()
    redis = client
    console.log('[nagnest] redis connected')
  } catch (err) {
    redis = null
    console.log('[nagnest] redis unavailable — using in-memory cache:', err.message)
  }
}

async function cacheGet(key) {
  if (redis) {
    try {
      const raw = await redis.get(key)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }
  const hit = memCache.get(key)
  if (hit && hit.expires > Date.now()) return hit.value
  return null
}

async function cacheSet(key, value, ttlSeconds) {
  const payload = JSON.stringify(value)
  if (redis) {
    try {
      await redis.set(key, payload, { EX: ttlSeconds })
      return
    } catch {
      // fall through to memory
    }
  }
  memCache.set(key, { value, expires: Date.now() + ttlSeconds * 1000 })
}

/* ── Feed sources ───────────────────────────────────────────── */

const KNOWN_FEEDS = {
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
  'technologyreview.com': 'https://www.technologyreview.com/feed',
  'mit.edu': 'https://news.mit.edu/rss/topic/artificial-intelligence2',
  'nature.com': 'https://www.nature.com/subjects/machine-learning.rss',
  'zdnet.com': 'https://www.zdnet.com/topic/artificial-intelligence/rss.xml',
  'forbes.com': 'https://www.forbes.com/innovation/feed2',
  'reuters.com': 'https://feeds.reuters.com/reuters/technologyNews',
  'bloomberg.com': 'https://feeds.bloomberg.com/technology/news.rss',
  'hackernoon.com': 'https://hackernoon.com/feed',
  'towardsdatascience.com': 'https://towardsdatascience.com/feed',
}

const TWITTER_FEED_SOURCES = [
  (u) => `https://nitter.net/${u}/rss`,
]

function feedCandidates(origin, domain) {
  const known = KNOWN_FEEDS[domain]
  if (known) return [known]
  return [`${origin}/feed`, `${origin}/rss`]
}

const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
}

async function fetchText(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: BROWSER_HEADERS,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

// rss2json fetches the feed server-side on their infra — reliable for
// sources that fingerprint-block direct fetches (nitter, twiiit, rsshub).
async function fetchViaRss2Json(feed, perSite, source, domain, username) {
  const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed)}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.status !== 'ok' || !Array.isArray(json.items)) return []
  return json.items
    .filter((it) => it.title && it.link)
    .slice(0, perSite)
    .map((it) => {
      const published = it.pubDate ? Date.parse(it.pubDate) : NaN
      const desc = `${it.description ?? ''}${it.content ?? ''}`
      const imgMatch = desc.match(/<img[^>]+src=["']([^"']+)["']/i)
      const thumb = typeof it.thumbnail === 'string' ? it.thumbnail : null
      return {
        title: String(it.title),
        url: username ? toTwitterUrl(String(it.link)) : String(it.link),
        source,
        domain,
        username,
        publishedAt: Number.isFinite(published) ? published : undefined,
        image: thumb ?? imgMatch?.[1],
      }
    })
}

function parseXml(xml) {
  let doc
  try {
    doc = parser.parse(xml, { ignoreAttributes: false })
  } catch {
    return []
  }
  const channel = doc?.rss?.channel ?? doc?.feed ?? {}
  let nodes = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : []
  if (!nodes.length && Array.isArray(doc?.feed?.entry)) nodes = doc.feed.entry
  if (!nodes.length && doc?.feed?.entry) nodes = [doc.feed.entry]
  if (!nodes.length && Array.isArray(doc?.rss?.item)) nodes = doc.rss.item

  return nodes
    .map((node) => {
      const linkNode = node.link
      const link = typeof linkNode === 'string'
        ? linkNode
        : (linkNode?.['@_href'] ?? (Array.isArray(linkNode) ? linkNode[0] : linkNode))
      const media =
        node['media:content']?.['@_url'] ??
        node['media:thumbnail']?.['@_url'] ??
        node.enclosure?.['@_url'] ??
        null
      const desc = node.description ?? node.content ?? ''
      const descText = typeof desc === 'string' ? desc : desc['#text'] ?? ''
      const imgMatch = typeof descText === 'string' ? descText.match(/<img[^>]+src=["']([^"']+)["']/i) : null
      const pub = node.pubDate ?? node.published ?? node['dc:date'] ?? null
      return {
        title: typeof node.title === 'string' ? node.title.trim() : (node.title?.['#text'] ?? '').trim(),
        url: typeof link === 'string' ? link.trim() : '',
        pubDate: pub ? String(pub) : undefined,
        image: media ?? (imgMatch ? imgMatch[1] : undefined),
      }
    })
    .filter((it) => it.title && it.url)
}

function normalizeTwitterImage(src) {
  if (!src) return undefined
  if (typeof src === 'string' && src.includes('nitter.net/pic/')) {
    try {
      const decoded = decodeURIComponent(src).replace(/https?:\/\/[^/]+\/pic\//, '')
      return `https://pbs.twimg.com/${decoded}`
    } catch {
      return src
    }
  }
  return src
}

function parseTwitterItem(item, user) {
  let title = item.title
  let repost = false
  let repostedBy = undefined
  let originalAuthor = undefined
  let reply = false
  let replyTo = undefined
  let image = normalizeTwitterImage(item.image)

  const rtMatch = title.match(/^\s*RT\s+by\s+@([A-Za-z0-9_]+):\s*(.*)$/s) || title.match(/^\s*RT\s+@([A-Za-z0-9_]+):\s*(.*)$/s)
  if (rtMatch) {
    repost = true
    repostedBy = user
    title = rtMatch[2]?.trim() || title
    const orig = item.url.match(/\/status\/(\d+)/) ? (item.url.match(/^\w*:?\/\/([^/]+)\/(\w+)/)?.[2] ?? null) : null
    originalAuthor = orig ?? rtMatch[1]
  }

  const replyMatch = title.match(/^\s*(?:R\s+to|Replying\s+to|In\s+reply\s+to)\s+@([A-Za-z0-9_]+):\s*(.*)$/si)
  if (replyMatch) {
    reply = true
    replyTo = replyMatch[1]
    title = replyMatch[2]?.trim() || title
  }

  // Clean trailing pic.twitter.com or raw [image] placeholder texts
  title = title
    .replace(/\[\s*image\s*\]/gi, '')
    .replace(/(?:https?:\/\/)?pic\.twitter\.com\/[A-Za-z0-9_]+/gi, '')
    .trim()

  return {
    ...item,
    title,
    image,
    repost: repost || item.repost,
    repostedBy: repostedBy || item.repostedBy,
    originalAuthor: originalAuthor || item.originalAuthor,
    reply,
    replyTo,
  }
}

function extractUser(url) {
  try {
    const path = new URL(url).pathname.replace(/^\/+/, '').replace(/\/+$/, '')
    return path.split('/')[0] ?? url
  } catch {
    return url
  }
}

async function fetchFeed(url, perSite, source, domain, username) {
  const xml = await fetchText(url)
  const items = parseXml(xml).slice(0, perSite).map((it) => ({
    title: it.title,
    url: username ? toTwitterUrl(it.url) : it.url,
    source,
    domain,
    username,
    publishedAt: it.pubDate ? Date.parse(it.pubDate) || undefined : undefined,
    image: it.image,
  }))
  return username ? items.map((it) => parseTwitterItem(it, username)) : items
}

async function fetchForSite(site, perSite) {
  if (site.kind === 'twitter') {
    const user = extractUser(site.url)
    if (!user) return []
    // direct nitter first (fast when it responds), then rss2json-based sources
    for (const tpl of TWITTER_FEED_SOURCES) {
      try {
        return await fetchFeed(tpl(user), perSite, site.title, site.domain, user)
      } catch {
        // next source
      }
    }
    for (const feed of [
      `https://nitter.net/${user}/rss`,
      `https://rsshub.app/twitter/user/${user}`,
      `https://twiiit.com/${user}/rss`,
    ]) {
      try {
        const items = await fetchViaRss2Json(feed, perSite, site.title, site.domain, user)
        if (items.length) return items
      } catch {
        // next source
      }
    }
    return []
  }
  const origin = new URL(site.url).origin
  for (const feed of feedCandidates(origin, site.domain)) {
    try {
      return await fetchFeed(feed, perSite, site.title, site.domain)
    } catch {
      // next candidate
    }
  }
  // last resort for websites: rss2json (their infra may reach sites we can't)
  for (const feed of feedCandidates(origin, site.domain)) {
    try {
      const items = await fetchViaRss2Json(feed, perSite, site.title, site.domain)
      if (items.length) return items
    } catch {
      // give up on this site
    }
  }
  return []
}

/* ── API ────────────────────────────────────────────────────── */

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, redis: !!redis })
})

app.post('/api/headlines', async (req, res) => {
  const { sites = [], perSite = 5, includeTwitter = true } = req.body ?? {}
  if (!Array.isArray(sites) || sites.length === 0) {
    return res.json({ items: [] })
  }

  const targets = sites
    .filter((s) => (includeTwitter ? true : s?.kind !== 'twitter'))
    .slice(0, 15)

  const results = []
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const chunk = targets.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(
      chunk.map(async (site, j) => {
        await new Promise((r) => setTimeout(r, j * SITE_DELAY_MS))
        const key = `nagnest:headlines:${site.kind === 'twitter' ? 'tw' : 'site'}:${site.domain}:${site.kind === 'twitter' ? extractUser(site.url) : site.domain}`
        const cached = await cacheGet(key)
        if (cached) return cached
        const items = await fetchForSite(site, perSite)
        await cacheSet(key, items, items.length ? CACHE_TTL : NEGATIVE_TTL)
        return items
      }),
    )
    for (const r of settled) {
      if (r.status === 'fulfilled') results.push(...r.value)
    }
  }

  results.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
  res.json({ items: results, cached: true })
})

/* ── Static hosting of the built app ────────────────────────── */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, '..', 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distDir, 'index.html'))
    }
    next()
  })
}

connectRedis().then(() => {
  app.listen(PORT, () => {
    console.log(`[nagnest] server ready on http://localhost:${PORT}`)
  })
})
