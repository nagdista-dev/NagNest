import { HashRouter, Route, Routes } from 'react-router-dom'
import { SitesProvider } from './context/SitesContext'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Feed } from './pages/Feed'
import { Categories } from './pages/Categories'
import { Backup } from './pages/Backup'

export default function App() {
  return (
    <SitesProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/backup" element={<Backup />} />
            <Route path="*" element={<Dashboard />} />
          </Route>
        </Routes>
      </HashRouter>
    </SitesProvider>
  )
}
