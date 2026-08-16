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

function BrandMark({ size = 'default' }: { size?: 'default' | 'sm' }) {
  const dim = size === 'sm' ? 'h-8 w-8 text-sm' : 'h-10 w-10 text-base'
  return (
    <div className={`relative flex ${dim} shrink-0 items-center justify-center rounded-xl bg-slate-900 shadow-md ring-1 ring-white/10 transition group-hover:scale-105 group-hover:shadow-teal-900/20`}>
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-teal-500/20 to-amber-500/20 opacity-0 group-hover:opacity-100 transition" />
      <span className="font-mono font-bold select-none tracking-tighter">
        <span className="text-amber-500">{'{'}</span>
        <span className="text-teal-400 font-extrabold font-heading">N</span>
        <span className="text-amber-500">{'}'}</span>
      </span>
    </div>
  )
}

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8f6f0] text-slate-800">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 shadow-xs backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-3.5 sm:px-6">
          <a href="#/" className="group flex items-center gap-2.5 sm:gap-3" title="NagNest — Dashboard">
            <BrandMark />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-heading text-base font-extrabold tracking-wider text-slate-900 uppercase">
                  Nag<span className="text-teal-600">Nest</span>
                </span>
                <span className="inline-flex items-center rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-extrabold text-amber-700 ring-1 ring-amber-500/20">
                  v3.0
                </span>
              </div>
              <p className="hidden xs:block text-[11px] font-medium tracking-tight text-slate-500">
                Keep Learning, Keep Building
              </p>
            </div>
          </a>

          {/* Desktop Nav */}
          <nav className="hidden sm:flex items-center gap-1.5 sm:gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition-all duration-150 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-800'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <item.icon size={16} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Mobile Fast Links */}
          <div className="flex sm:hidden items-center gap-1">
            <NavLink
              to="/feed"
              className={({ isActive }) =>
                `flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold transition ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`
              }
            >
              <Newspaper size={14} className="text-teal-500" />
              Feed
            </NavLink>
          </div>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-3.5 py-5 pb-32 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar (Sleek Floating App Bar on small screens) */}
      <nav className="fixed inset-x-3 bottom-12 z-40 flex sm:hidden items-center justify-around rounded-2xl bg-slate-900/95 p-1.5 text-white shadow-xl backdrop-blur-md ring-1 ring-white/15">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] font-bold transition ${
                isActive
                  ? 'bg-white/15 text-teal-300 ring-1 ring-white/20'
                  : 'text-slate-400 hover:text-white'
              }`
            }
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Live Ticker Bar */}
      <Ticker />
      <Toasts />
    </div>
  )
}
