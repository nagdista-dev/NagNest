import 'dotenv/config'
import express from 'express'
import { createClient } from 'redis'
import { XMLParser } from 'fast-xml-parser'
import { MongoClient, ObjectId } from 'mongodb'
import crypto from 'node:crypto'

const PORT = process.env.PORT || 4170
const RAW_REDIS_URL = process.env.REDIS_URL
const REDIS_URL = RAW_REDIS_URL || 'redis://localhost:6379'
const MONGODB_URI = process.env.MONGODB_URI
const AUTH_SECRET = process.env.AUTH_SECRET
const CACHE_TTL = 15 * 60 // 15 minutes per-domain cache
const NEGATIVE_TTL = 60 // cache failures for only 1m to allow quick recovery
const CONCURRENCY = 6
const SITE_DELAY_MS = 100
const FETCH_TIMEOUT_MS = 7000
const REDIS_CONNECT_TIMEOUT_MS = 1500

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })

const app = express()
app.use(express.json({ limit: '256kb' }))

// Allow requests from the Vite dev server
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (_req.method === 'OPTIONS') { res.sendStatus(204); return }
  next()
})

if (!MONGODB_URI) {
  console.warn('[nagnest] MONGODB_URI is not set; auth and account data will fail')
}

if (!AUTH_SECRET || AUTH_SECRET.length < 32) {
  console.warn('[nagnest] AUTH_SECRET must be set to a long random value')
}

/* ── Account database ──────────────────────────────────────── */

const UNCATEGORIZED_ID = 'uncategorized'

function defaultCategories() {
  return [
    { id: 'ai-news', name: 'AI News', color: '#0d9488' },
    { id: 'tech-news', name: 'Tech News', color: '#6366f1' },
    { id: 'blogs', name: 'Blogs', color: '#f59e0b' },
    { id: 'newsletters', name: 'Newsletters', color: '#8b5cf6' },
    { id: 'twitter', name: 'X / Twitter', color: '#0ea5e9' },
    { id: UNCATEGORIZED_ID, name: 'Uncategorized', color: '#64748b' },
  ]
}

function defaultData() {
  return { version: 1, sites: [], categories: defaultCategories() }
}

let mongo = null
let users = null
let mongoConnecting = null

async function connectMongo() {
  if (!MONGODB_URI) throw new Error('MONGODB_URI is not set')
  if (users) return users
  if (mongoConnecting) return mongoConnecting
  mongoConnecting = (async () => {
    mongo = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      socketTimeoutMS: 20000,
    })
    await mongo.connect()
    const db = mongo.db()
    users = db.collection('users')
    await users.createIndex({ email: 1 }, { unique: true })
    console.log('[nagnest] mongodb connected')
    return users
  })()
  try {
    return await mongoConnecting
  } catch (err) {
    mongo?.close?.().catch(() => undefined)
    mongo = null
    users = null
    throw err
  } finally {
    mongoConnecting = null
  }
}

async function getUsersCollection() {
  if (users) return users
  return connectMongo()
}

function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
  }
}

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('base64url')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('base64url')
  return { salt, hash }
}

function verifyPassword(password, user) {
  const { hash } = hashPassword(password, user.passwordSalt)
  const left = Buffer.from(hash)
  const right = Buffer.from(user.passwordHash)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function signToken(userId) {
  if (!AUTH_SECRET || AUTH_SECRET.length < 32) {
    throw new Error('AUTH_SECRET is not configured')
  }
  const header = base64urlJson({ alg: 'HS256', typ: 'JWT' })
  const now = Math.floor(Date.now() / 1000)
  const payload = base64urlJson({
    sub: String(userId),
    iat: now,
    exp: now + 60 * 60 * 24 * 30,
  })
  const body = `${header}.${payload}`
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url')
  return `${body}.${signature}`
}

function verifyToken(token) {
  if (!AUTH_SECRET || AUTH_SECRET.length < 32) return null
  const [header, payload, signature] = String(token ?? '').split('.')
  if (!header || !payload || !signature) return null
  const body = `${header}.${payload}`
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url')
  const left = Buffer.from(signature)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!claims.sub || claims.exp < Math.floor(Date.now() / 1000)) return null
    return claims
  } catch {
    return null
  }
}

