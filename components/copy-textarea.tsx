"use client"

export type CopyBoxAlign = "top" | "middle"

interface Props {
  id?: string
  value: string
  onChange: (value: string) => void
  rows: number
  align: CopyBoxAlign
  /** Line height as a multiple of the font size; the box's minimum height is derived from it. */
  lineHeight: number
  /** Box styling: background, border, padding, font size and focus ring. */
  boxClassName: string
}

// A native textarea always pins its text to the top, so the box is drawn by a wrapper and the
// textarea grows with its own content (field-sizing) inside it; the wrapper can then centre it.
export function CopyTextarea({ id, value, onChange, rows, align, lineHeight, boxClassName }: Props) {
  return (
    <div className={boxClassName}>
      <div
        className={`flex flex-col ${align === "middle" ? "justify-center" : "justify-start"}`}
        style={{ minHeight: `${rows * lineHeight}em` }}
      >
        <textarea
          id={id}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="field-sizing-content w-full resize-none border-0 bg-transparent p-0 focus:outline-none"
          style={{ lineHeight }}
        />
      </div>
    </div>
  )
}
