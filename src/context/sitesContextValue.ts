import { createContext } from 'react'
import type { AppData, Category, Site } from '../types'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error'
  action?: ToastAction
}

export interface MergeResult {
  added: number
  skipped: number
}

export interface SitesContextValue {
  sites: Site[]
  categories: Category[]
  dataLoading: boolean
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
  mergeData: (data: AppData) => MergeResult
  undoLast: () => boolean
  resetAll: () => void
  toasts: Toast[]
  notify: (message: string, type?: Toast['type'], action?: ToastAction) => void
}

export const SitesContext = createContext<SitesContextValue | null>(null)
