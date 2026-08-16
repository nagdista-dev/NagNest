import { NavLink, Outlet } from 'react-router-dom'
import { LayoutGrid, Newspaper, FolderKanban, DatabaseBackup } from 'lucide-react'
import { Toasts } from './Toasts'
import { Ticker } from './Ticker'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid },
  { to: '/feed', label: 'Feed', icon: Newspaper },
  { to: '/categories', label: 'Categories', icon: FolderKanban },
  { to: '/backup', label: 'Backup', icon: DatabaseBackup },
]

function BrandMark() {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy-deep ring-1 ring-white/10">
      <svg viewBox="0 0 100 100" className="h-6 w-6">
        <text
          x="50"
          y="68"
          fontFamily="'JetBrains Mono',monospace"
          fontSize="30"
          fill="#f59e0b"
          textAnchor="middle"
        >
          {'{'}
        </text>
        <text
          x="56"
          y="68"
          fontFamily="'Poppins',sans-serif"
          fontSize="40"
          fontWeight="700"
          fill="#0d9488"
          textAnchor="middle"
        >
          N
        </text>
        <text
          x="62"
          y="68"
          fontFamily="'JetBrains Mono',monospace"
          fontSize="30"
          fill="#f59e0b"
          textAnchor="middle"
        >
          {'}'}
        </text>
      </svg>
    </div>
  )
}

export function Layout() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-navy shadow-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <a href="#/" className="flex items-center gap-2.5" title="Go to Dashboard">
            <BrandMark />
            <div>
              <h1 className="font-heading text-sm leading-tight font-bold tracking-widest text-white uppercase">
                NagNest
              </h1>
              <p className="text-[11px] leading-tight text-slate-400">
                Keep Learning, Keep Building
              </p>
            </div>
          </a>

          <nav className="ml-auto flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-white/10 text-teal-400'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <item.icon size={15} />
                <span className="hidden sm:inline">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6">
        <Outlet />
      </main>

      <Ticker />
      <Toasts />
    </div>
  )
}
