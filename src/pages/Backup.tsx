import { useRef, useState } from 'react'
import {
  DatabaseBackup,
  Download,
  Upload,
  Merge,
  HardDrive,
  RotateCcw,
} from 'lucide-react'
import { useSites } from '../context/useSites'
import { exportData } from '../lib/storage'
import type { AppData } from '../types'
import { ConfirmDialog } from '../components/ConfirmDialog'

export function Backup() {
  const { sites, categories, importData, mergeData, resetAll, notify } = useSites()
  const fileRef = useRef<HTMLInputElement>(null)
  const mergeRef = useRef<HTMLInputElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const totalVisits = sites.reduce((acc, s) => acc + s.visits, 0)
  const pinned = sites.filter((s) => s.pinned).length

  const handleExport = () => {
    exportData({ version: 1, sites, categories })
    notify('Backup file downloaded')
  }

  const handleImport = (file: File, mode: 'replace' | 'merge') => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as AppData
        if (mode === 'replace') {
          if (importData(parsed)) {
            notify('Backup imported successfully')
          } else {
            notify('Invalid backup file', 'error')
          }
        } else {
          const { added, skipped } = mergeData(parsed)
          notify(
            `Merged ${added} new site${added === 1 ? '' : 's'}${
              skipped ? `, skipped ${skipped} existing` : ''
            }`,
          )
        }
      } catch {
        notify('Could not read this file', 'error')
      }
    }
    reader.readAsText(file)
  }

  const stats = [
    { label: 'Saved sites', value: sites.length },
    { label: 'Categories', value: categories.length },
    { label: 'Pinned', value: pinned },
    { label: 'Total visits', value: totalVisits },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-slate-900">
          <DatabaseBackup size={19} className="text-teal-600" />
          Backup &amp; Restore
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Your data lives in this browser (localStorage). Download a copy to keep it safe,
          or move it to another device.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{s.label}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600/10 text-teal-600">
            <Download size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Export backup</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Downloads a JSON file with all your sites and categories — keep it in a safe place.
            </p>
          </div>
          <button
            onClick={handleExport}
            className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            <Download size={15} />
            Download backup
          </button>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600">
            <Upload size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Import backup</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Restore from a JSON backup file. Replaces your current data.
            </p>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            <Upload size={15} />
            Choose file…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImport(file, 'replace')
              e.target.value = ''
            }}
          />
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
            <Merge size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Merge a backup</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Adds sites from a backup file into your current nest — existing domains and
              accounts are skipped, duplicates stay untouched.
            </p>
          </div>
        </div>
        <button
          onClick={() => mergeRef.current?.click()}
          className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          <Upload size={15} />
          Merge a backup file…
        </button>
        <input
          ref={mergeRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleImport(file, 'merge')
            e.target.value = ''
          }}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600/10 text-rose-600">
            <RotateCcw size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Danger zone</h3>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
              <HardDrive size={11} />
              Wipe everything from this browser — not reversible.
            </p>
          </div>
        </div>
        <button
          onClick={() => setConfirmReset(true)}
          className="self-start rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700"
        >
          Reset all data
        </button>
      </section>

      <ConfirmDialog
        open={confirmReset}
        title="Reset everything?"
        message="All sites and categories will be permanently deleted from this browser."
        confirmLabel="Yes, wipe all"
        danger
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          resetAll()
          setConfirmReset(false)
          notify('All data erased')
        }}
      />
    </div>
  )
}
