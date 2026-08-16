import type { Site } from '../types'
import {
  cacheItems,
  fetchHeadlines,
  getCachedItems,
  type TickerItem,
} from './ticker'

const CACHE_KEY = 'linknest:feed:v5'
const TTL = 10 * 60 * 1000

export type FeedItem = TickerItem

export async function fetchFeedItems(sites: Site[]): Promise<FeedItem[]> {
  return fetchHeadlines(sites, { perSite: 5, maxSites: 20, includeTwitter: true })
}

export function getCachedFeed(): FeedItem[] | null {
  return getCachedItems(CACHE_KEY, TTL)
}

export function cacheFeed(items: FeedItem[]): void {
  cacheItems(CACHE_KEY, items)
}
