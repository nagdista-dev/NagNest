import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  getMe,
  getStoredToken,
  login as apiLogin,
  setStoredToken,
  signup as apiSignup,
  type AuthUser,
} from '../lib/api'
import { AuthContext } from './authContextValue'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const current = getStoredToken()
    if (!current) {
      setLoading(false)
      return
    }
    getMe(current)
      .then(({ user: nextUser }) => {
        if (!alive) return
        setUser(nextUser)
        setToken(current)
      })
      .catch(() => {
        if (!alive) return
        setStoredToken(null)
        setToken(null)
        setUser(null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin({ email, password })
    setStoredToken(res.token)
    setToken(res.token)
    setUser(res.user)
  }, [])

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const res = await apiSignup({ name, email, password })
    setStoredToken(res.token)
    setToken(res.token)
    setUser(res.user)
  }, [])

  const logout = useCallback(() => {
    setStoredToken(null)
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, token, loading, login, signup, logout }),
    [user, token, loading, login, signup, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
