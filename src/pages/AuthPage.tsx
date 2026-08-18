import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  LockKeyhole,
  Mail,
  User,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  Globe2,
} from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { ApiError } from '../lib/api'

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { user, login, signup } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  
  const isSignup = mode === 'signup'

  if (user) return <Navigate to="/" replace />

  const passwordStrength = (() => {
    if (!password) return 0
    let score = 0
    if (password.length >= 8) score += 1
    if (/[A-Z]/.test(password) || /[0-9]/.test(password)) score += 1
    if (/[^A-Za-z0-9]/.test(password) && password.length >= 10) score += 1
    return score
  })()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (isSignup) await signup(name.trim(), email.trim(), password)
      else await login(email.trim(), password)
      const state = location.state as { from?: { pathname?: string } } | null
      navigate(state?.from?.pathname ?? '/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Authentication failed. Please check your credentials.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f8f6f0] flex items-center justify-center p-3.5 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200/90 grid lg:grid-cols-[1.05fr_0.95fr]">
        
        {/* Left / Top Branding Panel (Sleek Dark Hero on Desktop & Mobile) */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-6 text-white sm:p-10 flex flex-col justify-between">
          
          {/* Subtle Ambient Background Gradients */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-teal-500/15 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

          {/* Logo & Brand Identity */}
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 shadow-inner backdrop-blur-md">
                <span className="font-mono text-lg font-black tracking-tight select-none">
                  <span className="text-amber-400">{'{'}</span>
                  <span className="text-teal-300">N</span>
                  <span className="text-amber-400">{'}'}</span>
                </span>
              </div>
              <div>
                <p className="font-heading text-xl font-black uppercase tracking-wider text-white">
                  Nag<span className="text-teal-400">Nest</span>
                </p>
                <p className="text-xs font-semibold text-slate-400">
                  Keep Learning, Keep Building
                </p>
              </div>
            </div>

            <div className="mt-8 sm:mt-12 max-w-md">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-teal-400/10 px-3.5 py-1 text-xs font-bold text-teal-300 ring-1 ring-teal-400/20 backdrop-blur-md">
                <Sparkles size={13} className="text-amber-400" />
                <span>Next-Gen Personal Feed Hub</span>
              </div>
              <h1 className="font-heading text-2xl font-black leading-tight sm:text-4xl text-white tracking-tight">
                Your websites & 𝕏 accounts, all in one live nest.
              </h1>
              <p className="mt-3.5 text-xs sm:text-sm leading-relaxed text-slate-300 font-medium">
                Sign in to sync your custom categories, monitored Twitter profiles, breaking news wire, and personal notes across all your devices.
              </p>
            </div>
          </div>

          {/* Feature List (Desktop & Tablet) */}
          <div className="relative z-10 mt-8 hidden sm:grid gap-3 pt-6 border-t border-white/10">
            <div className="flex items-center gap-3 text-xs font-bold text-slate-300">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500/20 text-teal-300">
                <Zap size={13} />
              </div>
              <span>Real-time X Pro and News Wire timeline aggregation</span>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold text-slate-300">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500/20 text-teal-300">
                <Globe2 size={13} />
              </div>
              <span>Arabic & international news auto-translation</span>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold text-slate-300">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-500/20 text-teal-300">
                <ShieldCheck size={13} />
              </div>
              <span>Encrypted cloud sync with MongoDB & instant offline backup</span>
            </div>
          </div>
        </div>

        {/* Right / Bottom Form Panel */}
        <div className="p-6 sm:p-10 flex flex-col justify-center bg-white">
          
          {/* Mode Switcher Tabs */}
          <div className="mb-6 flex rounded-2xl bg-slate-100 p-1 ring-1 ring-slate-200/80">
            <Link
              to="/login"
              className={`flex-1 rounded-xl py-2 text-center text-xs font-extrabold transition-all duration-150 ${
                !isSignup
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className={`flex-1 rounded-xl py-2 text-center text-xs font-extrabold transition-all duration-150 ${
                isSignup
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Create Account
            </Link>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {isSignup ? 'Create your Nest account' : 'Welcome back'}
            </h2>
            <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-500">
              {isSignup
                ? 'Join NagNest to save and monitor all your sources.'
                : 'Enter your credentials to access your dashboard.'}
            </p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-2xl bg-rose-50 p-3.5 text-xs font-bold text-rose-700 ring-1 ring-rose-200 animate-in fade-in">
              <span className="shrink-0 text-rose-500">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form className="flex flex-col gap-4" onSubmit={submit}>
            
            {/* Name input (for signup) */}
            {isSignup && (
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  Full Name
                </label>
                <div className="relative">
                  <User
                    size={16}
                    className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                    placeholder="John Doe"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/80 pr-4 pl-10 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
                  />
                </div>
              </div>
            )}

            {/* Email input */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="name@example.com"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/80 pr-4 pl-10 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
                />
              </div>
            </div>

            {/* Password input */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                Password
              </label>
              <div className="relative">
                <LockKeyhole
                  size={16}
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  placeholder="Min 8 characters"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/80 pr-11 pl-10 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password Strength Indicator on Signup */}
              {isSignup && password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1 h-1.5 w-full">
                    <div className={`h-full flex-1 rounded-full transition-colors ${passwordStrength >= 1 ? 'bg-rose-500' : 'bg-slate-200'}`} />
                    <div className={`h-full flex-1 rounded-full transition-colors ${passwordStrength >= 2 ? 'bg-amber-500' : 'bg-slate-200'}`} />
                    <div className={`h-full flex-1 rounded-full transition-colors ${passwordStrength >= 3 ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                  </div>
                  <p className="text-[11px] font-bold text-slate-400">
                    {passwordStrength === 1 && '⚠️ Weak password'}
                    {passwordStrength === 2 && '👍 Medium strength'}
                    {passwordStrength >= 3 && '🔥 Strong password'}
                  </p>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              disabled={submitting}
              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 text-sm font-black text-white shadow-md transition hover:bg-teal-600 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Please wait...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  {isSignup ? 'Create Account' : 'Sign In'}
                  <ArrowRight size={16} />
                </span>
              )}
            </button>

            {/* Footer switcher link */}
            <p className="mt-2 text-center text-xs font-bold text-slate-500">
              {isSignup ? 'Already have an account?' : "Don't have an account yet?"}{' '}
              <Link
                to={isSignup ? '/login' : '/signup'}
                className="text-teal-700 hover:text-teal-900 underline font-black ml-1"
              >
                {isSignup ? 'Log in' : 'Create one now'}
              </Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  )
}
