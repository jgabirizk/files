import JSZip from "jszip"
import { fontMetric, buildAdvanceTable, CANVAS_SCALE, type AdvanceTable } from "./text-metrics"
import { buildTiming, splitBuild } from "./build-lines"
import { buildGlyphTable, installOutlines, type GlyphTable } from "./glyph-outlines"
import { makeBezier, CURVES, TEXT_SLIDE_PX, FPS, WORD_ENTRANCE_FRAMES, WORD_STAGGER_FRAMES, type WordReveal } from "./motion"

export type AdSize = "300x250" | "160x600" | "300x600" | "970x250" | "728x90" | "320x50"
export const ALL_AD_SIZES: AdSize[] = ["300x250", "160x600", "300x600", "970x250", "728x90", "320x50"]
const isBanner = (size: AdSize) => size === "728x90" || size === "320x50"
const bannerBarH = (size: AdSize) => (size === "320x50" ? 6 : 10)

const AD_SIZES = {
  "300x250": { width: 300, height: 250 },
  "160x600": { width: 160, height: 600 },
  "300x600": { width: 300, height: 600 },
  "970x250": { width: 970, height: 250 },
  "728x90":  { width: 728, height: 90  },
  "320x50":  { width: 320, height: 50  },
} as const

// Exact padding values from page.tsx
const AD_PADDING: Record<AdSize, number> = {
  "300x250": 30,
  "160x600": 20,
  "300x600": 40,
  "970x250": 40,
  "728x90": 20,
  "320x50": 10,
}

// Modal sizes for crop calculation (exact from page.tsx)
// Modal sizes must match the EXACT dynamic calculation from page.tsx
// Formula: modalH=400, modalW=400*aspectRatio, if modalW>740 then scale down
function getModalSize(size: AdSize): { w: number; h: number } {
  const { width, height } = AD_SIZES[size]
  const adAspect = width / height
  let modalH = 400
  let modalW = modalH * adAspect
  const maxWidth = 740
  if (modalW > maxWidth) {
    modalH = maxWidth / adAspect
    modalW = maxWidth
  }
  return { w: modalW, h: modalH }
}

// Exact Bain logo SVG from page.tsx
const BAIN_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 36.45"><g fill="#fff"><path d="M20.55,32.29c0,2.4,1.83,4.15,4.15,4.15s4.14-1.85,4.14-4.15c0-2.47-1.77-4.17-4.14-4.17s-4.15,1.86-4.15,4.17M22.09,32.29c0-1.49,1.06-2.86,2.61-2.86s2.61,1.13,2.61,2.86c0,1.52-1.07,2.83-2.61,2.83s-2.61-1.21-2.61-2.83Z"/><path d="M11.48,32.27c0,2.42,1.72,4.13,4.15,4.13,1.35,0,2.45-.54,3.19-1.56l.04-.06-1.14-.95-.04.08c-.44.79-1.12,1.2-2.05,1.2-1.58,0-2.61-1.24-2.61-2.84s1.14-2.83,2.61-2.83c.88,0,1.66.49,2.04,1.15l.04.07,1.17-.92-.05-.06c-.79-.97-1.95-1.53-3.2-1.53-2.25,0-4.15,1.72-4.15,4.13Z"/><polygon points="69.71 32.91 69.71 36.25 71.21 36.25 71.21 32.91 74.11 28.32 72.46 28.32 70.46 31.5 68.52 28.32 66.82 28.32 69.71 32.91"/><path d="M42.86,28.32v7.93h1.49v-2.95c.1.01.24.02.37.02,1.91,0,3.28-.85,3.28-2.5s-1.14-2.5-3.28-2.5h-1.86ZM44.36,29.51h.37c1.22,0,1.74.47,1.74,1.3s-.56,1.28-1.74,1.28c-.17,0-.27-.01-.37-.02v-2.55Z"/><polygon points="32.87 31.96 35.33 36.45 37.76 31.96 38.75 36.25 40.31 36.25 38.23 28.18 35.35 33.53 32.43 28.18 30.45 36.25 31.92 36.25 32.87 31.96"/><polygon points="69.53 14.67 55.8 1.99 55.8 23.1 59.6 23.1 59.6 10.93 73.32 23.59 73.32 2.35 69.53 2.36 69.53 14.67"/><path d="M42.87,2.36v20.73h3.94V2.36h-3.94Z"/><path d="M37.82,23.09L27.73,1.99l-10.11,21.1h3.97l1.98-4.41h8l1.92,4.41h4.33ZM25.08,15.34l2.64-5.97,2.46,5.97h-5.1Z"/><path d="M10.68,12.04c1.62-.73,2.82-2.31,2.82-4.3,0-3.59-2.84-5.39-7.83-5.38H.69v20.73h5.88c5.31,0,8.11-2.14,8.11-5.96,0-2.53-1.59-4.28-3.99-5.09M6.32,14.3c2.73,0,4.33.67,4.33,2.88,0,1.92-1.46,2.77-4.34,2.79h-1.72v-5.66h1.73ZM4.59,11.14v-5.65h.7c2.88,0,4.3.78,4.3,2.86s-1.45,2.79-4.16,2.79h-.84Z"/><path d="M5.55,36.25h1.52s-1.29-1.46-1.49-1.72c.19-.23,1.37-2.04,1.37-2.04h-1.25s-.8,1.24-.8,1.24l-1.39-1.56c1.1-.56,1.87-1.36,1.87-2.19,0-1.12-1.06-1.84-2.27-1.84-1.37,0-2.35.81-2.35,1.95,0,.81.57,1.46.92,1.86-.84.46-1.67,1.14-1.67,2.3,0,1.24,1.1,2.2,2.56,2.2.87,0,1.68-.38,2.28-1.01l.72.82ZM1.97,30.11c0-.64.5-1.04,1.15-1.04s1.07.4,1.07.96c0,.66-.77,1.09-1.38,1.41-.49-.44-.84-.86-.84-1.33ZM4.14,34.65c-.26.39-.89.72-1.42.72-.9,0-1.44-.52-1.44-1.26,0-.56.53-1.18,1.1-1.45.01,0,.03-.01.04-.02l1.72,2.01Z"/><polygon points="63.59 33.02 58.35 28.18 58.35 36.25 59.8 36.25 59.8 31.59 65.04 36.43 65.04 28.32 63.59 28.32 63.59 33.02"/><path d="M56.42,36.25l-3.86-8.07-3.86,8.07h1.52l.76-1.69h3.06l.73,1.69h1.66ZM51.55,33.28l1.01-2.28.94,2.28h-1.95Z"/><path d="M108.24,18.99l-3.29-14.75-9.17,11.87,12.46,2.88ZM120,18.12c0,10.01-8.12,18.12-18.15,18.12s-18.16-8.11-18.16-18.13S91.82,0,101.85,0c.98,0,1.95.08,2.89.23l-1.55,2c-.43-.04-.86-.06-1.3-.06-8.44,0-15.29,6.68-15.29,14.92s6.85,14.92,15.29,14.92c8.44,0,15.29-6.68,15.29-14.92,0-6.34-4.05-11.75-9.77-13.91l-.55-2.48c7.59,2.17,13.14,9.15,13.14,17.42Z"/></g></svg>`

interface ShadowStop { position: number; opacity: number }
interface ShadowConfig {
  direction: "auto" | "left" | "right" | "top" | "bottom"
  stops: ShadowStop[]
}

interface ElemTiming {
  redBar: { start: number; end: number }
  title: { start: number; end: number }
  subtitle: { start: number; end: number }
  cta: { start: number; end: number }
  eyebrow?: { start: number; end: number }
  title1out?: { start: number; end: number }
  title2?: { start: number; end: number }
  bg?: { start: number; end: number }
}

