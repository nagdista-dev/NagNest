export interface Category {
  id: string
  name: string
  color: string
}

export type SiteKind = 'website' | 'twitter'

export interface Site {
  id: string
  url: string
  domain: string
  title: string
  categoryId: string
  note: string
  pinned: boolean
  visits: number
  lastVisited: number | null
  createdAt: number
  kind: SiteKind
}

export interface AppData {
  version: 1
  sites: Site[]
  categories: Category[]
}
