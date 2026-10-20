// Line breaks must not depend on which font the ad server renders.
//
// The editor has Graphik and Reckless Neue loaded; an exported zip cannot carry
// them (the three files are ~177 KB, more than the whole 150 KB budget), so the
// live ad measures a fallback face and breaks lines in different places. Instead,
// both renderers decide breaks from one table of the REAL fonts' advance widths,
// measured here in the editor and baked into animation.js.

/** weight|family -> character -> advance width at 100px. */
export type AdvanceTable = Record<string, Record<string, number>>

/**
 * Width of `text` in `font` from the table, or null if the table can't answer
 * (unknown font, or a character it has not measured).
 *
 * Kept self-contained: its source is injected verbatim into the exported ad via
 * `toString()`, so it may not reference anything outside its own body.
 */
export function fontMetric(table: AdvanceTable, font: string, text: string): { key: string; width: number | null } {
  var m = /([\d.]+)px\s+(.+)$/.exec(font)
  if (!m) return { key: "", width: null }
  var w = /(?:^|\s)([1-9]00)(?:\s|$)/.exec(font.slice(0, m.index))
  var family = m[2].split(",")[0].replace(/["']/g, "").trim()
  var key = (w ? w[1] : "400") + "|" + family
  var t = table[key]
  if (!t) return { key: key, width: null }
  var sum = 0
  for (var i = 0; i < text.length; i++) {
    var a = t[text.charAt(i)]
    if (a === undefined) return { key: key, width: null }
    sum += a
  }
  return { key: key, width: (sum * parseFloat(m[1])) / 100 }
}

/** The editor's table, filled on demand. Never cached from a fallback face. */
export const ADVANCES: AdvanceTable = {}

let probe: CanvasRenderingContext2D | null = null

/** Measures any characters of `text` the table lacks, but only once `font` is really loaded. */
export function ensureAdvances(font: string, text: string): void {
  if (typeof document === "undefined") return
  const { key, width } = fontMetric(ADVANCES, font, text)
  if (width !== null || !key) return
  const at100 = font.replace(/[\d.]+px/, "100px")
  if (document.fonts && !document.fonts.check(at100)) return
  if (!probe) probe = document.createElement("canvas").getContext("2d")
  if (!probe) return
  probe.font = at100
  const row = (ADVANCES[key] = ADVANCES[key] || {})
  for (const ch of new Set(text)) {
    if (row[ch] === undefined) row[ch] = probe.measureText(ch).width
  }
}

/** Width the line-breaker uses, identical in the editor and the exported ad. */
export function breakWidth(ctx: CanvasRenderingContext2D, text: string): number {
  ensureAdvances(ctx.font, text)
  const { width } = fontMetric(ADVANCES, ctx.font, text)
  return width ?? ctx.measureText(text).width
}

/** Every face the ad copy is set in. Weight + family, matching the ctx.font strings in both renderers. */
export const COPY_FONTS = [
  `600 100px Graphik, sans-serif`,
  `500 100px Graphik, sans-serif`,
  `500 100px "Reckless Neue", serif`,
  `400 100px "Reckless Neue", serif`,
]

/** Waits for the real fonts, then returns the slice of the table covering `texts`. */
export async function buildAdvanceTable(texts: string[]): Promise<AdvanceTable> {
  if (typeof document === "undefined") return {}
  await Promise.all(COPY_FONTS.map((f) => document.fonts.load(f).catch(() => [])))
  const joined = texts.join(" ")
  const out: AdvanceTable = {}
  for (const font of COPY_FONTS) {
    ensureAdvances(font, joined)
    const { key } = fontMetric(ADVANCES, font, "")
    const row = ADVANCES[key]
    if (!row) continue
    out[key] = {}
    for (const ch of new Set(joined)) if (row[ch] !== undefined) out[key][ch] = Math.round(row[ch] * 100) / 100
  }
  return out
}

/** Render resolution for the overlay canvas, so motion moves in half-pixel steps rather than snapping. */
export const CANVAS_SCALE = 2
