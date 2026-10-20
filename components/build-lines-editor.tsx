"use client"

import { Plus, X } from "lucide-react"
import { CopyTextarea, type CopyBoxAlign } from "@/components/copy-textarea"
import { MAX_BUILD_LINES, joinBuild, splitBuild } from "@/lib/build-lines"

interface Props {
  /** The raw title2 value: line 2 onwards, joined by BUILD_SEP. */
  value: string
  onChange: (value: string) => void
  align: CopyBoxAlign
  lineHeight: number
  boxClassName: string
  labelClassName: string
  idPrefix: string
}

/** Lines 2+ of a build. Line 1 is the regular headline field above it. */
export function BuildLinesEditor({ value, onChange, align, lineHeight, boxClassName, labelClassName, idPrefix }: Props) {
  const parts = splitBuild(value)
  const total = parts.length + 1
  const set = (i: number, v: string) => onChange(joinBuild(parts.map((p, j) => (j === i ? v : p))))
  const remove = (i: number) => onChange(joinBuild(parts.filter((_, j) => j !== i)))

  return (
    <div className="flex flex-col gap-3">
      {parts.map((p, i) => {
        const n = i + 2
        const id = `${idPrefix}-line-${n}`
        return (
          <div key={i}>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor={id} className={labelClassName}>
                Line {n}
              </label>
              {parts.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Remove line ${n}`}
                  className="rounded p-0.5 text-gray-500 hover:bg-white/5 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            <CopyTextarea
              id={id}
              rows={2}
              align={align}
              lineHeight={lineHeight}
              value={p}
              onChange={(v) => set(i, v)}
              boxClassName={boxClassName}
            />
          </div>
        )
      })}
      <button
        type="button"
        onClick={() => onChange(joinBuild([...parts, ""]))}
        disabled={total >= MAX_BUILD_LINES}
        className="flex items-center justify-center gap-1 rounded-md border border-dashed border-sidebar-border py-1.5 text-[11px] text-gray-300 hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-3 w-3" aria-hidden="true" />
        {total >= MAX_BUILD_LINES ? `${MAX_BUILD_LINES} lines max` : `Add line ${total + 1}`}
      </button>
    </div>
  )
}
