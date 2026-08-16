import { useContext } from 'react'
import { SitesContext, type SitesContextValue } from './SitesContext'

export function useSites(): SitesContextValue {
  const ctx = useContext(SitesContext)
  if (!ctx) throw new Error('useSites must be used within SitesProvider')
  return ctx
}