interface LayerConfig {
  id: string
  src: string
  startOffsetX: number
  startOffsetY: number
  zoom: "none" | "zoom-in" | "zoom-out"
  zoomAmount: number
  timing: { start: number; end: number }
}

interface CropConfig {
  scale: number
  offsetX: number
  offsetY: number
}

interface ExportConfig {
  backgroundImage: string | null
  layers: LayerConfig[]
  bgMode: "single" | "multi-layer"
  crops: Record<AdSize, CropConfig>
  copyLayout: "standard" | "eyebrow" | "two-frame" | "build"
  title: string
  subtitle: string
  eyebrowText: string
  title2: string
  ctaText: string
  clickUrl: string
  bgAnimation: string
  elemTimings: Record<AdSize, ElemTiming>
  shadows: Record<AdSize, ShadowConfig>
  textDirection: "from-left" | "from-right" | "from-top" | "from-bottom" | "none"
  copyOverrides: Record<AdSize, { title?: string; subtitle?: string; eyebrow?: string; title2?: string; cta?: string }>
  quality?: number // 0.5 to 1.0, default 0.85
  duration?: number // seconds, default 5 to match preview
  layoutType?: "red-bar" | "red-block"
  showRedBar?: boolean
  wordReveal?: WordReveal
  wrapWidth?: Partial<Record<AdSize, { title: number; subtitle: number; cta?: number }>>
  /** Which sizes to export; omitted or empty means all. */
  sizes?: AdSize[]
  textColor?: string
  ctaColor?: string
  ctaArrowColor?: string
  /** false draws the red bar / block in place from frame 0 */
  animateRedBar?: boolean
  /** Font size per size, as a percentage of the layout default */
  fontScale?: Partial<Record<AdSize, FontScale>>
  /** Extra copies of a size; each exports as its own zip */
  variants?: ExportVariant[]
  /** Real-font advance widths, filled by exportAllSizes so the ad breaks lines exactly as the preview did. */
  advances?: AdvanceTable
  /** Vector outlines of the copy, drawn instead of a font file */
  glyphs?: GlyphTable
}

/** Paid-media limit for each size's zip. 150 KB, counted as 150,000 bytes so no ad server rounds it over. */
export const ZIP_LIMIT_BYTES = 150_000
/** Image resolution. CSS pixels are defined at 96 dpi, so 150 dpi = 1.5625x the ad's pixel size. */
export const TARGET_DPI = 150
const DPI_SCALE = TARGET_DPI / 96
const MIN_QUALITY = 0.35

export type FontScale = { title: number; subtitle: number; cta: number }
export type VariantCopy = { title: string; subtitle: string; eyebrow: string; title2: string; cta: string }
export type ExportVariant = {
  size: AdSize
  label: string
  copy: VariantCopy
  /** Absent = the variant follows its size's own wrap / font size. */
  wrap?: { title: number; subtitle: number; cta?: number }
  fontScale?: FontScale
  /** Absent = the size's layout. */
  copyLayout?: ExportConfig["copyLayout"]
  /** Timing for this variant's size when its layout differs from the size's. */
  timing?: ElemTiming
}

const fontScaleFor = (config: ExportConfig, size: AdSize) => {
  const f = config.fontScale?.[size]
  return { title: (f?.title ?? 100) / 100, subtitle: (f?.subtitle ?? 100) / 100, cta: (f?.cta ?? 100) / 100 }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "variant"

export type ExportReport = {
  size: AdSize
  /** Variant name; absent for the base copy */
  label?: string
  zipBytes: number
  /** JPEG quality the budget allowed, or null when the ad carries no image */
  quality: number | null
  /** dpi the image was actually written at (drops below 150 only if the budget forces it) */
  dpi: number | null
  imagePx: { w: number; h: number } | null
  fits: boolean
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })

// Stamp the JFIF header with the real density so print/DAM tools read 150 dpi.
function setJfifDensity(bytes: Uint8Array, dpi: number) {
  const isJfif =
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes[3] === 0xe0 &&
    bytes[6] === 0x4a && bytes[7] === 0x46 && bytes[8] === 0x49 && bytes[9] === 0x46 && bytes[10] === 0
  if (!isJfif) return
  bytes[13] = 1 // units: dots per inch
  bytes[14] = (dpi >> 8) & 255
  bytes[15] = dpi & 255
  bytes[16] = (dpi >> 8) & 255
  bytes[17] = dpi & 255
}

// Crop using the EXACT same math as page.tsx drawBackground, so the exported
// pixels are only the region framed in the crop editor, resampled to `scale`x
// the ad's size. CSS transforms handle the animation overflow.
async function renderCrop(
  img: HTMLImageElement,
  size: AdSize,
  crop: CropConfig,
  quality: number,
  scale: number,
): Promise<{ bytes: Uint8Array; w: number; h: number }> {
  const { width, height } = AD_SIZES[size]
  const targetW = Math.round(width * scale)
  const targetH = Math.round(height * scale)
  const { w: modalW, h: modalH } = getModalSize(size)

  const fitScale = Math.min(modalW / img.naturalWidth, modalH / img.naturalHeight)
  const displayW = img.naturalWidth * fitScale * crop.scale
  const displayH = img.naturalHeight * fitScale * crop.scale

  const srcX = (-crop.offsetX / displayW) * img.naturalWidth
  const srcY = (-crop.offsetY / displayH) * img.naturalHeight
  const srcW = (modalW / displayW) * img.naturalWidth
  const srcH = (modalH / displayH) * img.naturalHeight

  const canvas = document.createElement("canvas")
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext("2d")!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  // JPEG has no alpha: fill first so transparent PNG uploads don't turn black.
  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, targetW, targetH)
  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, targetW, targetH)

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality))
  const bytes = new Uint8Array(blob ? await blob.arrayBuffer() : new ArrayBuffer(0))
  setJfifDensity(bytes, Math.round(96 * scale))
  return { bytes, w: targetW, h: targetH }
}

// Largest quality (up to the user's ceiling) whose images fit `budget` bytes in total.
async function fitImages(
  imgs: HTMLImageElement[],
  size: AdSize,
  crop: CropConfig,
  maxQuality: number,
  scale: number,
  budget: number,
) {
  const encode = (q: number) => Promise.all(imgs.map((im) => renderCrop(im, size, crop, q, scale)))
  const total = (rs: { bytes: Uint8Array }[]) => rs.reduce((n, r) => n + r.bytes.length, 0)

  let best = await encode(maxQuality)
  if (total(best) <= budget) return { results: best, quality: maxQuality, fits: true }
  let lo = MIN_QUALITY
  let hi = maxQuality
  const floor = await encode(lo)
  if (total(floor) > budget) return { results: floor, quality: lo, fits: false }
  best = floor
  for (let i = 0; i < 7; i++) {
    const mid = (lo + hi) / 2
    const r = await encode(mid)
    if (total(r) <= budget) {
      best = r
      lo = mid
    } else hi = mid
  }
  return { results: best, quality: lo, fits: true }
}

