import { useRef, useState } from 'react'
import { FolderKanban, Plus, Trash2 } from 'lucide-react'
import { useSites } from '../context/useSites'
import { CATEGORY_COLORS, UNCATEGORIZED_ID } from '../lib/storage'
import { ConfirmDialog } from '../components/ConfirmDialog'

export function Categories() {
  const {
    categories,
    sites,
    addCategory,
    renameCategory,
    recolorCategory,
    deleteCategory,
    undoLast,
    notify,
  } = useSites()
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [selectedColor, setSelectedColor] = useState(CATEGORY_COLORS[0])
  const inputRef = useRef<HTMLInputElement>(null)

  const pendingCategory = categories.find((c) => c.id === pendingDelete)
  const pendingCount = pendingCategory
    ? sites.filter((s) => s.categoryId === pendingCategory.id).length
    : 0

  const handleAdd = () => {
    const name = newName.trim()
    if (!name) {
      notify('Type a category name', 'error')
      return
    }
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      notify('Category already exists', 'error')
      return
    }
    addCategory(name, selectedColor)
    setNewName('')
    notify(`Category "${name}" created`)
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-slate-900">
          <FolderKanban size={19} className="text-teal-600" />
          Categories
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Organize your news sites — like "AI News", "Tech News", "Newsletters"…
        </p>
      </div>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              New category
            </label>
            <input
              ref={inputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="e.g. AI Papers"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Color</label>
            <div className="flex items-center gap-1.5">
              {CATEGORY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`h-6 w-6 rounded-full transition ${
                    selectedColor === color
                      ? 'scale-110 ring-2 ring-slate-900 ring-offset-2 ring-offset-white'
                      : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
          <button
            onClick={handleAdd}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            <Plus size={15} />
            Create
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        {categories.map((c) => {
          const count = sites.filter((s) => s.categoryId === c.id).length
          const isEditing = editingId === c.id
          const isFixed = c.id === UNCATEGORIZED_ID
          return (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-slate-200"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: c.color }}
              >
                <FolderKanban size={16} />
              </span>

              <div className="min-w-0 flex-1">
                {isEditing ? (
                  <input
                    type="text"
                    defaultValue={c.name}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const value = (e.target as HTMLInputElement).value.trim()
                        if (value) renameCategory(c.id, value)
                        setEditingId(null)
                      }
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onBlur={(e) => {
                      const value = e.target.value.trim()
                      if (value && value !== c.name) renameCategory(c.id, value)
                      setEditingId(null)
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-sm font-medium text-slate-900 outline-none focus:border-teal-500"
                  />
                ) : (
                  <button
                    className="text-sm font-semibold text-slate-900 hover:text-teal-600"
                    onClick={() => !isFixed && setEditingId(c.id)}
                    title={isFixed ? 'Fixed category' : 'Click to rename'}
                  >
                    {c.name}
                    {isFixed && (
                      <span className="ml-2 text-xs font-normal text-slate-500">fixed</span>
                    )}
                  </button>
                )}
                <p className="text-xs text-slate-400">
                  {count} site{count === 1 ? '' : 's'}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {!isFixed && (
                  <>
                    {CATEGORY_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => {
                          recolorCategory(c.id, color)
                          notify('Color updated')
                        }}
                        className={`h-5 w-5 rounded-full transition hover:scale-110 ${
                          c.color === color
                            ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-800'
                            : 'opacity-40 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: color }}
                        title="Set color"
                      />
                    ))}
                    <button
                      onClick={() => setPendingDelete(c.id)}
                      className="ml-1 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      title="Delete category"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </section>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this category?"
        message={
          pendingCount > 0
            ? `"${pendingCategory?.name}" has ${pendingCount} site${pendingCount === 1 ? '' : 's'} — they will move to "Uncategorized".`
            : `"${pendingCategory?.name}" will be removed.`
        }
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            deleteCategory(pendingDelete)
            notify('Category deleted', 'success', {
              label: 'Undo',
              onClick: () => {
                if (undoLast()) notify('Category restored')
              },
            })
          }
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
