import { useEffect, useMemo, useRef, useState } from 'react'
import { Link2, X } from 'lucide-react'
import type { Site } from '../types'
import { useSites } from '../context/useSites'
import {
  normalizeUrl,
  faviconUrl,
  hostToTitle,
  isTwitterDomain,
  extractTwitterUsername,
  twitterAvatarUrl,
} from '../lib/url'
import { UNCATEGORIZED_ID } from '../lib/storage'

interface SiteModalProps {
  open: boolean
  editing: Site | null
  defaultUrl?: string
  onClose: () => void
}

const TWITTER_CATEGORY_ID = 'twitter'

export function SiteModal({ open, editing, defaultUrl, onClose }: SiteModalProps) {
  const { categories, addSite, updateSite, sites, notify } = useSites()
  const [urlInput, setUrlInput] = useState('')
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState(UNCATEGORIZED_ID)
  const [note, setNote] = useState('')
  const [urlTouched, setUrlTouched] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const urlRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setAvatarFailed(false)
    if (editing) {
      setUrlInput(editing.url)
      setTitle(editing.title)
      setCategoryId(editing.categoryId)
      setNote(editing.note)
    } else {
      setUrlInput(defaultUrl ?? '')
      setTitle('')
      setCategoryId(UNCATEGORIZED_ID)
      setNote('')
    }
    setUrlTouched(false)
    setTimeout(() => urlRef.current?.focus(), 50)
  }, [open, editing, defaultUrl])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const parsed = useMemo(() => normalizeUrl(urlInput), [urlInput])
  const urlChanged = editing ? urlInput.trim() !== editing.url : true

  const isTwitter =
    !!parsed && isTwitterDomain(parsed.hostname) && !!extractTwitterUsername(parsed.url)

  const twitterUser = isTwitter ? extractTwitterUsername(parsed.url) : null

  const derivedTitle = useMemo(() => {
    if (title.trim()) return title.trim()
    if (editing && !urlChanged) return editing.title
    if (parsed && isTwitter && twitterUser) return `@${twitterUser}`
    return parsed ? hostToTitle(parsed.domain) : ''
  }, [title, parsed, editing, urlChanged, isTwitter, twitterUser])

  const duplicate = useMemo(() => {
    if (!parsed || !parsed.url) return null
    const others = editing ? sites.filter((s) => s.id !== editing.id) : sites
    if (isTwitter && twitterUser) {
      return (
        others.find(
          (s) =>
            s.kind === 'twitter' &&
            extractTwitterUsername(s.url)?.toLowerCase() === twitterUser.toLowerCase(),
        ) ?? null
      )
    }
    return others.find((s) => s.domain === parsed.domain) ?? null
  }, [parsed, sites, editing, isTwitter, twitterUser])

  useEffect(() => {
    if (!open || editing) return
    if (isTwitter) {
      setCategoryId((prev) => {
        if (prev !== UNCATEGORIZED_ID) return prev
        return categories.some((c) => c.id === TWITTER_CATEGORY_ID)
          ? TWITTER_CATEGORY_ID
          : UNCATEGORIZED_ID
      })
    }
  }, [isTwitter, editing, categories, open])

  if (!open) return null

  const handleSave = () => {
    if (editing) {
      let url = editing.url
      let domain = editing.domain
      let kind = editing.kind
      if (urlChanged) {
        if (!parsed || !parsed.url) {
          notify('Enter a valid URL', 'error')
          return
        }
        if (duplicate) {
          notify(`"${duplicate.title}" is already in your nest`, 'error')
          return
        }
        url = parsed.url
        domain = parsed.domain
        kind = isTwitter ? 'twitter' : 'website'
      }
      updateSite(editing.id, {
        url,
        domain,
        kind,
        title: derivedTitle || editing.title,
        categoryId,
        note: note.trim(),
      })
      notify('Changes saved')
    } else {
      if (!parsed || !parsed.url) {
        notify('Enter a valid URL', 'error')
        return
      }
      if (duplicate) {
        notify(`"${duplicate.title}" is already in your nest`, 'error')
        return
      }
      addSite({
        url: parsed.url,
        domain: parsed.domain,
        title: derivedTitle,
        categoryId,
        note: note.trim(),
        pinned: false,
        kind: isTwitter ? 'twitter' : 'website',
      })
      notify(isTwitter ? 'Twitter account added' : 'Site added to your nest')
    }
    onClose()
  }

  const urlInvalid = urlTouched && (!parsed || !parsed.url)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600/10 text-teal-600">
              <Link2 size={16} />
            </div>
            <h2 className="font-heading text-sm font-semibold text-slate-900">
              {editing ? 'Edit site' : 'Add a new site'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={17} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">URL</label>
            <div className="relative">
              <input
                ref={urlRef}
                type="text"
                dir="ltr"
                placeholder="https://example.com"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value)
                  setUrlTouched(true)
                }}
                className={`w-full rounded-xl border bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 ${
                  urlInvalid
                    ? 'border-rose-300 focus:ring-rose-200'
                    : 'border-slate-200 focus:border-teal-500 focus:ring-teal-100'
                }`}
              />
            </div>
            {urlInvalid && <p className="mt-1 text-xs text-rose-500">Please enter a valid URL</p>}
            {isTwitter && (
              <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-sky-600">
                Twitter / X account detected — @{twitterUser}
              </p>
            )}
            {duplicate && (
              <p className="mt-1 text-xs text-amber-600">
                {isTwitter && twitterUser
                  ? `This account is already saved as "${duplicate.title}"`
                  : `This domain is already saved as "${duplicate.title}"`}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Title</label>
            <input
              type="text"
              placeholder={
                parsed
                  ? isTwitter && twitterUser
                    ? `@${twitterUser}`
                    : hostToTitle(parsed.domain)
                  : 'Auto from link…'
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
            {!title && parsed && (
              <p className="mt-1 text-xs text-slate-400">
                Title will be set to "
                {isTwitter && twitterUser ? `@${twitterUser}` : hostToTitle(parsed.domain)}"
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => {
                const active = categoryId === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryId(c.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? 'border-transparent text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                    style={active ? { backgroundColor: c.color } : undefined}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: active ? 'white' : c.color }}
                    />
                    {c.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Note <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Why do you read this site? e.g. Daily AI news…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          {parsed && (
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200">
              {isTwitter && twitterUser ? (
                avatarFailed ? (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
                    {twitterUser.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <img
                    src={twitterAvatarUrl(twitterUser)}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-8 w-8 rounded-full bg-white object-cover ring-1 ring-slate-200"
                    onError={() => setAvatarFailed(true)}
                  />
                )
              ) : (
                <img
                  src={faviconUrl(parsed.domain)}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-lg bg-white object-contain p-1 ring-1 ring-slate-200"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  {isTwitter && twitterUser ? `@${twitterUser}` : parsed.domain}
                </p>
                <p className="truncate text-xs text-slate-400">{parsed.url}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-300 hover:bg-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
          >
            {editing ? 'Save changes' : 'Add to nest'}
          </button>
        </div>
      </div>
    </div>
  )
}
