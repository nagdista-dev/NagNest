import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { LockKeyhole, Mail, User, Newspaper } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { ApiError } from '../lib/api'

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { user, login, signup } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isSignup = mode === 'signup'

  if (user) return <Navigate to="/" replace />

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
      setError(err instanceof ApiError ? err.message : 'Could not complete authentication')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f8f6f0] px-4 py-8 text-slate-900 sm:grid sm:place-items-center">
      <section className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-200 sm:grid-cols-[0.95fr_1.05fr]">
        <div className="bg-slate-950 p-6 text-white sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <span className="font-mono font-bold">
                <span className="text-amber-400">{'{'}</span>
                <span className="text-teal-300">N</span>
                <span className="text-amber-400">{'}'}</span>
              </span>
            </div>
            <div>
              <p className="font-heading text-lg font-extrabold uppercase tracking-wide">
                Nag<span className="text-teal-300">Nest</span>
              </p>
              <p className="text-xs font-semibold text-slate-400">Your sources, in your account</p>
            </div>
          </div>

          <div className="mt-10 max-w-sm">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-teal-400/10 px-3 py-1 text-xs font-bold text-teal-200 ring-1 ring-teal-300/20">
              <Newspaper size={13} />
              Full-stack feed workspace
            </div>
            <h1 className="font-heading text-3xl font-extrabold leading-tight sm:text-4xl">
              Save links once. Read them anywhere.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Sign in to keep your websites, X accounts, categories, visits, and feed setup synced
              to your NagNest account.
            </p>
          </div>
        </div>

        <form className="flex flex-col gap-4 p-6 sm:p-8" onSubmit={submit}>
          <div>
            <h2 className="font-heading text-2xl font-extrabold">
              {isSignup ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {isSignup ? 'Start with a secure NagNest account.' : 'Log in to open your saved nest.'}
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">
              {error}
            </div>
          )}

          {isSignup && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-600">Name</span>
              <span className="relative block">
                <User
                  size={16}
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pr-4 pl-10 text-sm font-semibold outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
                />
              </span>
            </label>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-600">Email</span>
            <span className="relative block">
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
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pr-4 pl-10 text-sm font-semibold outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-slate-600">Password</span>
            <span className="relative block">
              <LockKeyhole
                size={16}
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pr-4 pl-10 text-sm font-semibold outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
              />
            </span>
          </label>

          <button
            disabled={submitting}
            className="mt-2 h-12 rounded-xl bg-slate-900 px-5 text-sm font-extrabold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting
              ? 'Please wait...'
              : isSignup
                ? 'Create account'
                : 'Log in'}
          </button>

          <p className="text-center text-sm font-semibold text-slate-500">
            {isSignup ? 'Already have an account?' : 'Need an account?'}{' '}
            <Link
              to={isSignup ? '/login' : '/signup'}
              className="font-extrabold text-teal-700 hover:text-teal-800"
            >
              {isSignup ? 'Log in' : 'Sign up'}
            </Link>
          </p>
        </form>
      </section>
    </main>
  )
}
