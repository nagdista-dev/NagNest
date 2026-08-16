import type { AppData, Category } from '../types'

const STORAGE_KEY = 'gather-links:v1'

export const CATEGORY_COLORS = [
  '#0d9488',
  '#6366f1',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#0ea5e9',
  '#10b981',
  '#ec4899',
  '#64748b',
  '#f97316',
]

export const UNCATEGORIZED_ID = 'uncategorized'

export function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function defaultCategories(): Category[] {
  return [
    { id: 'ai-news', name: 'AI News', color: '#0d9488' },
    { id: 'tech-news', name: 'Tech News', color: '#6366f1' },
    { id: 'blogs', name: 'Blogs', color: '#f59e0b' },
    { id: 'newsletters', name: 'Newsletters', color: '#8b5cf6' },
    { id: 'twitter', name: 'X / Twitter', color: '#0ea5e9' },
    { id: UNCATEGORIZED_ID, name: 'Uncategorized', color: '#64748b' },
  ]
}

function defaultData(): AppData {
  return { version: 1, sites: [], categories: defaultCategories() }
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultData()
    const parsed = JSON.parse(raw) as AppData
    if (!parsed || !Array.isArray(parsed.sites) || !Array.isArray(parsed.categories)) {
      return defaultData()
    }
    const hasUncategorized = parsed.categories.some((c) => c.id === UNCATEGORIZED_ID)
    if (!hasUncategorized) {
      parsed.categories.push({
        id: UNCATEGORIZED_ID,
        name: 'Uncategorized',
        color: '#64748b',
      })
    }
    const hasTwitter = parsed.categories.some((c) => c.id === 'twitter')
    if (!hasTwitter) {
      parsed.categories.push({ id: 'twitter', name: 'X / Twitter', color: '#0ea5e9' })
    }
    parsed.sites = parsed.sites.map((s) => ({ ...s, kind: s.kind ?? 'website' }))
    return parsed
  } catch {
    return defaultData()
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function exportData(data: AppData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `gather-links-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
