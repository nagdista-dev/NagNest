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

export function Layout() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <a href="#/" className="flex items-center gap-2.5" title="Go to Dashboard">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 shadow-sm">
              <svg viewBox="0 0 64 64" className="h-5 w-5">
                <path
                  d="M26 42l-4 4a6.5 6.5 0 0 1-9.2-9.2L20 29.6A6.5 6.5 0 0 1 29.2 29l.5.5"
                  stroke="#0d9488"
                  strokeWidth="5"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M38 22l4-4a6.5 6.5 0 0 1 9.2 9.2L44 34.4A6.5 6.5 0 0 1 34.8 35l-.5-.5"
                  stroke="#0d9488"
                  strokeWidth="5"
                  strokeLinecap="round"
                  fill="none"
                />
                <circle cx="32" cy="32" r="5" fill="#f59e0b" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm leading-tight font-bold tracking-tight text-slate-900">
                LinkNest
              </h1>
              <p className="text-[11px] leading-tight text-slate-400">
                All your reading links in one place
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
                      ? 'bg-teal-600/10 text-teal-700'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
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
