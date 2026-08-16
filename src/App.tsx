import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { SitesProvider } from './context/SitesContext'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Feed } from './pages/Feed'
import { Categories } from './pages/Categories'
import { Backup } from './pages/Backup'
import { AuthPage } from './pages/AuthPage'

function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f8f6f0] px-4 text-center">
        <div>
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
            <span className="font-mono font-bold text-teal-300">N</span>
          </div>
          <p className="text-sm font-bold text-slate-700">Opening your nest...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return (
    <SitesProvider>
      <Layout />
    </SitesProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route element={<ProtectedRoute />}>
            <Route index element={<Dashboard />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/backup" element={<Backup />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
