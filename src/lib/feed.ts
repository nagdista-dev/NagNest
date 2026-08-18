import type { Site } from '../types'
import {
  cacheItems,
  fetchHeadlines,
  getCachedItems,
  type TickerItem,
} from './ticker'

const CACHE_KEY = 'nagnest:feed:v8'
const TTL = 5 * 60 * 1000

export type FeedItem = TickerItem

export async function fetchFeedItems(sites: Site[]): Promise<FeedItem[]> {
  return fetchHeadlines(sites, { perSite: 6, maxSites: 100, includeTwitter: true })
}

export function getCachedFeed(): FeedItem[] | null {
  return getCachedItems(CACHE_KEY, TTL)
}

export function cacheFeed(items: FeedItem[]): void {
  cacheItems(CACHE_KEY, items)
}
