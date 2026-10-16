import opentype from "opentype.js"

// The exported ad ships no font file. Like an Adobe Animate export, the copy is turned
// into vector outlines at export time: only the characters each face actually uses,
// as SVG path strings the ad draws with Path2D. The ad then looks the same on every
// machine whatever fonts it has, and the outlines cost a few KB instead of the ~177 KB
// the three font files would.

/** Same files app/globals.css loads, so the outlines are the faces the preview shows. */
const FACE_SOURCES: Record<string, { url: string; css: string }> = {
  "600|Graphik": {
    url: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Graphik-Semibold-Web-aoDAAy9H6Ji8C7ggXWTgROZqU1Dkmx.woff",
    css: "600 100px Graphik",
  },
  "500|Graphik": {
    url: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Graphik-Medium-Web-iBsxe0HGI9dkoftDFZeZqLIRG3SHQ6.woff",
    css: "500 100px Graphik",
  },
  "500|Reckless Neue": {
    url: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/RecklessNeue-Medium-iX22qk4JAgjZIbkzg9vqoMl5geWyDT.ttf",
    css: '500 100px "Reckless Neue"',
  },
}

/** Glyph coordinates are stored at this size, so integers carry 0.1px precision at 100px type. */
const UNITS = 1000

export type GlyphFace = {
  /** character -> [advance, SVG path at UNITS px, y-down, origin on the alphabetic baseline] */
  g: Record<string, [number, string]>
  /** "ab" -> kerning adjustment in UNITS */
  k: Record<string, number>
  /** distance from the canvas "top" baseline down to the alphabetic baseline, in UNITS */
  b: number
}
export type GlyphTable = Record<string, GlyphFace>

const parsed: Record<string, Promise<opentype.Font | null>> = {}
function loadFace(key: string): Promise<opentype.Font | null> {
  return (parsed[key] ??= fetch(FACE_SOURCES[key].url)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
    .then((buf) => opentype.parse(buf))
    .catch(() => null))
}

/**
 * Where the alphabetic baseline sits below a "top" baseline, measured from the browser's
 * own rendering of the real font, so outlines land exactly where the preview drew them.
 */
async function topToAlphabetic(key: string, font: opentype.Font): Promise<number> {
  const css = FACE_SOURCES[key].css
  try {
    await document.fonts.load(css)
    if (document.fonts.check(css)) {
      const c = document.createElement("canvas").getContext("2d")
      if (c) {
        c.font = css
        c.textBaseline = "alphabetic"
        const alpha = c.measureText("H").actualBoundingBoxAscent
        c.textBaseline = "top"
        const top = c.measureText("H").actualBoundingBoxAscent
        return Math.round(((alpha - top) * UNITS) / 100)
      }
    }
  } catch {}
  return Math.round((font.ascender / font.unitsPerEm) * UNITS)
}

/** Outlines for `texts` per face key ("600|Graphik" …). A face whose file can't load is left out. */
export async function buildGlyphTable(texts: Record<string, string[]>): Promise<GlyphTable> {
  const out: GlyphTable = {}
  for (const [key, list] of Object.entries(texts)) {
    if (!FACE_SOURCES[key]) continue
    const chars = [...new Set(list.join("") + " ")]
    const font = await loadFace(key)
    if (!font) continue
    const unit = UNITS / font.unitsPerEm
    const face: GlyphFace = { g: {}, k: {}, b: await topToAlphabetic(key, font) }
    const glyphs = new Map<string, opentype.Glyph>()
    for (const ch of chars) {
      const glyph = font.charToGlyph(ch)
      if (!glyph || (glyph.index === 0 && ch !== " ")) continue
      glyphs.set(ch, glyph)
      face.g[ch] = [Math.round((glyph.advanceWidth ?? 0) * unit), glyph.getPath(0, 0, UNITS).toPathData(0)]
    }
    for (const [a, ga] of glyphs) {
      for (const [b, gb] of glyphs) {
        const kern = Math.round(font.getKerningValue(ga, gb) * unit)
        if (kern) face.k[a + b] = kern
      }
    }
    out[key] = face
  }
  return out
}

/**
 * Makes ctx.fillText / ctx.measureText draw and measure from the outline table for any
 * face it covers, falling back to the browser for anything it doesn't. Every text call
 * in the ad goes through this, so no call site has to know outlines exist.
 *
 * Self-contained: injected verbatim into animation.js via toString().
 */
export function installOutlines(ctx: CanvasRenderingContext2D, table: GlyphTable): void {
  var UNITS = 1000
  var nativeFill = ctx.fillText
  var nativeMeasure = ctx.measureText
  var paths: Record<string, Path2D> = {}
  function face(font: string) {
    var m = /([\d.]+)px\s+(.+)$/.exec(font)
    if (!m) return null
    var w = /(?:^|\s)([1-9]00)(?:\s|$)/.exec(font.slice(0, m.index))
    var key = (w ? w[1] : "400") + "|" + m[2].split(",")[0].replace(/["']/g, "").trim()
    var f = table[key]
    return f ? { key: key, f: f, s: parseFloat(m[1]) / UNITS } : null
  }
  function layout(f: GlyphFace, text: string) {
    var xs: number[] = []
    var x = 0
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i)
      var g = f.g[ch]
      if (!g) return null
      if (i > 0) x += f.k[text.charAt(i - 1) + ch] || 0
      xs.push(x)
      x += g[0]
    }
    return { xs: xs, w: x }
  }
  ctx.fillText = function (this: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth?: number) {
    var t = String(text)
    var r = face(this.font)
    var L = r && layout(r.f, t)
    var base = this.textBaseline
    if (!r || !L || (base !== "top" && base !== "alphabetic")) return nativeFill.apply(this, arguments as never)
    var sx = r.s
    if (maxWidth !== undefined && L.w * sx > maxWidth) sx = maxWidth / L.w
    var align = this.textAlign
    var dx = align === "center" ? -L.w * sx / 2 : align === "right" || align === "end" ? -L.w * sx : 0
    this.save()
    this.translate(x + dx, y + (base === "top" ? r.f.b * r.s : 0))
    this.scale(sx, r.s)
    for (var i = 0; i < t.length; i++) {
      var ch = t.charAt(i)
      var d = r.f.g[ch][1]
      if (!d) continue
      var id = r.key + ch
      var p = paths[id] || (paths[id] = new Path2D(d))
      this.translate(L.xs[i], 0)
      this.fill(p)
      this.translate(-L.xs[i], 0)
    }
    this.restore()
  } as typeof ctx.fillText
  ctx.measureText = function (this: CanvasRenderingContext2D, text: string) {
    var n = nativeMeasure.call(this, text)
    var r = face(this.font)
    var L = r && layout(r.f, String(text))
    if (!r || !L) return n
    return {
      width: L.w * r.s,
      actualBoundingBoxAscent: n.actualBoundingBoxAscent,
      actualBoundingBoxDescent: n.actualBoundingBoxDescent,
      actualBoundingBoxLeft: n.actualBoundingBoxLeft,
      actualBoundingBoxRight: L.w * r.s,
      fontBoundingBoxAscent: n.fontBoundingBoxAscent,
      fontBoundingBoxDescent: n.fontBoundingBoxDescent,
    } as TextMetrics
  } as typeof ctx.measureText
}