function generateHTML(size: AdSize, clickUrl: string, config: ExportConfig, imageFiles: string[]): string {
  const { width, height } = AD_SIZES[size]

  // Background image tags - using CSS transforms for animation
  const bgTags = config.bgMode === "multi-layer"
    ? config.layers.map((_, i) => `<img class="bg-layer" id="layer-${i}" src="layer${i}.jpg" alt="">`).join("\n      ")
    : `<img class="bg-layer" id="bg-image" src="background.jpg" alt="">`

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="ad.size" content="width=${width},height=${height}">
  <title>Bain Ad ${size}</title>
  <script type="text/javascript">
    var clickTag = ${JSON.stringify(clickUrl.trim()).replace(/</g, "\\u003c")};
    (function(){
      var m = /[?&]click[Tt][Aa][Gg]=([^&]*)/.exec(window.location.search);
      if (m && m[1]) clickTag = decodeURIComponent(m[1]);
    })();
  </script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{width:${width}px;height:${height}px;overflow:hidden}
    #ad-container{width:${width}px;height:${height}px;position:relative;overflow:hidden;cursor:pointer;font-family:'Graphik','Helvetica Neue',Arial,sans-serif}
    #bg-container{position:absolute;inset:0;overflow:hidden}
    .bg-layer{position:absolute;top:50%;left:50%;width:100%;height:100%;object-fit:cover;transform:translate(-50%,-50%);transform-origin:center center}
    #overlay{position:absolute;inset:0;pointer-events:none}
  </style>
</head>
<body>
  <div id="ad-container" onclick="window.open(window.clickTag,'_blank')">
    <div id="bg-container">
      ${bgTags}
    </div>
    <canvas id="overlay" width="${width * CANVAS_SCALE}" height="${height * CANVAS_SCALE}" style="width:${width}px;height:${height}px"></canvas>
  </div>
  <script src="animation.js"></script>
</body>
</html>`
}

function generateAnimationJS(
  size: AdSize,
  config: ExportConfig,
  imageFiles: string[]
): string {
  const { width, height } = AD_SIZES[size]
  const padding = AD_PADDING[size]
  const shadow = config.shadows[size]
  // A synced size follows the shared copy, exactly as the preview's effectiveCopy does. Its stored fields
  // are stale snapshots (the build-line editor only writes the shared title2), so they must not leak out.
  type SizeCopy = { synced?: boolean; title?: string; subtitle?: string; eyebrow?: string; eyebrowText?: string; title2?: string; cta?: string; ctaText?: string }
  const rawOverrides = (config.copyOverrides[size] || {}) as SizeCopy
  const overrides: SizeCopy = rawOverrides.synced ? {} : { ...rawOverrides, eyebrow: rawOverrides.eyebrow ?? rawOverrides.eyebrowText }
  
  const activeTitle = overrides.title || config.title
  const activeSubtitle = overrides.subtitle || config.subtitle
  const activeEyebrow = overrides.eyebrow || config.eyebrowText
  const buildParts = splitBuild(overrides.title2 || config.title2)
  const activeTitle2 = buildParts[0]
  // Build: each line gets its own span, and the CTA moves back one step per line past 2.
  const baseTiming = config.elemTimings[size] as ElemTiming & Record<string, { start: number; end: number }>
  const bt = config.copyLayout === "build" ? buildTiming(baseTiming.title, baseTiming.title2, buildParts.length + 1) : null
  const timing =
    bt && bt.ctaShift > 0
      ? (() => {
          const len = baseTiming.cta.end - baseTiming.cta.start
          const cs = Math.min(baseTiming.cta.start + bt.ctaShift, 100 - len)
          return { ...baseTiming, cta: { start: cs, end: cs + len } }
        })()
      : baseTiming
  const buildStarts: number[] = []
  if (bt) {
    let p = 0
    for (const part of [activeTitle, ...buildParts.slice(0, -1)]) {
      p += part.split("\n").length
      buildStarts.push(p)
    }
  }
  const buildSpans = bt ? buildParts.map((_, i) => bt.line(i + 1)) : []
  const activeCtaText = overrides.cta || config.ctaText
  
  const resolvedDirection = shadow.direction === "auto"
    ? (size === "300x250" || size === "970x250" || isBanner(size) ? "left" : "top")
    : shadow.direction
  
  const redBarWidth = isBanner(size) ? bannerBarH(size) : size === "970x250" ? 20 : Math.min(12, height * 0.05)
  const redBarHeight = isBanner(size) ? bannerBarH(size) : size === "300x600" ? 20 : Math.min(12, height * 0.05)
  
  const shadowStopsJSON = JSON.stringify([...shadow.stops].sort((a, b) => a.position - b.position))
  const timingJSON = JSON.stringify(timing)
  const layerConfigsJSON = JSON.stringify(config.layers.map(l => ({
    startOffsetX: l.startOffsetX,
    startOffsetY: l.startOffsetY,
    zoom: l.zoom,
    zoomAmount: l.zoomAmount,
    timing: l.timing
  })))

  const sizeSpecificCode = isBanner(size) 
    ? generate728x90Code(config) 
    : generateVerticalCode(size, config)

  return `(function(){
var canvas = document.getElementById("overlay");
var ctx = canvas.getContext("2d");
// No font file ships: the copy is drawn from vector outlines of the real faces, like an Animate export.
(${installOutlines.toString()})(ctx, ${JSON.stringify(config.glyphs || {})});
var SCALE = ${CANVAS_SCALE};
// Line breaks come from the editor-measured widths of the real fonts, so they match the preview
// whatever face this browser falls back to.
var ADV = ${JSON.stringify(config.advances || {})};
var fontMetric = ${fontMetric.toString()};
function breakWidth(s) { var r = fontMetric(ADV, ctx.font, s); return r.width === null ? ctx.measureText(s).width : r.width; }
var W = ${width}, H = ${height}, pad = ${padding};
var DURATION = ${(config.duration ?? 5) * 1000};

// Two-line build: both sentences form one headline block; paragraphs from
// BUILD_SPLIT on are line 2 and run on the title2 timing.
var IS_BUILD = ${config.copyLayout === "build" ? "true" : "false"};
var BUILD_STARTS = ${JSON.stringify(buildStarts)};
var BUILD_SPANS = ${JSON.stringify(buildSpans)};
var title = ${JSON.stringify(config.copyLayout === "build" ? [activeTitle, ...buildParts].join("\n") : activeTitle)};
var subtitle = ${JSON.stringify(config.copyLayout === "build" ? "" : activeSubtitle)};
var eyebrow = ${JSON.stringify(activeEyebrow)};
var title2 = ${JSON.stringify(activeTitle2)};
var ctaText = ${JSON.stringify(activeCtaText)};

var copyLayout = "${config.copyLayout}";
var textDirection = "${config.textDirection}";
var bgAnimation = "${config.bgAnimation}";
var bgMode = "${config.bgMode}";
var shadowDirection = "${resolvedDirection}";
var shadowStops = ${shadowStopsJSON};
var timing = ${timingJSON};
var layerConfigs = ${layerConfigsJSON};
var redBarHeight = ${redBarHeight};
var modalW = ${getModalSize(size).w};

var makeBezier = ${makeBezier.toString()};
var easeStandard = makeBezier(${CURVES.standard.join(", ")});
var easeEntrance = makeBezier(${CURVES.entrance.join(", ")});
var easeExit = makeBezier(${CURVES.exit.join(", ")});
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function hexToRgba(hex, a) {
  var h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map(function(c) { return c + c; }).join("");
  var n = parseInt(h, 16);
  return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
}
var TEXT_COLOR = ${JSON.stringify(config.textColor || "#FFFFFF")};
var CTA_COLOR = ${JSON.stringify(config.ctaColor || "#FFFFFF")};
var CTA_ARROW_COLOR = ${JSON.stringify(config.ctaArrowColor || "#FFFFFF")};
var WORD_REVEAL = ${JSON.stringify(config.copyLayout !== "standard" && config.wordReveal === "subtitle" ? "none" : config.wordReveal || "none")};
var WRAP = ${JSON.stringify(config.wrapWidth?.[size] || { title: 100, subtitle: 100 })};
var WORD_FRAMES = ${WORD_ENTRANCE_FRAMES}, WORD_STAGGER = ${WORD_STAGGER_FRAMES}, FPS_ = ${FPS};
var NOW_PROGRESS = 0;
var SHOW_RED_BAR = ${config.showRedBar === false ? "false" : "true"};
var ANIMATE_RED_BAR = ${config.animateRedBar === false ? "false" : "true"};
var FS = ${JSON.stringify(fontScaleFor(config, size))};
function txt(a) { return hexToRgba(TEXT_COLOR, a); }
function ctaTxt(a) { return hexToRgba(CTA_COLOR, a); }

var slideMax = ${TEXT_SLIDE_PX};
function textSlide(progress) {
  var remaining = 1 - progress;
  if (textDirection === "from-left") return [-slideMax * remaining, 0];
  if (textDirection === "from-right") return [slideMax * remaining, 0];
  if (textDirection === "from-top") return [0, -slideMax * remaining];
  if (textDirection === "from-bottom") return [0, slideMax * remaining];
  return [0, 0];
}

function splitWords(s) { return s.split(" ").filter(function(w) { return w; }); }

function wrapText(text, maxWidth, key) {
  var limit = maxWidth * (WRAP[key || "title"] / 100);
  var lines = [];
  var paras = [];
  var paragraphs = text.split("\\n");
  for (var p = 0; p < paragraphs.length; p++) {
    var words = splitWords(paragraphs[p]);
    var current = "";
    for (var i = 0; i < words.length; i++) {
      var test = current ? current + " " + words[i] : words[i];
      if (breakWidth(test) > limit && current) {
        lines.push(current);
        paras.push(p);
        current = words[i];
      } else {
        current = test;
      }
    }
    lines.push(current);
    paras.push(p);
  }
  lines.paras = paras;
  return lines;
}

// CTA: Enter forces a break; it only wraps by width once the CTA wrap slider is set.
// Extra lines stack above the baseline, so the CTA keeps its anchor and the arrow follows the last line.
function ctaLayout(text, maxW) {
  var limit = WRAP.cta == null ? Infinity : maxW * WRAP.cta / 100;
  var lines = [];
  var paragraphs = text.split("\\n");
  for (var p = 0; p < paragraphs.length; p++) {
    var words = splitWords(paragraphs[p]);
    var current = "";
    for (var i = 0; i < words.length; i++) {
      var test = current ? current + " " + words[i] : words[i];
      if (breakWidth(test) > limit && current) { lines.push(current); current = words[i]; } else { current = test; }
    }
    lines.push(current);
  }
  var px = parseFloat((/(\\d+(?:\\.\\d+)?)px/.exec(ctx.font) || [0, "12"])[1]);
  var widths = lines.map(function(l) { return ctx.measureText(l).width; });
  return { lines: lines, lh: px * 1.15, widest: Math.max.apply(null, widths.concat([0])), last: widths[widths.length - 1] || 0 };
}
function paintCtaLines(box, x, y, anchor) {
  var n = box.lines.length, shift = anchor === "center" ? (n - 1) * box.lh / 2 : 0;
  for (var i = 0; i < n; i++) ctx.fillText(box.lines[i], x, y - (n - 1 - i) * box.lh + shift);
  return y + shift;
}
function drawCta(text, x, y, maxW) { var b = ctaLayout(text, maxW); paintCtaLines(b, x, y, "bottom"); return { width: b.last }; }

// Word-by-word reveal: 13f entrance per word, 2f apart, 12px drop from above.
function drawCopyLine(key, lines, i, line, x, y, maxW) {
  var revealed = WORD_REVEAL === (key === "subtitle" ? "subtitle" : "title");
  var build = IS_BUILD && key === "title";
  if (!build && !revealed) {
    if (maxW !== undefined) ctx.fillText(line, x, y, maxW); else ctx.fillText(line, x, y);
    return;
  }
  // Single-line sizes pass the headline unwrapped, so line 2 can sit after a newline in the same string.
  function segsOf(l) { return build ? l.split("\\n") : [l]; }
  function sentenceOf(lineIdx, seg) {
    if (!build) return 0;
    var pi = ((lines.paras ? lines.paras[lineIdx] : 0) || 0) + seg, n = 0;
    for (var b = 0; b < BUILD_STARTS.length; b++) if (pi >= BUILD_STARTS[b]) n++;
    return n;
  }
  var total = (DURATION / 1000) * FPS_;
  var frameNow = NOW_PROGRESS * total;
  var space = ctx.measureText(" ").width;
  var base = ctx.globalAlpha;
  var segments = segsOf(line);
  var cx = x;
  for (var si = 0; si < segments.length; si++) {
    var seg = segments[si];
    var sentence = sentenceOf(i, si);
    var segKey = sentence >= 1 ? "title2" : key;
    var span = sentence >= 1 && BUILD_SPANS[sentence - 1] ? BUILD_SPANS[sentence - 1] : segKey === "title" ? timing.title : segKey === "title2" ? (timing.title2 || { start: 55, end: 67 }) : timing.subtitle;
    if (!revealed) {
      if (sentence >= 1) {
        var p2 = easeEntrance(Math.max(0, Math.min(1, (NOW_PROGRESS - span.start / 100) / Math.max(0.01, (span.end - span.start) / 100))));
        var sl = textSlide(p2);
        ctx.globalAlpha = base * p2;
        ctx.fillText(seg, cx + sl[0], y + sl[1]);
        ctx.globalAlpha = base;
      } else if (maxW !== undefined && segments.length === 1) ctx.fillText(seg, cx, y, maxW);
      else ctx.fillText(seg, cx, y);
    } else {
      // Word count restarts per sentence: line 2's first word starts on its own timing.
      var startFrame = (span.start / 100) * total;
      var idx = 0;
      for (var li = 0; li < i; li++) {
        var ls = segsOf(lines[li]);
        for (var sj = 0; sj < ls.length; sj++) if (sentenceOf(li, sj) === sentence) idx += splitWords(ls[sj]).length;
      }
      for (var sk = 0; sk < si; sk++) if (sentenceOf(i, sk) === sentence) idx += splitWords(segments[sk]).length;
      var wx = cx;
      var ws = splitWords(seg);
      for (var w = 0; w < ws.length; w++) {
        var local = (frameNow - startFrame - idx * WORD_STAGGER) / WORD_FRAMES;
        var pr = easeEntrance(Math.max(0, Math.min(1, local)));
        ctx.globalAlpha = base * pr;
        ctx.fillText(ws[w], wx, y - slideMax * (1 - pr));
        wx += ctx.measureText(ws[w]).width + space;
        idx++;
      }
      ctx.globalAlpha = base;
    }
    cx += ctx.measureText(seg).width + space;
  }
}

function drawTriangle(x, y, size, alpha) {
  var h = size;
  var w = size * 0.8;
  ctx.fillStyle = hexToRgba(CTA_ARROW_COLOR, alpha);
  ctx.beginPath();
  ctx.moveTo(x, y - h / 2);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x, y + h / 2);
  ctx.closePath();
  ctx.fill();
}

var logoImg = new Image();
logoImg.src = "data:image/svg+xml;base64," + btoa(${JSON.stringify(BAIN_LOGO_SVG)});

// Get background elements for CSS animation
var bgEls = bgMode === "multi-layer"
  ? layerConfigs.map(function(_, i) { return document.getElementById("layer-" + i); })
  : [document.getElementById("bg-image")];

function startAnimation() {
  var startTime = performance.now();
  
  function draw(time) {
    var elapsed = time - startTime;
    var progress = Math.min(1, elapsed / DURATION);
    NOW_PROGRESS = progress;
    
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.clearRect(0, 0, W, H);
    
    // Animate background via CSS transforms (handles overflow clipping naturally)
    if (bgMode === "multi-layer") {
      for (var idx = 0; idx < layerConfigs.length; idx++) {
        var layer = layerConfigs[idx];
        var el = bgEls[idx];
        if (!el) continue;
        var layerDelay = layer.timing.start / 100;
        var layerDuration = Math.max(0.01, (layer.timing.end - layer.timing.start) / 100);
        var layerProgress = easeStandard(Math.max(0, Math.min(1, (progress - layerDelay) / layerDuration)));
        
        var scaleRatio = W / modalW;
        var offsetX = layer.startOffsetX * scaleRatio * (1 - layerProgress);
        var offsetY = layer.startOffsetY * scaleRatio * (1 - layerProgress);
        
        var drawScale = 1;
        if (layer.zoom === "zoom-in") {
          var startScale = 1 - layer.zoomAmount;
          drawScale = startScale + (1 - startScale) * layerProgress;
        } else if (layer.zoom === "zoom-out") {
          var startScale2 = 1 + layer.zoomAmount;
          drawScale = startScale2 - (startScale2 - 1) * layerProgress;
        }
        
        el.style.transform = "translate(calc(-50% + " + offsetX + "px), calc(-50% + " + offsetY + "px)) scale(" + drawScale + ")";
      }
    } else {
      // Single background - CSS transform animation
      var el = bgEls[0];
      if (el) {
        var bgT = timing.bg || { start: 0, end: 27.2 };
        var bgProgress = easeStandard(clamp01((progress - bgT.start / 100) / Math.max(0.01, (bgT.end - bgT.start) / 100)));
        var transform = "translate(-50%, -50%)";
        
        if (bgAnimation === "zoom-out") {
          // Start at 1.27x scale, end at 1x (zooming out)
          var scale = 1.27 - 0.27 * bgProgress;
          transform = "translate(-50%, -50%) scale(" + scale + ")";
        } else if (bgAnimation === "zoom-in") {
          // Start at 1x, end at 1.27x (zooming in)
          var scale = 1 + 0.27 * bgProgress;
          transform = "translate(-50%, -50%) scale(" + scale + ")";
        } else if (bgAnimation === "pan-left") {
          // Pan from center-right to center-left
          var panPx = W * 0.08;
          var offset = panPx - panPx * 2 * bgProgress;
          transform = "translate(calc(-50% + " + offset + "px), -50%)";
        } else if (bgAnimation === "pan-right") {
          // Pan from center-left to center-right
          var panPx = W * 0.08;
          var offset = -panPx + panPx * 2 * bgProgress;
          transform = "translate(calc(-50% + " + offset + "px), -50%)";
        }
        
        el.style.transform = transform;
      }
    }
    
    
    var shadowGradient;
    if (shadowDirection === "left") shadowGradient = ctx.createLinearGradient(0, 0, W, 0);
    else if (shadowDirection === "right") shadowGradient = ctx.createLinearGradient(W, 0, 0, 0);
    else if (shadowDirection === "bottom") shadowGradient = ctx.createLinearGradient(0, H, 0, 0);
    else shadowGradient = ctx.createLinearGradient(0, 0, 0, H);
    
    for (var i = 0; i < shadowStops.length; i++) {
      var stop = shadowStops[i];
      shadowGradient.addColorStop(stop.position / 100, "rgba(0,0,0," + (stop.opacity / 100).toFixed(2) + ")");
    }
    ctx.fillStyle = shadowGradient;
    ctx.fillRect(0, 0, W, H);
    
    var redBarTimingKey = copyLayout === "standard" || copyLayout === "build" ? "redBar" : "eyebrow";
    var redBarTiming = timing[redBarTimingKey] || timing.redBar;
    var redBarDelay = redBarTiming.start / 100;
    var redBarDur = Math.max(0.01, (redBarTiming.end - redBarTiming.start) / 100);
    var redBarProgress = !ANIMATE_RED_BAR ? 1 : easeStandard(Math.max(0, Math.min(1, (progress - redBarDelay) / redBarDur)));
    
    ctx.fillStyle = "#CC0000";
    if (SHOW_RED_BAR) {
    ${size === "970x250" ? `
    var redBarH = H * redBarProgress;
    ctx.fillRect(W - redBarWidth, 0, redBarWidth, redBarH);
    ` : `
    var rBarH = ${redBarHeight};
    var rBarWidth = W * redBarProgress;
    ctx.fillRect(0, H - rBarH, rBarWidth, rBarH);
    `}
    }
    
    var eyebrowTiming = timing.eyebrow || { start: 0, end: 12 };
    var eyebrowProgress = easeEntrance(Math.max(0, Math.min(1, (progress - eyebrowTiming.start / 100) / Math.max(0.01, (eyebrowTiming.end - eyebrowTiming.start) / 100))));
    var titleProgress = WORD_REVEAL === "title" ? 1 : easeEntrance(Math.max(0, Math.min(1, (progress - timing.title.start / 100) / Math.max(0.01, (timing.title.end - timing.title.start) / 100))));
    var subtitleProgress = WORD_REVEAL === "subtitle" ? 1 : easeEntrance(Math.max(0, Math.min(1, (progress - timing.subtitle.start / 100) / Math.max(0.01, (timing.subtitle.end - timing.subtitle.start) / 100))));
    var eyebrowWipe = easeStandard(clamp01((progress - eyebrowTiming.start / 100) / Math.max(0.01, (eyebrowTiming.end - eyebrowTiming.start) / 100)));
    var ctaProgress = easeEntrance(Math.max(0, Math.min(1, (progress - timing.cta.start / 100) / Math.max(0.01, (timing.cta.end - timing.cta.start) / 100))));
    
    ctx.textBaseline = "top";
    
    ${sizeSpecificCode}
    
    if (progress < 1) {
      requestAnimationFrame(draw);
    }
  }
  
  requestAnimationFrame(draw);
}

// Images are already in the DOM as <img> elements, just start animation
// Wait a frame for images to be ready
requestAnimationFrame(function() {
  startAnimation();
});
})();`
}

function generate728x90Code(config: ExportConfig): string {
  return `
    // Sized off the full height, exactly as the editor does. The headline column starts after the logo,
    // so a smaller logo here would widen the column and break the headline differently from the preview.
    var logoH = (H - pad * 2) * 0.595;
    var logoW = logoH * (120 / 36.45);
    var logoY = (H - logoH) / 2;
    if (logoImg.complete) ctx.drawImage(logoImg, pad, logoY, logoW, logoH);
    
    var ctaFontSize = Math.round(H * 0.15 * FS.cta);
    ctx.font = "500 " + ctaFontSize + "px Graphik, sans-serif";
    var ctaBox = ctaLayout(ctaText, W * 0.34);
    var ctaMetrics = { width: ctaBox.widest };
    var triangleGap = ctaFontSize * 0.4;
    var triangleSize = ctaFontSize * 0.70875;
    var ctaBlockW = ctaMetrics.width + triangleGap + triangleSize + pad;
    
    var textX = pad + logoW + pad;
    var maxTextWidth = W - textX - ctaBlockW - pad;
    
    var title1OutTiming = timing.title1out || { start: 40, end: 52 };
    var title2Timing = timing.title2 || { start: 55, end: 67 };
    var title1OutProgress = easeExit(Math.max(0, Math.min(1, (progress - title1OutTiming.start / 100) / Math.max(0.01, (title1OutTiming.end - title1OutTiming.start) / 100))));
    var title2Progress728 = WORD_REVEAL === "title" ? 1 : easeEntrance(Math.max(0, Math.min(1, (progress - title2Timing.start / 100) / Math.max(0.01, (title2Timing.end - title2Timing.start) / 100))));
    var frame1Alpha = titleProgress * (1 - title1OutProgress);
    var frame2Alpha = title2Progress728;
    
    if (copyLayout === "two-frame") {
      var titleSize = Math.round(H * 0.26 * FS.title);
      var availableH = H - redBarHeight;
      var textY = (availableH - titleSize) / 2;
      
      ctx.font = "600 " + titleSize + "px Graphik, sans-serif";
      var t1slide = textSlide(titleProgress);
      ctx.fillStyle = txt(frame1Alpha);
      drawCopyLine("title", [title], 0, title, textX + t1slide[0], textY + t1slide[1]);
      
      var t2slide = textSlide(title2Progress728);
      ctx.fillStyle = txt(frame2Alpha);
      drawCopyLine("title2", [title2], 0, title2, textX + t2slide[0], textY + t2slide[1]);
      
    } else if (copyLayout === "eyebrow") {
      var titleSize = Math.round(H * 0.26 * FS.title);
      var eyebrowSize = Math.round(H * 0.18);
      var eyebrowPadH = eyebrowSize * 0.2;
      var eyebrowPadV = eyebrowSize * 0.1;
      var eyebrowBlockH = eyebrowSize + eyebrowPadV * 2;
      
      var availableH = H - redBarHeight - pad * 2;
      var totalH = eyebrowBlockH + 4 + titleSize;
      var blockTop = pad + (availableH - totalH) / 2;
      
      var ebslide = textSlide(eyebrowProgress);
      var eyebrowY = blockTop + eyebrowPadV + ebslide[1];
      
      ctx.font = '500 ' + eyebrowSize + 'px "Reckless Neue", serif';
      var eyebrowMetrics = ctx.measureText(eyebrow);
      
      ctx.fillStyle = "#CC0000";
      ctx.fillRect(textX, blockTop, (eyebrowMetrics.width + eyebrowPadH * 2) * eyebrowWipe, eyebrowBlockH);
      
      ctx.fillStyle = txt(eyebrowProgress);
      ctx.fillText(eyebrow, textX + eyebrowPadH + ebslide[0], eyebrowY);
      
      var tslide = textSlide(titleProgress);
      var titleY = blockTop + eyebrowBlockH + 6 + tslide[1];
      ctx.font = "600 " + titleSize + "px Graphik, sans-serif";
      ctx.fillStyle = txt(titleProgress);
      var titleLines = wrapText(title, maxTextWidth);
      for (var ti = 0; ti < titleLines.length; ti++) {
        drawCopyLine("title", titleLines, ti, titleLines[ti], textX + tslide[0], titleY + ti * (titleSize + 2));
      }
      
    } else {
      var titleSize = Math.round(H * 0.26 * FS.title);
      var subtitleSize = Math.round(H * 0.21 * FS.subtitle);
      ctx.font = '500 ' + subtitleSize + 'px "Reckless Neue", serif';
      var subtitleLines = wrapText(subtitle, maxTextWidth, "subtitle");
      var subtitleCount = subtitleLines.filter(function (l) { return l.trim(); }).length;
      ctx.font = "600 " + titleSize + "px Graphik, sans-serif";
      var titleLines = wrapText(title, maxTextWidth);
      // Centre cap height of the first line to the baseline of the last,
      // matching the editor preview.
      var capBox = function (font) {
        ctx.font = font;
        var m = ctx.measureText("H");
        return [-m.actualBoundingBoxAscent, m.actualBoundingBoxDescent];
      };
      var titleCap = capBox("600 " + titleSize + "px Graphik, sans-serif");
      var subtitleCap = capBox('500 ' + subtitleSize + 'px "Reckless Neue", serif');
      var titleBlockH = titleLines.length * (titleSize + 2);
      var inkBottom = subtitleCount
        ? titleBlockH + 4 + (subtitleCount - 1) * (subtitleSize + 2) + subtitleCap[1]
        : (titleLines.length - 1) * (titleSize + 2) + titleCap[1];
      var blockTop = Math.max(0, (H - redBarHeight - (inkBottom - titleCap[0])) / 2 - titleCap[0]);
      
      // capBox leaves the subtitle's font set; restore the headline font before drawing.
      ctx.font = "600 " + titleSize + "px Graphik, sans-serif";
      ctx.fillStyle = txt(titleProgress);
      var stdTslide = textSlide(titleProgress);
      var titleY = blockTop + stdTslide[1];
      for (var ti = 0; ti < titleLines.length; ti++) {
        drawCopyLine("title", titleLines, ti, titleLines[ti], textX + stdTslide[0], titleY + ti * (titleSize + 2));
      }
      var titleBottom = titleY + titleLines.length * (titleSize + 2);
      
      ctx.font = '500 ' + subtitleSize + 'px "Reckless Neue", serif';
      ctx.fillStyle = txt(subtitleProgress);
      var stdSslide = textSlide(subtitleProgress);
      var subtitleY = titleBottom + 4 + stdSslide[1];
      for (var si = 0; si < subtitleLines.length; si++) {
        drawCopyLine("subtitle", subtitleLines, si, subtitleLines[si], textX + stdSslide[0], subtitleY + si * (subtitleSize + 2));
      }
    }
    
    ctx.font = "500 " + ctaFontSize + "px Graphik, sans-serif";
    ctx.fillStyle = ctaTxt(ctaProgress);
    var totalCtaW = ctaMetrics.width + triangleGap + triangleSize;
    var ctaX = W - pad - totalCtaW;
    var ctaSlide = textSlide(ctaProgress);
    var ctaY = (H - redBarHeight) / 2 - ctaFontSize / 2 + ctaSlide[1];
    var ctaLastY = paintCtaLines(ctaBox, ctaX + ctaSlide[0], ctaY, "center");
    drawTriangle(ctaX + ctaSlide[0] + ctaBox.last + triangleGap, ctaLastY + ctaFontSize * 0.5, triangleSize, ctaProgress);
  `
}

function generateVerticalCode(size: AdSize, config: ExportConfig): string {
  const { height } = AD_SIZES[size]
  const redBarHeight = size === "300x600" ? 20 : Math.min(12, height * 0.05)
  const redBarWidth = size === "970x250" ? 20 : Math.min(12, height * 0.05)
  
  let logoHeightExpr: string
  if (size === "160x600" || size === "300x600") {
    logoHeightExpr = "Math.min(36, H * 0.15)"
  } else if (size === "970x250") {
    logoHeightExpr = "Math.min(36, H * 0.15)"
  } else {
    logoHeightExpr = "Math.min(28.8, H * 0.12)"
  }
  
  let titleSizeExpr: string
  if (size === "160x600") {
    titleSizeExpr = "Math.max(18, Math.min(32, W * 0.09))"
  } else if (size === "300x600") {
    titleSizeExpr = "Math.max(20, Math.min(36, W * 0.11))"
  } else if (size === "970x250") {
    titleSizeExpr = "Math.max(18, Math.min(32, W * 0.09))"
  } else {
    titleSizeExpr = "Math.max(16, Math.min(28, W * 0.08))"
  }
  
  let logoToTitleGap: number
  if (size === "970x250") logoToTitleGap = 30
  else if (size === "160x600") logoToTitleGap = 50
  else if (size === "300x600") logoToTitleGap = 45
  else logoToTitleGap = 20
  
  let ctaSizeExpr: string
  if (size === "160x600") {
    ctaSizeExpr = "Math.max(12, Math.min(16.8, W * 0.048))"
  } else if (size === "300x600") {
    ctaSizeExpr = "Math.max(13, Math.min(18.2, W * 0.052))"
  } else if (size === "970x250") {
    ctaSizeExpr = "Math.max(12, Math.min(16.8, W * 0.018))"
  } else {
    ctaSizeExpr = "Math.max(10, Math.min(14, W * 0.04))"
  }
  
  // Same columns as the editor: tall sizes use the full width, the others wrap at two thirds of it.
  const maxTextWidthExpr = size === "300x600" || size === "160x600"
    ? "W - pad * 2"
    : "(W - pad * 2) * (2 / 3)"
  const titleMaxWidthExpr = size === "970x250"
    ? `(W - pad * 2 - ${redBarWidth} - pad) * (2 / 3)`
    : "maxTextWidth"

  return `
    var logoHeight = ${logoHeightExpr};
    var logoWidth = logoHeight * (120 / 36.45);
    if (logoImg.complete) ctx.drawImage(logoImg, pad, pad, logoWidth, logoHeight);
    
    var titleSize = (${titleSizeExpr}) * FS.title;
    var maxTextWidth = ${maxTextWidthExpr};
    var titleMaxWidth = ${titleMaxWidthExpr};
    var logoBottom = pad + logoHeight;
    var logoToTitleGap = ${logoToTitleGap};
    var ctaSize = (${ctaSizeExpr}) * FS.cta;
    
    var title1OutTiming = timing.title1out || { start: 40, end: 52 };
    var title2Timing = timing.title2 || { start: 55, end: 67 };
    var title1OutProgress = easeExit(Math.max(0, Math.min(1, (progress - title1OutTiming.start / 100) / Math.max(0.01, (title1OutTiming.end - title1OutTiming.start) / 100))));
    var title2ProgressV = WORD_REVEAL === "title" ? 1 : easeEntrance(Math.max(0, Math.min(1, (progress - title2Timing.start / 100) / Math.max(0.01, (title2Timing.end - title2Timing.start) / 100))));
    var frame1Alpha = titleProgress * (1 - title1OutProgress);
    var frame2Alpha = title2ProgressV;
    
    if (copyLayout === "two-frame") {
      var frame1Y = logoBottom + logoToTitleGap;
      
      ctx.font = "600 " + titleSize + "px Graphik, sans-serif";
      ctx.fillStyle = txt(frame1Alpha);
      var frame1Lines = wrapText(title, titleMaxWidth);
      var f1slide = textSlide(titleProgress);
      for (var fi = 0; fi < frame1Lines.length; fi++) {
        drawCopyLine("title", frame1Lines, fi, frame1Lines[fi], pad + f1slide[0], frame1Y + f1slide[1] + fi * (titleSize + 4));
      }
      
      ctx.fillStyle = txt(frame2Alpha);
      var frame2Lines = wrapText(title2, titleMaxWidth);
      var f2slide = textSlide(title2ProgressV);
      for (var f2i = 0; f2i < frame2Lines.length; f2i++) {
        drawCopyLine("title2", frame2Lines, f2i, frame2Lines[f2i], pad + f2slide[0], frame1Y + f2slide[1] + f2i * (titleSize + 4));
      }
      
      var titlesBottom = frame1Y + f1slide[1] + Math.max(frame1Lines.length, frame2Lines.length) * (titleSize + 4);
      
      ctx.font = "500 " + ctaSize + "px Graphik, sans-serif";
      ctx.fillStyle = ctaTxt(ctaProgress);
      var ctaSlide = textSlide(ctaProgress);
      ${size === "160x600" || size === "300x600" ? `var ctaY = titlesBottom + 12 + ctaSlide[1];`
        : size === "970x250" ? `var ctaY = H - pad - ctaSize + ctaSlide[1];`
        : `var ctaY = H - ${redBarHeight} - pad + ctaSlide[1];`}
      var ctaMetrics = drawCta(ctaText, pad + ctaSlide[0], ctaY, W - pad * 2);
      var triangleSize = ctaSize * 0.75;
      drawTriangle(pad + ctaSlide[0] + ctaMetrics.width + ctaSize * 0.4, ctaY + ctaSize * 0.5, triangleSize, ctaProgress);
      
    } else if (copyLayout === "eyebrow") {
      var eyebrowFontSize = ${size === "970x250" ? "titleSize * (20 / 30)" : "titleSize * (14 / 20)"};
      ctx.font = '500 ' + eyebrowFontSize + 'px "Reckless Neue", serif';
      var eyebrowPadH = eyebrowFontSize * 0.25;
      var eyebrowPadV = eyebrowFontSize * 0.15;
      var eyebrowBlockH = eyebrowFontSize + eyebrowPadV * 2;
      var eyebrowTitleGap2 = ${size === "970x250" ? 3 : 5};
      var titleStartY = logoBottom + logoToTitleGap + eyebrowBlockH + eyebrowTitleGap2;
      
      var ebslide = textSlide(eyebrowProgress);
      var eyebrowY = titleStartY - eyebrowBlockH - eyebrowTitleGap2 + ebslide[1];
      
      ctx.fillStyle = "#CC0000";
      ctx.fillRect(pad + ebslide[0], eyebrowY - eyebrowPadV, (ctx.measureText(eyebrow).width + eyebrowPadH * 2) * eyebrowWipe, eyebrowBlockH);
      
      ctx.fillStyle = txt(eyebrowProgress);
      ctx.fillText(eyebrow, pad + eyebrowPadH + ebslide[0], eyebrowY);
      
      ctx.font = "600 " + titleSize + "px Graphik, sans-serif";
      ctx.fillStyle = txt(titleProgress);
      var titleLines = wrapText(title, titleMaxWidth);
      var tslide = textSlide(titleProgress);
      for (var ti = 0; ti < titleLines.length; ti++) {
        drawCopyLine("title", titleLines, ti, titleLines[ti], pad + tslide[0], titleStartY + tslide[1] + ti * (titleSize + 4));
      }
      var titleBottom = titleStartY + tslide[1] + titleLines.length * (titleSize + 4);
      
      ctx.font = "500 " + ctaSize + "px Graphik, sans-serif";
      ctx.fillStyle = ctaTxt(ctaProgress);
      var ctaSlide = textSlide(ctaProgress);
      ${size === "970x250" ? `var ctaY = H - pad - ctaSize + ctaSlide[1];` : `var ctaY = titleBottom + 12 + ctaSlide[1];`}
      var ctaMetrics = drawCta(ctaText, pad + ctaSlide[0], ctaY, W - pad * 2);
      var triangleSize = ctaSize * 0.75;
      drawTriangle(pad + ctaSlide[0] + ctaMetrics.width + ctaSize * 0.4, ctaY + ctaSize * 0.5, triangleSize, ctaProgress);
      
    } else {
      ctx.font = "600 " + titleSize + "px Graphik, sans-serif";
      ctx.fillStyle = txt(titleProgress);
      // The editor's standard layout wraps the headline on maxTextWidth, not titleMaxWidth (they differ only on 970x250).
      var titleLines = wrapText(title, maxTextWidth);
      var vstdTslide = textSlide(titleProgress);
      var titleStartY = logoBottom + logoToTitleGap + vstdTslide[1];
      for (var ti = 0; ti < titleLines.length; ti++) {
        drawCopyLine("title", titleLines, ti, titleLines[ti], pad + vstdTslide[0], titleStartY + ti * (titleSize + 4));
      }
      var titleBottom = titleStartY + titleLines.length * (titleSize + 4);
      
      var subtitleSize = (${size === "160x600" ? "titleSize * 0.9" : "titleSize * 0.85"}) * (FS.subtitle / FS.title);
      ctx.font = '500 ' + subtitleSize + 'px "Reckless Neue", serif';
      ctx.fillStyle = txt(subtitleProgress);
      var vstdSslide = textSlide(subtitleProgress);
      var subtitleY = titleBottom + 6 + vstdSslide[1];
      var subtitleLines = wrapText(subtitle, titleMaxWidth, "subtitle");
      for (var si = 0; si < subtitleLines.length; si++) {
        drawCopyLine("subtitle", subtitleLines, si, subtitleLines[si], pad + vstdSslide[0], subtitleY + si * (subtitleSize + 4));
      }
      var subtitleBottom = subtitleY + subtitleLines.length * (subtitleSize + 4);
      
      ctx.font = "500 " + ctaSize + "px Graphik, sans-serif";
      ctx.fillStyle = ctaTxt(ctaProgress);
      var vstdCtaSlide = textSlide(ctaProgress);
      ${size === "160x600" ? `var ctaY = subtitleBottom + 15 + vstdCtaSlide[1];`
        : size === "300x600" ? `var ctaY = subtitleBottom + 15 + vstdCtaSlide[1];`
        : size === "970x250" ? `var ctaY = H - pad - ctaSize + vstdCtaSlide[1];`
        : `var ctaY = H - ${redBarHeight} - pad + vstdCtaSlide[1];`}
      var ctaMetrics = drawCta(ctaText, pad + vstdCtaSlide[0], ctaY, W - pad * 2);
      var triangleSize = ctaSize * ${size === "300x250" ? 0.6379 : size === "970x250" ? 0.6075 : size === "160x600" ? 0.70875 : 0.675};
      drawTriangle(pad + vstdCtaSlide[0] + ctaMetrics.width + ctaSize * 0.4, ctaY + ctaSize * 0.5, triangleSize, ctaProgress);
    }
  `
}

const ZIP_OPTS = { type: "uint8array" as const, compression: "DEFLATE" as const, compressionOptions: { level: 9 } }
// Per-entry zip overhead (local header + central directory) plus a safety margin.
const ZIP_ENTRY_OVERHEAD = 200

export async function exportAllSizes(config: ExportConfig): Promise<ExportReport[]> {
  const sizes: AdSize[] = config.sizes && config.sizes.length ? ALL_AD_SIZES.filter((s) => config.sizes!.includes(s)) : ALL_AD_SIZES
  const maxQuality = config.quality || 0.92
  const reports: ExportReport[] = []

  // Sources in the order their filenames are written.
  const sources: { src: string; name: string }[] =
    config.bgMode === "multi-layer"
      ? config.layers.map((l, i) => ({ src: l.src, name: `layer${i}.jpg` })).filter((l) => l.src)
      : config.backgroundImage
        ? [{ src: config.backgroundImage, name: "background.jpg" }]
        : []
  const loaded = (await Promise.all(sources.map((s) => loadImage(s.src))))
    .map((img, i) => (img ? { img, name: sources[i].name } : null))
    .filter((x): x is { img: HTMLImageElement; name: string } => x !== null)
  const imageFiles = loaded.map((l) => l.name)

  const copy = [config.title, config.subtitle, config.eyebrowText, splitBuild(config.title2).join("\n"), config.ctaText]
  for (const o of [...Object.values(config.copyOverrides || {}), ...(config.variants || []).map((v) => v.copy)]) copy.push(...Object.values(o || {}).filter((v): v is string => typeof v === "string").map((v) => splitBuild(v).join("\n")))
  // Group every piece of copy by the face it is set in, so each face carries only the glyphs it draws.
  const byField = (field: "title" | "title2" | "subtitle" | "eyebrow" | "cta", base: string) => [
    base,
    ...[...Object.values(config.copyOverrides || {}), ...(config.variants || []).map((v) => v.copy)].map((o) => (o as Record<string, unknown> | undefined)?.[field]).filter((v): v is string => typeof v === "string"),
  ].map((v) => splitBuild(v).join("\n"))
  const glyphs = await buildGlyphTable({
    "600|Graphik": [...byField("title", config.title), ...byField("title2", config.title2)],
    "500|Graphik": byField("cta", config.ctaText),
    "500|Reckless Neue": [...byField("subtitle", config.subtitle), ...byField("eyebrow", config.eyebrowText)],
  })
  config = { ...config, advances: await buildAdvanceTable(copy), glyphs }

  const base = config
  const jobs = [
    ...sizes.map((size) => ({ size, label: undefined as string | undefined, cfg: base })),
    ...(base.variants || [])
      .filter((v) => sizes.includes(v.size))
      .map((v) => ({ size: v.size, label: v.label, cfg: {
          ...base,
          copyOverrides: { ...base.copyOverrides, [v.size]: v.copy },
          wrapWidth: v.wrap ? { ...base.wrapWidth, [v.size]: v.wrap } : base.wrapWidth,
          fontScale: v.fontScale ? { ...base.fontScale, [v.size]: v.fontScale } : base.fontScale,
          copyLayout: v.copyLayout ?? base.copyLayout,
          elemTimings: v.timing ? { ...base.elemTimings, [v.size]: v.timing } : base.elemTimings,
        } })),
  ]
  for (const job of jobs) {
    const { size, label } = job
    const config = job.cfg
    const html = generateHTML(size, config.clickUrl, config, imageFiles)
    const js = generateAnimationJS(size, config, imageFiles)

    const textZip = new JSZip()
    textZip.file("index.html", html)
    textZip.file("animation.js", js)
    const textBytes = (await textZip.generateAsync(ZIP_OPTS)).length
    const budget = ZIP_LIMIT_BYTES - textBytes - loaded.length * ZIP_ENTRY_OVERHEAD

    let images: { bytes: Uint8Array; w: number; h: number }[] = []
    let quality: number | null = null
    let scale = DPI_SCALE
    if (loaded.length > 0) {
      const imgs = loaded.map((l) => l.img)
      let fit = await fitImages(imgs, size, config.crops[size], maxQuality, DPI_SCALE, budget)
      // 150 dpi first; only drop to the ad's native pixels when even the lowest quality can't fit.
      if (!fit.fits) {
        scale = 1
        fit = await fitImages(imgs, size, config.crops[size], maxQuality, 1, budget)
      }
      images = fit.results
      quality = fit.quality
    }

    const zip = new JSZip()
    images.forEach((r, i) => zip.file(loaded[i].name, r.bytes, { binary: true }))
    zip.file("index.html", html)
    zip.file("animation.js", js)
    const zipped = await zip.generateAsync(ZIP_OPTS)

    reports.push({
      size,
      label,
      zipBytes: zipped.length,
      quality,
      dpi: images.length ? Math.round(96 * scale) : null,
      imagePx: images[0] ? { w: images[0].w, h: images[0].h } : null,
      fits: zipped.length <= ZIP_LIMIT_BYTES,
    })

    const blob = new Blob([zipped as Uint8Array<ArrayBuffer>], { type: "application/zip" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `bain-ad-${size}${label ? "-" + slug(label) : ""}.zip`
    a.click()
    URL.revokeObjectURL(url)
    
    await new Promise(r => setTimeout(r, 300))
  }
  return reports
}