async function requireAuth(req, res, next) {
  let usersCollection
  try {
    usersCollection = await getUsersCollection()
  } catch (err) {
    return res.status(503).json({
      error: 'Database is not connected yet. Check your MongoDB Atlas network access and URI.',
      detail: err.message,
    })
  }
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  const claims = verifyToken(token)
  if (!claims || !ObjectId.isValid(claims.sub)) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  const user = await usersCollection.findOne({ _id: new ObjectId(claims.sub) })
  if (!user) return res.status(401).json({ error: 'Authentication required' })
  req.user = user
  next()
}

function normalizeData(input) {
  const base = defaultData()
  if (!input || !Array.isArray(input.sites) || !Array.isArray(input.categories)) return base
  const categories = input.categories
    .filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string')
    .map((c) => ({
      id: c.id,
      name: c.name,
      color: typeof c.color === 'string' ? c.color : '#64748b',
    }))
  for (const category of base.categories) {
    if (!categories.some((c) => c.id === category.id)) categories.push(category)
  }
  const categoryIds = new Set(categories.map((c) => c.id))
  const sites = input.sites
    .filter((s) => s && typeof s.id === 'string' && typeof s.url === 'string')
    .slice(0, 1000)
    .map((s) => ({
      id: s.id,
      url: s.url,
      domain: typeof s.domain === 'string' ? s.domain : '',
      title: typeof s.title === 'string' ? s.title : s.url,
      categoryId: categoryIds.has(s.categoryId) ? s.categoryId : UNCATEGORIZED_ID,
      note: typeof s.note === 'string' ? s.note : '',
      pinned: !!s.pinned,
      visits: Number.isFinite(s.visits) ? Math.max(0, Number(s.visits)) : 0,
      lastVisited: Number.isFinite(s.lastVisited) ? Number(s.lastVisited) : null,
      createdAt: Number.isFinite(s.createdAt) ? Number(s.createdAt) : Date.now(),
      kind: s.kind === 'twitter' ? 'twitter' : 'website',
    }))
  return { version: 1, sites, categories }
}


/* ── Cache layer: Redis with in-memory fallback ─────────────── */

let redis = null
const memCache = new Map()

async function connectRedis() {
  let client = null
  try {
    client = createClient({ url: REDIS_URL })
    client.on('error', () => {})
    await Promise.race([
      client.connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Redis connect timeout')), REDIS_CONNECT_TIMEOUT_MS),
      ),
    ])
    redis = client
    console.log('[nagnest] redis connected')
  } catch (err) {
    client?.destroy?.()
    redis = null
    console.log('[nagnest] redis unavailable - using in-memory cache:', err.message)
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
  'bbc.com': 'https://feeds.bbci.co.uk/news/rss.xml',
  'bbc.co.uk': 'https://feeds.bbci.co.uk/news/rss.xml',
  'aljazeera.net': 'https://aljazeera.net/feed',
  'edition.cnn.com': 'https://edition.cnn.com/rss',
  'cnn.com': 'https://edition.cnn.com/rss',
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
  'reuters.com': 'https://news.google.com/rss/search?q=site:reuters.com',
  'bloomberg.com': 'https://news.google.com/rss/search?q=site:bloomberg.com',
  'hackernoon.com': 'https://hackernoon.com/feed',
  'towardsdatascience.com': 'https://towardsdatascience.com/feed',
  'youm7.com': 'https://news.google.com/rss/search?q=site:youm7.com&hl=ar&gl=EG&ceid=EG:ar',
  'almasryalyoum.com': 'https://news.google.com/rss/search?q=site:almasryalyoum.com&hl=ar&gl=EG&ceid=EG:ar',
  'shorouknews.com': 'https://news.google.com/rss/search?q=site:shorouknews.com&hl=ar&gl=EG&ceid=EG:ar',
  'masrawy.com': 'https://news.google.com/rss/search?q=site:masrawy.com&hl=ar&gl=EG&ceid=EG:ar',
  'ahram.org.eg': 'https://news.google.com/rss/search?q=site:ahram.org.eg&hl=ar&gl=EG&ceid=EG:ar',
}

