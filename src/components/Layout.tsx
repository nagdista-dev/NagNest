import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Download, LayoutGrid, Newspaper, FolderKanban, DatabaseBackup, LogOut } from 'lucide-react'
import { Toasts } from './Toasts'
import { useAuth } from '../context/useAuth'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid },
  { to: '/feed', label: 'Feed', icon: Newspaper },
  { to: '/categories', label: 'Categories', icon: FolderKanban },
  { to: '/backup', label: 'Backup', icon: DatabaseBackup },
]

function BrandMark({ size = 'default' }: { size?: 'default' | 'sm' }) {
  const dim = size === 'sm' ? 'h-8 w-8 text-sm' : 'h-9 w-9 text-sm sm:h-10 sm:w-10 sm:text-base'
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
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const { user, logout } = useAuth()

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  const installApp = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    setInstallPrompt(null)
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f6f0] text-slate-800">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 shadow-xs backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-2 px-3.5 sm:h-16 sm:px-5 lg:px-6">
          <a href="#/" className="group flex min-w-0 items-center gap-2.5 sm:gap-3" title="NagNest — Dashboard">
            <BrandMark />
            <div className="flex min-w-0 flex-col">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-heading text-sm font-extrabold tracking-wider text-slate-900 uppercase min-[360px]:text-base">
                  Nag<span className="text-teal-600">Nest</span>
                </span>
                <span className="hidden items-center rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-700 ring-1 ring-amber-500/20 min-[360px]:inline-flex sm:text-[10px]">
                  v3.0
                </span>
              </div>
              <p className="hidden text-[11px] font-medium tracking-tight text-slate-500 sm:block">
                Keep Learning, Keep Building
              </p>
            </div>
          </a>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-1.5 lg:flex xl:gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-all duration-150 xl:px-3.5 ${
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
          <div className="flex items-center gap-1 lg:hidden">
            {installPrompt && (
              <button
                type="button"
                onClick={installApp}
                title="Install app"
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-100"
              >
                <Download size={15} />
              </button>
            )}
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
            <button
              type="button"
              onClick={logout}
              title="Log out"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-rose-50 hover:text-rose-600"
            >
              <LogOut size={14} />
            </button>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            {user && (
              <div className="max-w-32 text-right xl:max-w-40">
                <p className="truncate text-xs font-extrabold text-slate-900">{user.name}</p>
                <p className="truncate text-[11px] font-medium text-slate-500">{user.email}</p>
              </div>
            )}
            <button
              type="button"
              onClick={logout}
              title="Log out"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-rose-50 hover:text-rose-600"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-0 pt-0 pb-20 sm:px-5 sm:pb-8 lg:px-6">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar (Sleek Floating App Bar on small screens) */}
      <nav className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-2xl bg-slate-900/95 p-1.5 text-white shadow-xl backdrop-blur-md ring-1 ring-white/15 lg:hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-bold transition ${
                isActive
                  ? 'bg-white/15 text-teal-300 ring-1 ring-white/20'
                  : 'text-slate-400 hover:text-white'
              }`
            }
          >
            <item.icon size={18} />
            <span className="max-w-full truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <Toasts />
    </div>
  )
}
