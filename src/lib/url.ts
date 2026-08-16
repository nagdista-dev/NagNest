export interface NormalizedUrl {
  url: string
  domain: string
  hostname: string
}

const GOOGLE_FAVICON = 'https://www.google.com/s2/favicons?domain={domain}&sz=128'
const DUCKDUCKGO_FAVICON = 'https://icons.duckduckgo.com/ip3/{domain}.ico'

export function normalizeUrl(input: string): NormalizedUrl | null {
  let raw = input.trim()
  if (!raw) return null
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`
  try {
    const parsed = new URL(raw)
    if (!parsed.hostname) return null
    const domain = parsed.hostname.replace(/^www\./, '')
    return {
      url: parsed.origin + parsed.pathname + parsed.search,
      domain,
      hostname: parsed.hostname,
    }
  } catch {
    return null
  }
}

export function faviconUrl(domain: string): string {
  return GOOGLE_FAVICON.replace('{domain}', domain)
}

export function faviconFallbackUrl(domain: string): string {
  return DUCKDUCKGO_FAVICON.replace('{domain}', domain)
}

const TWITTER_NON_USER_SEGMENTS = new Set([
  'home',
  'explore',
  'search',
  'notifications',
  'messages',
  'settings',
  'login',
  'signup',
  'i',
  'intent',
  'share',
  'hashtag',
  'status',
  'about',
  'privacy',
  'tos',
  'manifesto',
])

export function isTwitterDomain(hostname: string): boolean {
  return /(^|\.)(twitter|x)\.com$/i.test(hostname)
}

export function extractTwitterUsername(url: string): string | null {
  try {
    const path = new URL(url).pathname.replace(/^\/+/, '').replace(/\/+$/, '')
    const segment = path.split('/')[0].replace(/^@/, '')
    if (!segment || TWITTER_NON_USER_SEGMENTS.has(segment.toLowerCase())) return null
    if (!/^[A-Za-z0-9_]{1,15}$/.test(segment)) return null
    return segment
  } catch {
    return null
  }
}

export function twitterAvatarUrl(username: string): string {
  return `https://unavatar.io/twitter/${username.replace(/^@/, '')}`
}

export function twitterAvatarFallbackUrl(username: string): string {
  return `https://unavatar.io/x/${username.replace(/^@/, '')}`
}

export function twitterAvatarSources(username: string): string[] {
  const clean = username.replace(/^@/, '')
  return [
    `https://unavatar.io/twitter/${clean}`,
    `https://unavatar.io/x/${clean}`,
    `https://api.dicebear.com/7.x/identicon/svg?seed=${clean}`,
  ]
}

export function toTwitterUrl(raw: string): string {
  return raw.replace(
    /(?:https?:\/\/)?(?:www\.)?nitter(?:\.net|\.io)\/(\w+)\/status\/(\d+)/,
    'https://x.com/$1/status/$2',
  )
}

export function hostToTitle(domain: string): string {
  const parts = domain.split('.')
  let name = parts[0]
  if (name === 'ip3' || parts.length > 2) name = parts[parts.length - 2] ?? parts[0]
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

const GRADIENTS = [
  'from-teal-500 to-cyan-600',
  'from-indigo-500 to-violet-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-purple-500 to-fuchsia-600',
  'from-slate-600 to-slate-800',
]

export function domainGradient(domain: string): string {
  let hash = 0
  for (let i = 0; i < domain.length; i++) {
    hash = (hash * 31 + domain.charCodeAt(i)) >>> 0
  }
  return GRADIENTS[hash % GRADIENTS.length]
}

export function domainInitial(domain: string): string {
  return domain.charAt(0).toUpperCase()
}

export function formatDate(ts: number | null): string {
  if (!ts) return 'Never'
  const date = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - ts
  const day = 24 * 60 * 60 * 1000
  if (diff < day) {
    return `Today · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }
  if (diff < 2 * day) return 'Yesterday'
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'now'
  if (min < 60) return `${min}m`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })
}