const TWITTER_FEED_SOURCES = [
  (u) => `https://xcancel.com/${u}/rss`,
  (u) => `https://nitter.net/${u}/rss`,
]

function toTwitterUrl(raw) {
  if (!raw) return raw
  return String(raw)
    .replace(/(?:https?:\/\/)?(?:www\.)?nitter(?:\.[a-z]+)\/(\w+)\/status\/(\d+)/i, 'https://x.com/$1/status/$2')
    .replace(/(?:https?:\/\/)?(?:www\.)?xcancel\.com\/(\w+)\/status\/(\d+)/i, 'https://x.com/$1/status/$2')
    .replace(/(?:https?:\/\/)?(?:www\.)?twitter\.com\//i, 'https://x.com/')
}

function isArabic(text) {
  return /[\u0600-\u06FF]/.test(String(text || ''))
}

function feedCandidates(origin, domain) {
  const known = KNOWN_FEEDS[domain]
  if (known) return [known]
  return [
    `${origin}/feed`,
    `${origin}/rss`,
    `${origin}/feed/`,
    `${origin}/rss.xml`,
    `${origin}/feeds/rss`,
    `${origin}/atom.xml`,
  ]
}

const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9,ar;q=0.8',
}

async function fetchText(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: BROWSER_HEADERS,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

async function discoverRssFeed(siteUrl) {
  try {
    const html = await fetchText(siteUrl)
    const linkMatches = html.matchAll(/<link[^>]+rel=["']alternate["'][^>]+>/gi)
    for (const match of linkMatches) {
      const tag = match[0]
      if (/type=["']application\/(rss\+xml|atom\+xml|xml)["']/i.test(tag)) {
        const hrefMatch = tag.match(/href=["']([^"']+)["']/i)
        if (hrefMatch?.[1]) {
          return new URL(hrefMatch[1], siteUrl).href
        }
      }
    }
  } catch {
    // ignore
  }
  return null
}

// rss2json fetches the feed server-side on their infra — reliable for
// sources that fingerprint-block direct fetches (nitter, twiiit, rsshub).
async function fetchViaRss2Json(feed, perSite, source, domain, username) {
  const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed)}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: BROWSER_HEADERS,
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
      let title = String(it.title).trim()
      if (username) {
        title = title.replace(/\s*-\s*x\.com$/i, '').replace(/\s*-\s*Twitter$/i, '').trim()
      }
      return {
        title,
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
  if (typeof src === 'string' && (src.includes('nitter.net/pic/') || src.includes('xcancel.com/pic/'))) {
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

  // Clean trailing pic.twitter.com or raw [image] placeholder texts or suffix
  title = title
    .replace(/\[\s*image\s*\]/gi, '')
    .replace(/(?:https?:\/\/)?pic\.twitter\.com\/[A-Za-z0-9_]+/gi, '')
    .replace(/\s*-\s*x\.com$/i, '')
    .replace(/\s*-\s*Twitter$/i, '')
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
    const segment = path.split('/')[0]?.replace(/^@/, '')
    return segment ?? url
  } catch {
    return url.replace(/^@/, '')
  }
}

async function fetchFeed(url, perSite, source, domain, username) {
  const xml = await fetchText(url)
  const items = parseXml(xml).slice(0, perSite).map((it) => {
    let title = it.title
    if (username) {
      title = title.replace(/\s*-\s*x\.com$/i, '').replace(/\s*-\s*Twitter$/i, '').trim()
    }
    return {
      title,
      url: username ? toTwitterUrl(it.url) : it.url,
      source,
      domain,
      username,
      publishedAt: it.pubDate ? Date.parse(it.pubDate) || undefined : undefined,
      image: it.image,
    }
  })
  return username ? items.map((it) => parseTwitterItem(it, username)) : items
}

async function fetchGoogleNewsFeed(domain, title, perSite) {
  const arabic = isArabic(title || '') || /youm7|almasry|shorouk|ahram|masrawy|aljazeera|alarabiya|\.eg|\.sa|\.ae/i.test(domain)
  const gnewsUrl = arabic
    ? `https://news.google.com/rss/search?q=${encodeURIComponent(`site:${domain}`)}&hl=ar&gl=EG&ceid=EG:ar`
    : `https://news.google.com/rss/search?q=${encodeURIComponent(`site:${domain}`)}&hl=en-US&gl=US&ceid=US:en`
  return fetchFeed(gnewsUrl, perSite, title, domain)
}

async function fetchTwitterFromGoogle(user, source, perSite) {
  try {
    const gnewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(`site:x.com/${user}`)}&hl=en-US&gl=US&ceid=US:en`
    const items = await fetchFeed(gnewsUrl, perSite, source || `@${user}`, 'x.com', user)
    if (items.length) return items
  } catch {
    // fallback to handle query
  }
  try {
    const gnewsUrl2 = `https://news.google.com/rss/search?q=${encodeURIComponent(`"@${user}" site:x.com`)}&hl=en-US&gl=US&ceid=US:en`
    const items = await fetchFeed(gnewsUrl2, perSite, source || `@${user}`, 'x.com', user)
    if (items.length) return items
  } catch {
    // ignore
  }
  return []
}

async function fetchForSite(site, perSite) {
  if (site.kind === 'twitter') {
    const user = extractUser(site.url)
    if (!user) return []

    // 1. Direct bridges (if active)
    for (const tpl of TWITTER_FEED_SOURCES) {
      try {
        const items = await fetchFeed(tpl(user), perSite, site.title, site.domain, user)
        if (items.length) return items
      } catch {}
    }

    // 2. RSS2JSON bridges
    for (const feed of [
      `https://xcancel.com/${user}/rss`,
      `https://nitter.net/${user}/rss`,
      `https://rsshub.app/twitter/user/${user}`,
      `https://twiiit.com/${user}/rss`,
    ]) {
      try {
        const items = await fetchViaRss2Json(feed, perSite, site.title, site.domain, user)
        if (items.length) return items
      } catch {}
    }

    // 3. Real-time Google News Twitter indexing
    const googleTweets = await fetchTwitterFromGoogle(user, site.title, perSite)
    if (googleTweets.length) return googleTweets

    return []
  }

  // 1. Check known feeds
  const known = KNOWN_FEEDS[site.domain]
  if (known) {
    try {
      const items = await fetchFeed(known, perSite, site.title, site.domain)
      if (items.length) return items
    } catch {}
  }

  // 2. Auto-discover feed link from site homepage HTML
  try {
    const discovered = await discoverRssFeed(site.url)
    if (discovered && discovered !== known) {
      const items = await fetchFeed(discovered, perSite, site.title, site.domain)
      if (items.length) return items
    }
  } catch {}

  // 3. Try standard feed candidates
  const origin = new URL(site.url).origin
  for (const feed of feedCandidates(origin, site.domain)) {
    try {
      const items = await fetchFeed(feed, perSite, site.title, site.domain)
      if (items.length) return items
    } catch {}
  }

  // 4. Try rss2json proxy on standard candidates
  for (const feed of feedCandidates(origin, site.domain)) {
    try {
      const items = await fetchViaRss2Json(feed, perSite, site.title, site.domain)
      if (items.length) return items
    } catch {}
  }

  // 5. Google News RSS search (universal fallback for news websites, youm7, etc.)
  try {
    const gnewsItems = await fetchGoogleNewsFeed(site.domain, site.title, perSite)
    if (gnewsItems.length) return gnewsItems
  } catch {}

  return []
}

/* ── API ────────────────────────────────────────────────────── */

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    redis: !!redis,
    mongo: !!users,
    configured: {
      mongodb: Boolean(MONGODB_URI),
      authSecret: Boolean(AUTH_SECRET && AUTH_SECRET.length >= 32),
    },
  })
})

