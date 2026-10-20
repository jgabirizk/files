"use client"

import { Plus, Trash2 } from "lucide-react"

export type VariantCopy = { title: string; subtitle: string; eyebrowText: string; title2: string; ctaText: string }
export type VariantWrap = { title: number; subtitle: number; cta?: number }
export type VariantFontScale = { title: number; subtitle: number; cta: number }
// Absent fields mean "follow this size's own setting", so a variant only diverges where someone changed it.
export type VariantText = { wrap?: VariantWrap; fontScale?: VariantFontScale }
export type AdVariant = { id: string; size: string; label: string; copy: VariantCopy; text?: VariantText }

interface Props {
  size: string
  copyLayout: "standard" | "eyebrow" | "two-frame"
  variants: AdVariant[]
  activeId: string | null
  onAdd: () => void
  onSelect: (id: string | null) => void
  onUpdate: (id: string, patch: Partial<Omit<AdVariant, "id" | "size">>) => void
  onRemove: (id: string) => void
}

const field =
  "w-full resize-none rounded-md border border-sidebar-border bg-sidebar px-2 py-1.5 text-[12px] text-sidebar-foreground focus:border-primary focus:outline-none"

export function VariantsPanel({ size, copyLayout, variants, activeId, onAdd, onSelect, onUpdate, onRemove }: Props) {
  const active = variants.find((v) => v.id === activeId) ?? null
  const fields: { key: keyof VariantCopy; label: string; rows: number }[] = [
    ...(copyLayout === "eyebrow" ? [{ key: "eyebrowText" as const, label: "Eyebrow", rows: 1 }] : []),
    { key: "title", label: copyLayout === "two-frame" ? "Headline · frame 1" : "Headline", rows: 2 },
    ...(copyLayout === "two-frame" ? [{ key: "title2" as const, label: "Headline · frame 2", rows: 2 }] : []),
    ...(copyLayout === "standard" ? [{ key: "subtitle" as const, label: "Body", rows: 2 }] : []),
    { key: "ctaText", label: "CTA", rows: 1 },
  ]

  return (
    <div className="flex flex-col gap-3 border-t border-sidebar-border pt-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-gray-400">Copy variants · {size}</span>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-gray-300 hover:bg-white/5 hover:text-white"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          Add variant
        </button>
      </div>

      <div role="radiogroup" aria-label={`Copy shown for ${size}`} className="flex flex-wrap gap-1">
        {[{ id: null as string | null, label: "Base copy" }, ...variants].map((v) => {
          const on = (activeId ?? null) === v.id || (!active && v.id === null)
          return (
            <button
              key={v.id ?? "base"}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onSelect(v.id)}
              className={`rounded-md px-2 py-1 text-[11px] transition-colors ${
                on ? "bg-primary text-white" : "bg-sidebar-border text-gray-300 hover:bg-white/10"
              }`}
            >
              {v.label}
            </button>
          )
        })}
      </div>

      {active ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="variant-name" className="mb-1 block text-[11px] text-gray-400">
                Variant name
              </label>
              <input
                id="variant-name"
                value={active.label}
                onChange={(e) => onUpdate(active.id, { label: e.target.value })}
                className={field}
              />
            </div>
            <button
              type="button"
              onClick={() => onRemove(active.id)}
              aria-label={`Delete ${active.label}`}
              className="rounded-md p-2 text-gray-400 hover:bg-white/5 hover:text-white"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {fields.map((f) => (
            <div key={f.key}>
              <label htmlFor={`variant-${f.key}`} className="mb-1 block text-[11px] text-gray-400">
                {f.label}
              </label>
              <textarea
                id={`variant-${f.key}`}
                rows={f.rows}
                value={active.copy[f.key]}
                onChange={(e) => onUpdate(active.id, { copy: { ...active.copy, [f.key]: e.target.value } })}
                className={field}
              />
            </div>
          ))}
          <p className="text-[10px] leading-relaxed text-gray-500">
            Shares this size&apos;s image, crop, timing, fonts and wrap. Exports as its own zip and GIF.
          </p>
        </div>
      ) : (
        <p className="text-[10px] leading-relaxed text-gray-500">
          {variants.length === 0
            ? "Add a variant to test different copy on the same size. It starts as a copy of the current text."
            : "Showing the base copy. Pick a variant to preview and edit it."}
        </p>
      )}
    </div>
  )
}
