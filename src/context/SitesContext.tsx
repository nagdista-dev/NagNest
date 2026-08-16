import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AppData, Category, Site } from '../types'
import { defaultData, loadData, uid, UNCATEGORIZED_ID } from '../lib/storage'
import { getAccountData, saveAccountData } from '../lib/api'
import { useAuth } from './useAuth'
import {
  SitesContext,
  type MergeResult,
  type SitesContextValue,
  type Toast,
  type ToastAction,
} from './sitesContextValue'

interface DeletedEntry {
  kind: 'site'
  site: Site
}

interface DeletedCategoryEntry {
  kind: 'category'
  category: Category
  movedSites: Site[]
}

export function SitesProvider({ children }: { children: ReactNode }) {
  const { token, logout } = useAuth()
  const [data, setData] = useState<AppData>(() => defaultData())
  const [dataLoading, setDataLoading] = useState(true)
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const lastDeleted = useRef<DeletedEntry | DeletedCategoryEntry | null>(null)
  const loaded = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const notify = useCallback(
    (message: string, type: Toast['type'] = 'success', action?: ToastAction) => {
      const id = uid()
      setToasts((prev) => [...prev, { id, message, type, action }])
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
        timers.current.delete(id)
      }, 3500)
      timers.current.set(id, timer)
    },
    [],
  )

  useEffect(() => {
    loaded.current = false
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (!token) {
      setData(defaultData())
      setDataLoading(false)
      return
    }
    let alive = true
    setDataLoading(true)
    getAccountData(token)
      .then(({ data: remote }) => {
        if (!alive) return
        const local = loadData()
        const shouldMigrate = remote.sites.length === 0 && local.sites.length > 0
        const next = shouldMigrate ? local : remote
        setData(next)
        loaded.current = true
        if (shouldMigrate) {
          void saveAccountData(token, next).catch(() => undefined)
        }
      })
      .catch((err) => {
        if (!alive) return
        if (err?.status === 401) logout()
        else notify('Could not load your account data', 'error')
      })
      .finally(() => {
        if (alive) setDataLoading(false)
      })
    return () => {
      alive = false
    }
  }, [token, logout, notify])

  useEffect(() => {
    if (!token || !loaded.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void saveAccountData(token, data).catch((err) => {
        if (err?.status === 401) logout()
        else notify('Could not save changes', 'error')
      })
    }, 250)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [data, token, logout, notify])

  useEffect(() => {
    const map = timers.current
    return () => map.forEach((t) => clearTimeout(t))
  }, [])

  const addSite: SitesContextValue['addSite'] = useCallback((input) => {
    const site: Site = {
      ...input,
      id: uid(),
      visits: 0,
      lastVisited: null,
      createdAt: Date.now(),
    }
    setData((prev) => ({ ...prev, sites: [site, ...prev.sites] }))
  }, [])

  const updateSite: SitesContextValue['updateSite'] = useCallback((id, patch) => {
    setData((prev) => ({
      ...prev,
      sites: prev.sites.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }))
  }, [])

  const deleteSite = useCallback((id: string) => {
    setData((prev) => {
      const site = prev.sites.find((s) => s.id === id)
      if (site) lastDeleted.current = { kind: 'site', site }
      return { ...prev, sites: prev.sites.filter((s) => s.id !== id) }
    })
  }, [])

  const togglePin = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      sites: prev.sites.map((s) => (s.id === id ? { ...s, pinned: !s.pinned } : s)),
    }))
  }, [])

  const registerVisit = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      sites: prev.sites.map((s) =>
        s.id === id ? { ...s, visits: s.visits + 1, lastVisited: Date.now() } : s,
      ),
    }))
  }, [])

  const addCategory = useCallback((name: string, color: string) => {
    const category: Category = { id: uid(), name, color }
    setData((prev) => ({ ...prev, categories: [...prev.categories, category] }))
    return category
  }, [])

  const renameCategory = useCallback((id: string, name: string) => {
    setData((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === id ? { ...c, name } : c)),
    }))
  }, [])

  const recolorCategory = useCallback((id: string, color: string) => {
    setData((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === id ? { ...c, color } : c)),
    }))
  }, [])

  const deleteCategory = useCallback((id: string) => {
    if (id === UNCATEGORIZED_ID) return
    setData((prev) => {
      const category = prev.categories.find((c) => c.id === id)
      const movedSites = prev.sites.filter((s) => s.categoryId === id)
      if (category) lastDeleted.current = { kind: 'category', category, movedSites }
      return {
        ...prev,
        categories: prev.categories.filter((c) => c.id !== id),
        sites: prev.sites.map((s) =>
          s.categoryId === id ? { ...s, categoryId: UNCATEGORIZED_ID } : s,
        ),
      }
    })
  }, [])

  const undoLast = useCallback((): boolean => {
    const entry = lastDeleted.current
    if (!entry) return false
    lastDeleted.current = null
    if (entry.kind === 'site') {
      setData((prev) => ({ ...prev, sites: [entry.site, ...prev.sites] }))
    } else {
      setData((prev) => ({
        ...prev,
        categories: [...prev.categories, entry.category],
        sites: prev.sites.map((s) => {
          const original = entry.movedSites.find((m) => m.id === s.id)
          return original ? { ...s, categoryId: original.categoryId } : s
        }),
      }))
    }
    return true
  }, [])

  const importData = useCallback(
    (incoming: AppData): boolean => {
      if (
        !incoming ||
        !Array.isArray(incoming.sites) ||
        !Array.isArray(incoming.categories)
      ) {
        return false
      }
      setData({ ...incoming, version: 1 })
      return true
    },
    [],
  )

  const mergeData = useCallback(
    (incoming: AppData): MergeResult => {
      if (
        !incoming ||
        !Array.isArray(incoming.sites) ||
        !Array.isArray(incoming.categories)
      ) {
        return { added: 0, skipped: 0 }
      }
      let result: MergeResult = { added: 0, skipped: 0 }
      setData((prev) => {
        const categories = [...prev.categories]
        for (const cat of incoming.categories) {
          if (cat.id === UNCATEGORIZED_ID) continue
          if (!categories.some((c) => c.name.toLowerCase() === cat.name.toLowerCase())) {
            categories.push({ id: uid(), name: cat.name, color: cat.color })
          }
        }
        const sites = [...prev.sites]
        let added = 0
        let skipped = 0
        for (const site of incoming.sites) {
          const exists = sites.some((s) =>
            site.kind === 'twitter'
              ? s.kind === 'twitter' && s.url === site.url
              : s.domain === site.domain,
          )
          if (exists) {
            skipped++
            continue
          }
          const incomingCategory = incoming.categories.find((ic) => ic.id === site.categoryId)
          const category = categories.find(
            (c) => c.name.toLowerCase() === (incomingCategory?.name.toLowerCase() ?? ''),
          )
          sites.push({
            ...site,
            id: uid(),
            createdAt: Date.now(),
            categoryId: category ? category.id : UNCATEGORIZED_ID,
          })
          added++
        }
        result = { added, skipped }
        return { ...prev, sites, categories }
      })
      return result
    },
    [],
  )

  const resetAll = useCallback(() => {
    const fresh = loadData()
    fresh.sites = []
    fresh.categories = fresh.categories.filter((c) => c.id === UNCATEGORIZED_ID)
    setData(fresh)
  }, [])

  const value = useMemo<SitesContextValue>(
    () => ({
      sites: data.sites,
      categories: data.categories,
      dataLoading,
      addSite,
      updateSite,
      deleteSite,
      togglePin,
      registerVisit,
      addCategory,
      renameCategory,
      recolorCategory,
      deleteCategory,
      importData,
      mergeData,
      undoLast,
      resetAll,
      toasts,
      notify,
    }),
    [
      data,
      dataLoading,
      addSite,
      updateSite,
      deleteSite,
      togglePin,
      registerVisit,
      addCategory,
      renameCategory,
      recolorCategory,
      deleteCategory,
      importData,
      mergeData,
      undoLast,
      resetAll,
      toasts,
      notify,
    ],
  )

  return <SitesContext.Provider value={value}>{children}</SitesContext.Provider>
}