function databaseSetupError(err) {
  const missing = !MONGODB_URI
  return {
    error: missing
      ? 'Online database is not set up yet. Add MONGODB_URI in Vercel Environment Variables, then redeploy.'
      : 'Online database could not connect. In MongoDB Atlas, allow Vercel network access and check MONGODB_URI.',
    detail: err?.message,
  }
}

app.post('/api/auth/signup', async (req, res) => {
  let usersCollection
  try {
    usersCollection = await getUsersCollection()
  } catch (err) {
    return res.status(503).json(databaseSetupError(err))
  }
  const email = normalizeEmail(req.body?.email)
  const name = String(req.body?.name ?? '').trim()
  const password = String(req.body?.password ?? '')
  if (!name || name.length > 80) {
    return res.status(400).json({ error: 'Enter your name' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }
  const { salt, hash } = hashPassword(password)
  try {
    const result = await usersCollection.insertOne({
      name,
      email,
      passwordSalt: salt,
      passwordHash: hash,
      appData: defaultData(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const user = await usersCollection.findOne({ _id: result.insertedId })
    res.status(201).json({ token: signToken(result.insertedId), user: publicUser(user), data: user.appData })
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'An account already exists for this email' })
    }
    throw err
  }
})

app.post('/api/auth/login', async (req, res) => {
  let usersCollection
  try {
    usersCollection = await getUsersCollection()
  } catch (err) {
    return res.status(503).json(databaseSetupError(err))
  }
  const email = normalizeEmail(req.body?.email)
  const password = String(req.body?.password ?? '')
  const user = await usersCollection.findOne({ email })
  if (!user || !verifyPassword(password, user)) {
    return res.status(401).json({ error: 'Email or password is incorrect' })
  }
  const appData = normalizeData(user.appData)
  res.json({ token: signToken(user._id), user: publicUser(user), data: appData })
})

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user), data: normalizeData(req.user.appData) })
})

