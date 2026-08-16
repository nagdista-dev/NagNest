import { useState } from 'react'
import {
  ExternalLink,
  Pin,
  PinOff,
  Star,
  Pencil,
  Trash2,
  Copy,
} from 'lucide-react'
import type { Site } from '../types'
import { useSites } from '../context/useSites'
import {
  faviconUrl,
  faviconFallbackUrl,
  domainGradient,
  domainInitial,
  formatDate,
  extractTwitterUsername,
  twitterAvatarUrl,
  twitterAvatarFallbackUrl,
} from '../lib/url'
import { ConfirmDialog } from './ConfirmDialog'

interface SiteCardProps {
  site: Site
  onEdit: (site: Site) => void
}

export function SiteCard({ site, onEdit }: SiteCardProps) {
  const { categories, togglePin, registerVisit, deleteSite, undoLast, notify } = useSites()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [imgSource, setImgSource] = useState(0)
  const category = categories.find((c) => c.id === site.categoryId)

  const twitterUser = site.kind === 'twitter' ? extractTwitterUsername(site.url) : null
  const sources = twitterUser
    ? [twitterAvatarUrl(twitterUser), twitterAvatarFallbackUrl(twitterUser)]
    : [faviconUrl(site.domain), faviconFallbackUrl(site.domain)]
  const isAvatar = !!twitterUser

  const open = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    registerVisit(site.id)
    window.open(site.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      <div
        className="group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-slate-300"
        role="link"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            open(e as unknown as React.MouseEvent)
          }
        }}
      >
        <div
          className={`relative flex h-24 items-center justify-center bg-gradient-to-br ${domainGradient(site.domain)}`}
        >
          {imgSource >= sources.length ? (
            <span className="text-4xl font-bold text-white/90">
              {domainInitial(site.domain)}
            </span>
          ) : (
            <img
              src={sources[imgSource]}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className={`h-12 w-12 bg-white object-cover shadow-md ring-1 ring-black/10 ${
                isAvatar ? 'rounded-full' : 'rounded-xl p-2'
              }`}
              onError={() => setImgSource((s) => s + 1)}
            />
          )}
          {twitterUser && (
            <span className="absolute bottom-2 left-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-xs font-black text-black shadow-md ring-1 ring-black/10">
              𝕏
            </span>
          )}
          <button
            title={site.pinned ? 'Unpin' : 'Pin'}
            onClick={(e) => {
              e.stopPropagation()
              togglePin(site.id)
              notify(site.pinned ? 'Removed from pinned' : 'Pinned to top')
            }}
            className={`absolute top-2 right-2 rounded-lg p-1.5 backdrop-blur transition ${
              site.pinned
                ? 'bg-gold text-white shadow'
                : 'bg-black/25 text-white/90 opacity-0 hover:bg-black/40 group-hover:opacity-100'
            }`}
          >
            {site.pinned ? <Pin size={14} fill="currentColor" /> : <PinOff size={14} />}
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-1.5 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 text-sm font-semibold text-slate-900" title={site.title}>
              {site.title}
            </h3>
            <ExternalLink
              size={15}
              className="mt-0.5 shrink-0 text-slate-400 opacity-0 transition group-hover:opacity-100"
            />
          </div>
          <p className="line-clamp-1 text-xs text-slate-500" dir="ltr">
            {site.domain}
          </p>
          {site.note && (
            <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">{site.note}</p>
          )}

          <div className="mt-auto flex items-center gap-2 pt-2.5">
            {category && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ backgroundColor: `${category.color}1a`, color: category.color }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                {category.name}
              </span>
            )}
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-400">
              <Star size={11} />
              {site.visits}
              <span className="mx-0.5">·</span>
              {formatDate(site.lastVisited)}
            </span>
          </div>
        </div>

        <div className="absolute top-2 left-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            title="Copy link"
            onClick={(e) => {
              e.stopPropagation()
              navigator.clipboard.writeText(site.url).catch(() => undefined)
              notify('Link copied')
            }}
            className="rounded-lg bg-black/25 p-1.5 text-white/90 backdrop-blur hover:bg-black/40"
          >
            <Copy size={13} />
          </button>
          <button
            title="Edit"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(site)
            }}
            className="rounded-lg bg-black/25 p-1.5 text-white/90 backdrop-blur hover:bg-black/40"
          >
            <Pencil size={13} />
          </button>
          <button
            title="Delete"
            onClick={(e) => {
              e.stopPropagation()
              setConfirmOpen(true)
            }}
            className="rounded-lg bg-black/25 p-1.5 text-white/90 backdrop-blur hover:bg-rose-600"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this site?"
        message={`"${site.title}" will be removed from your nest.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          deleteSite(site.id)
          setConfirmOpen(false)
          notify('Site deleted', 'success', {
            label: 'Undo',
            onClick: () => {
              if (undoLast()) notify('Site restored')
            },
          })
        }}
      />
    </>
  )
}
