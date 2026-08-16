import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AppData, Category, Site } from '../types'
import {
  loadData,
  saveData,
  uid,
  UNCATEGORIZED_ID,
} from '../lib/storage'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error'
}

interface SitesContextValue {
  sites: Site[]
  categories: Category[]
  addSite: (input: Omit<Site, 'id' | 'createdAt' | 'visits' | 'lastVisited'>) => void
  updateSite: (id: string, patch: Partial<Omit<Site, 'id'>>) => void
  deleteSite: (id: string) => void
  togglePin: (id: string) => void
  registerVisit: (id: string) => void
  addCategory: (name: string, color: string) => Category
  renameCategory: (id: string, name: string) => void
  recolorCategory: (id: string, color: string) => void
  deleteCategory: (id: string) => void
  importData: (data: AppData) => boolean
  resetAll: () => void
  toasts: Toast[]
  notify: (message: string, type?: Toast['type']) => void
}

const SitesContext = createContext<SitesContextValue | null>(null)

export function SitesProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData())
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    saveData(data)
  }, [data])

  const notify = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = uid()
    setToasts((prev) => [...prev, { id, message, type }])
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
      timers.current.delete(id)
    }, 2800)
    timers.current.set(id, timer)
  }, [])

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
    setData((prev) => ({ ...prev, sites: prev.sites.filter((s) => s.id !== id) }))
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
        s.id === id
          ? { ...s, visits: s.visits + 1, lastVisited: Date.now() }
          : s,
      ),
    }))
  }, [])

  const addCategory = useCallback(
    (name: string, color: string) => {
      const category: Category = { id: uid(), name, color }
      setData((prev) => ({ ...prev, categories: [...prev.categories, category] }))
      return category
    },
    [],
  )

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
    setData((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c.id !== id),
      sites: prev.sites.map((s) =>
        s.categoryId === id ? { ...s, categoryId: UNCATEGORIZED_ID } : s,
      ),
    }))
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
      resetAll,
      toasts,
      notify,
    }),
    [
      data,
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
      resetAll,
      toasts,
      notify,
    ],
  )

  return <SitesContext.Provider value={value}>{children}</SitesContext.Provider>
}

export function useSites(): SitesContextValue {
  const ctx = useContext(SitesContext)
  if (!ctx) throw new Error('useSites must be used within SitesProvider')
  return ctx
}