app.get('/api/data', requireAuth, (req, res) => {
  res.json({ data: normalizeData(req.user.appData) })
})

app.put('/api/data', requireAuth, async (req, res) => {
  const appData = normalizeData(req.body?.data)
  await users.updateOne(
    { _id: req.user._id },
    { $set: { appData, updatedAt: new Date() } },
  )
  res.json({ data: appData })
})

app.post('/api/headlines', async (req, res) => {
  const { sites = [], perSite = 6, includeTwitter = true } = req.body ?? {}
  if (!Array.isArray(sites) || sites.length === 0) {
    return res.json({ items: [] })
  }

  const targets = sites
    .filter((s) => (includeTwitter ? true : s?.kind !== 'twitter'))
    .slice(0, 100)

  const results = []
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const chunk = targets.slice(i, i + CONCURRENCY)
    const settled = await Promise.allSettled(
      chunk.map(async (site, j) => {
        await new Promise((r) => setTimeout(r, j * SITE_DELAY_MS))
        const key = `nagnest:headlines:v3:${perSite}:${site.kind === 'twitter' ? 'tw' : 'site'}:${site.domain}:${site.kind === 'twitter' ? extractUser(site.url) : site.domain}`
        const cached = await cacheGet(key)
        if (cached && Array.isArray(cached) && cached.length > 0) return cached
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

const isVercel = Boolean(process.env.VERCEL)

if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`[nagnest] server ready on http://localhost:${PORT}`)
  })
}

if (RAW_REDIS_URL || !isVercel) {
  void connectRedis()
}

if (!isVercel) {
  void connectMongo().catch((err) => {
    console.error('[nagnest] mongodb connection failed:', err.message)
  })
}

export default app
