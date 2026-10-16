"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { exportAllSizes, type ExportReport } from "@/lib/export-ads"
import { encodeGif, GIF_CAPTURE_FPS } from "@/lib/export-gif"
import JSZip from "jszip"

type GifReportRow = { size: string; bytes: number; fps: number; colors: number }
import { TextMotionPanel } from "@/components/text-motion-panel"
import { breakWidth, CANVAS_SCALE } from "@/lib/text-metrics"
import { easeStandard, easeEntrance, easeExit, TEXT_SLIDE_PX, nearestToken, MAX_MOVE_FRAMES, FPS, WORD_ENTRANCE_FRAMES, WORD_STAGGER_FRAMES, wordRevealFrames, type WordReveal } from "@/lib/motion"
import { TimelinePanel, type TimelineTrack } from "@/components/timeline-panel"
import {
  Upload,
  Play,
  Pause,
  SkipForward,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  Download,
  RotateCcw,
  Settings,
  Image as ImageIcon,
  Type,
  Layers,
  X,
  Plus,
  Trash2,
  ChevronUp,
  Link,
  Unlink,
  Save,
  FolderOpen,
  Film,
} from "lucide-react"
import { downloadProject, parseProject, projectFileName } from "@/lib/project-file"

// Ad size configurations
const AD_SIZES = {
  "300x250": { width: 300, height: 250 },
  "160x600": { width: 160, height: 600 },
  "970x250": { width: 970, height: 250 },
  "728x90": { width: 728, height: 90 },
  "300x600": { width: 300, height: 600 },
  "320x50": { width: 320, height: 50 },
} as const

// Padding for each ad size
const AD_PADDING = {
  "300x250": 30,
  "160x600": 20,
  "300x600": 40,
  "970x250": 40,
  "728x90": 20,
  "320x50": 10,
} as const

type AdSize = keyof typeof AD_SIZES

// Red Block base geometry + which axis can be extended and by how much (in px)
const RED_BLOCK_BASE: Record<AdSize, { x: number; y: number; w: number; h: number; pad: number; axis: "w" | "h"; maxExtend: number }> = {
  "300x250": { x: 15, y: 15, w: 160, h: 220, pad: 15, axis: "w", maxExtend: 110 },
  "160x600": { x: 10, y: 10, w: 140, h: 290, pad: 15, axis: "h", maxExtend: 290 },
  "728x90": { x: 10, y: 10, w: 415, h: 70, pad: 15, axis: "w", maxExtend: 160 },
  "300x600": { x: 20, y: 20, w: 260, h: 280, pad: 20, axis: "h", maxExtend: 280 },
  "970x250": { x: 20, y: 20, w: 465, h: 210, pad: 20, axis: "w", maxExtend: 465 },
  "320x50": { x: 5, y: 5, w: 190, h: 40, pad: 8, axis: "w", maxExtend: 80 },
}

// Horizontal banners (728x90, 320x50) share one layout, sized off the ad height.
const isBanner = (size: AdSize) => size === "728x90" || size === "320x50"
const bannerBarH = (size: AdSize) => (size === "320x50" ? 6 : 10)

const hexToRgba = (hex: string, alpha: number) => {
  const h = hex.replace("#", "")
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h
  const n = parseInt(full, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

// Bain logo SVG
const BAIN_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 36.45"><g fill="#fff"><path d="M20.55,32.29c0,2.4,1.83,4.15,4.15,4.15s4.14-1.85,4.14-4.15c0-2.47-1.77-4.17-4.14-4.17s-4.15,1.86-4.15,4.17M22.09,32.29c0-1.49,1.06-2.86,2.61-2.86s2.61,1.13,2.61,2.86c0,1.52-1.07,2.83-2.61,2.83s-2.61-1.21-2.61-2.83Z"/><path d="M11.48,32.27c0,2.42,1.72,4.13,4.15,4.13,1.35,0,2.45-.54,3.19-1.56l.04-.06-1.14-.95-.04.08c-.44.79-1.12,1.2-2.05,1.2-1.58,0-2.61-1.24-2.61-2.84s1.14-2.83,2.61-2.83c.88,0,1.66.49,2.04,1.15l.04.07,1.17-.92-.05-.06c-.79-.97-1.95-1.53-3.2-1.53-2.25,0-4.15,1.72-4.15,4.13Z"/><polygon points="69.71 32.91 69.71 36.25 71.21 36.25 71.21 32.91 74.11 28.32 72.46 28.32 70.46 31.5 68.52 28.32 66.82 28.32 69.71 32.91"/><path d="M42.86,28.32v7.93h1.49v-2.95c.1.01.24.02.37.02,1.91,0,3.28-.85,3.28-2.5s-1.14-2.5-3.28-2.5h-1.86ZM44.36,29.51h.37c1.22,0,1.74.47,1.74,1.3s-.56,1.28-1.74,1.28c-.17,0-.27-.01-.37-.02v-2.55Z"/><polygon points="32.87 31.96 35.33 36.45 37.76 31.96 38.75 36.25 40.31 36.25 38.23 28.18 35.35 33.53 32.43 28.18 30.45 36.25 31.92 36.25 32.87 31.96"/><polygon points="69.53 14.67 55.8 1.99 55.8 23.1 59.6 23.1 59.6 10.93 73.32 23.59 73.32 2.35 69.53 2.36 69.53 14.67"/><path d="M42.87,2.36v20.73h3.94V2.36h-3.94Z"/><path d="M37.82,23.09L27.73,1.99l-10.11,21.1h3.97l1.98-4.41h8l1.92,4.41h4.33ZM25.08,15.34l2.64-5.97,2.46,5.97h-5.1Z"/><path d="M10.68,12.04c1.62-.73,2.82-2.31,2.82-4.3,0-3.59-2.84-5.39-7.83-5.38H.69v20.73h5.88c5.31,0,8.11-2.14,8.11-5.96,0-2.53-1.59-4.28-3.99-5.09M6.32,14.3c2.73,0,4.33.67,4.33,2.88,0,1.92-1.46,2.77-4.34,2.79h-1.72v-5.66h1.73ZM4.59,11.14v-5.65h.7c2.88,0,4.3.78,4.3,2.86s-1.45,2.79-4.16,2.79h-.84Z"/><path d="M5.55,36.25h1.52s-1.29-1.46-1.49-1.72c.19-.23,1.37-2.04,1.37-2.04h-1.25s-.8,1.24-.8,1.24l-1.39-1.56c1.1-.56,1.87-1.36,1.87-2.19,0-1.12-1.06-1.84-2.27-1.84-1.37,0-2.35.81-2.35,1.95,0,.81.57,1.46.92,1.86-.84.46-1.67,1.14-1.67,2.3,0,1.24,1.1,2.2,2.56,2.2.87,0,1.68-.38,2.28-1.01l.72.82ZM1.97,30.11c0-.64.5-1.04,1.15-1.04s1.07.4,1.07.96c0,.66-.77,1.09-1.38,1.41-.49-.44-.84-.86-.84-1.33ZM4.14,34.65c-.26.39-.89.72-1.42.72-.9,0-1.44-.52-1.44-1.26,0-.56.53-1.18,1.1-1.45.01,0,.03-.01.04-.02l1.72,2.01Z"/><polygon points="63.59 33.02 58.35 28.18 58.35 36.25 59.8 36.25 59.8 31.59 65.04 36.43 65.04 28.32 63.59 28.32 63.59 33.02"/><path d="M56.42,36.25l-3.86-8.07-3.86,8.07h1.52l.76-1.69h3.06l.73,1.69h1.66ZM51.55,33.28l1.01-2.28.94,2.28h-1.95Z"/><path d="M108.24,18.99l-3.29-14.75-9.17,11.87,12.46,2.88ZM120,18.12c0,10.01-8.12,18.12-18.15,18.12s-18.16-8.11-18.16-18.13S91.82,0,101.85,0c.98,0,1.95.08,2.89.23l-1.55,2c-.43-.04-.86-.06-1.3-.06-8.44,0-15.29,6.68-15.29,14.92s6.85,14.92,15.29,14.92c8.44,0,15.29-6.68,15.29-14.92,0-6.34-4.05-11.75-9.77-13.91l-.55-2.48c7.59,2.17,13.14,9.15,13.14,17.42Z"/></g></svg>`

type CopyFields = { title: string; subtitle: string; ctaText: string }

type ShadowStop = { position: number; opacity: number }  // position 0-100, opacity 0-100
type ShadowDirection = "auto" | "left" | "top" | "right" | "bottom"
type ShadowConfig = { direction: ShadowDirection; stops: ShadowStop[] }

const DEFAULT_SHADOW: ShadowConfig = {
  direction: "auto",
  stops: [
    { position: 0, opacity: 60 },
    { position: 100, opacity: 0 },
  ],
}

type BgAnimationType = "zoom-out" | "zoom-in" | "pan-left" | "pan-right" | "none"

type BgMode = "single" | "multi-layer"
type LayerZoom = "none" | "zoom-in" | "zoom-out"
type LayerConfig = {
  id: string
  src: string
  startOffsetX: number  // pixels offset at animation start (negative = from left, positive = from right)
  startOffsetY: number  // pixels offset at animation start (negative = from top, positive = from bottom)
  zoom: LayerZoom       // zoom direction: zoom-in starts small → grows to 1x, zoom-out starts large → shrinks to 1x
  zoomAmount: number    // scale delta, e.g. 0.2 means ±20% from 1x
  timing: { start: number; end: number }
}

type CopyLayout = "standard" | "eyebrow" | "two-frame"

// Standard layout: redBar, title, subtitle, cta
// Eyebrow layout: eyebrow (with highlight), title, cta
// Two-frame layout: redBar, title (frame 1), title1out, title2 (frame 2), cta
type ElemKeyStandard = "redBar" | "title" | "subtitle" | "cta"
type ElemKeyEyebrow = "eyebrow" | "title" | "cta"
type ElemKeyTwoFrame = "redBar" | "title" | "title1out" | "title2" | "cta"
type ElemKey = ElemKeyStandard | ElemKeyEyebrow | ElemKeyTwoFrame | "bg"
type ElemTiming = { start: number; end: number }  // 0-100 percent of total duration
type SizeTiming = Record<ElemKeyStandard, ElemTiming> & Partial<Record<ElemKeyEyebrow | ElemKeyTwoFrame | "bg", ElemTiming>>

// Defaults are authored in frames @25fps (Bain motion tokens) against the
// layout's default length, then stored as percentages so they scale with it.
const framesToTiming = (total: number, spec: Record<string, [number, number]>): SizeTiming =>
  Object.fromEntries(
    Object.entries(spec).map(([k, [a, b]]) => [k, { start: (a / total) * 100, end: (b / total) * 100 }]),
  ) as SizeTiming

// Expressive mode: red bar draws 21f (standard); text enters 13f (entrance),
// staggered 8f in reading order; background camera move 34f (standard).
const DEFAULT_TIMING: SizeTiming = framesToTiming(125, {
  bg:       [0, 34],
  redBar:   [0, 21],
  eyebrow:  [0, 13],
  title:    [8, 21],
  subtitle: [16, 29],
  cta:      [24, 37],
})

// 10s two-frame: frame 1 holds, fades through (8f exit, then 13f entrance), CTA lands, then holds >= 55f.
const DEFAULT_TIMING_TWO_FRAME: SizeTiming = framesToTiming(250, {
  bg:        [0, 34],
  redBar:    [0, 21],
  title:     [8, 21],
  subtitle:  [16, 29],
  title1out: [100, 108],
  title2:    [108, 121],
  cta:       [129, 142],
})

const DEFAULT_BG_TIMING: ElemTiming = { start: 0, end: 27.2 }

export default function AdsGenerator() {
  const [selectedSize, setSelectedSize] = useState<AdSize>("300x250")
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null)
  const [bgMode, setBgMode] = useState<BgMode>("single")
  const [layers, setLayers] = useState<LayerConfig[]>([])
  const [copyLayout, setCopyLayout] = useState<CopyLayout>("standard")
  const [title, setTitle] = useState("Lorem ipsum sit amet")
  const [subtitle, setSubtitle] = useState("Lorem ipsum dolor amet")
  const [eyebrowText, setEyebrowText] = useState("Event Name")
  const [title2, setTitle2] = useState("Donec augue mauris")
  const [ctaText, setCtaText] = useState("GET THE REPORT")
  const [clickUrl, setClickUrl] = useState("https://www.bain.com")
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(1)
  const [zoom, setZoom] = useState(100)
  const [activeTab, setActiveTab] = useState<"assets" | "copy" | "shadow">("assets")
  const [shadows, setShadows] = useState<Record<AdSize, ShadowConfig>>({
    "300x250": { ...DEFAULT_SHADOW },
    "160x600": { ...DEFAULT_SHADOW },
    "970x250": { ...DEFAULT_SHADOW },
    "728x90":  { ...DEFAULT_SHADOW },
    "320x50":  { ...DEFAULT_SHADOW },
    "300x600": { ...DEFAULT_SHADOW },
  })
  const [bgAnimation, setBgAnimation] = useState<BgAnimationType>("zoom-out")
  const [timingSynced, setTimingSynced] = useState(true)
  const [rightPanelTab, setRightPanelTab] = useState<"elements" | "layers">("elements")
  const [textDirection, setTextDirection] = useState<"from-left" | "from-right" | "from-top" | "from-bottom" | "none">("from-left")
  const [elemTimings, setElemTimings] = useState<Record<AdSize, SizeTiming>>({
    "300x250": { ...DEFAULT_TIMING },
    "160x600": { ...DEFAULT_TIMING },
    "970x250": { ...DEFAULT_TIMING },
    "728x90":  { ...DEFAULT_TIMING },
    "320x50":  { ...DEFAULT_TIMING },
    "300x600": { ...DEFAULT_TIMING },
  })
  // offsetX/offsetY are pixel offsets of the image top-left corner in the crop container (always <= 0)
  const [copyOverrides, setCopyOverrides] = useState<Record<AdSize, { synced: boolean; title: string; subtitle: string; eyebrowText: string; title2: string; ctaText: string }>>({
    "300x250": { synced: true, title: "Lorem ipsum sit amet", subtitle: "Lorem ipsum dolor amet", eyebrowText: "Event Name", title2: "Donec augue mauris", ctaText: "GET THE REPORT" },
    "160x600": { synced: true, title: "Lorem ipsum sit amet", subtitle: "Lorem ipsum dolor amet", eyebrowText: "Event Name", title2: "Donec augue mauris", ctaText: "GET THE REPORT" },
    "970x250": { synced: true, title: "Lorem ipsum sit amet", subtitle: "Lorem ipsum dolor amet", eyebrowText: "Event Name", title2: "Donec augue mauris", ctaText: "GET THE REPORT" },
    "728x90":  { synced: true, title: "Lorem ipsum sit amet", subtitle: "Lorem ipsum dolor amet", eyebrowText: "Event Name", title2: "Donec augue mauris", ctaText: "GET THE REPORT" },
    "320x50":  { synced: true, title: "Lorem ipsum sit amet", subtitle: "Lorem ipsum dolor amet", eyebrowText: "Event Name", title2: "Donec augue mauris", ctaText: "GET THE REPORT" },
    "300x600": { synced: true, title: "Lorem ipsum sit amet", subtitle: "Lorem ipsum dolor amet", eyebrowText: "Event Name", title2: "Donec augue mauris", ctaText: "GET THE REPORT" },
  })

  const [crops, setCrops] = useState<Record<AdSize, { offsetX: number; offsetY: number; scale: number }>>({
    "300x250": { offsetX: 0, offsetY: 0, scale: 1 },
    "160x600": { offsetX: 0, offsetY: 0, scale: 1 },
    "970x250": { offsetX: 0, offsetY: 0, scale: 1 },
    "728x90":  { offsetX: 0, offsetY: 0, scale: 1 },
    "320x50":  { offsetX: 0, offsetY: 0, scale: 1 },
    "300x600": { offsetX: 0, offsetY: 0, scale: 1 },
  })
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [tempCrop, setTempCrop] = useState({ offsetX: 0, offsetY: 0, scale: 1 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, ox: 0.5, oy: 0.5 })
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const progressRef = useRef<number>(1)
  const bgImageRef = useRef<HTMLImageElement | null>(null)
  const logoImageRef = useRef<HTMLImageElement | null>(null)
  const layerImagesRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const drawCanvasRef = useRef<(progress: number) => void>(() => {})
  const restoringProjectRef = useRef(false)
  const projectInputRef = useRef<HTMLInputElement>(null)
  const [projectNotice, setProjectNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null)
  const [duration, setDuration] = useState(5) // seconds
  // Word-by-word reveal is ONE choice so headline and body can never both use it.
  const [wordReveal, setWordReveal] = useState<WordReveal>("none")
  // Wrap width as a percentage of the available text column, per size and element.
  const [wrapWidth, setWrapWidth] = useState<Partial<Record<AdSize, { title: number; subtitle: number }>>>({})
  const [exportQuality, setExportQuality] = useState(0.92)
  const [showExportModal, setShowExportModal] = useState(false)
  // Which sizes the ZIP and GIF exports produce. One list governs both.
  const ALL_SIZES = Object.keys(AD_SIZES) as AdSize[]
  const [exportSizes, setExportSizes] = useState<AdSize[]>(ALL_SIZES)
  const orderedExportSizes = ALL_SIZES.filter((s) => exportSizes.includes(s))
  const exportCountLabel = orderedExportSizes.length === ALL_SIZES.length ? "all sizes" : `${orderedExportSizes.length} ${orderedExportSizes.length === 1 ? "size" : "sizes"}`
  const toggleExportSize = (s: AdSize) =>
    setExportSizes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  const [layoutType, setLayoutType] = useState<"red-bar" | "red-block">("red-bar")
  const [showRedBar, setShowRedBar] = useState(true)
  const [textColor, setTextColor] = useState("#FFFFFF")
  const [ctaColor, setCtaColor] = useState("#FFFFFF")
  const [ctaArrowColor, setCtaArrowColor] = useState("#FFFFFF")
  const [exportReport, setExportReport] = useState<ExportReport[] | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [gifStatus, setGifStatus] = useState<{ busy: boolean; text: string } | null>(null)
  const [gifReport, setGifReport] = useState<GifReportRow[] | null>(null)
  // Per-size red block extension (extra px added to the extendable axis)
  const [redBlockExtend, setRedBlockExtend] = useState<Record<AdSize, number>>({
    "300x250": 0,
    "160x600": 0,
    "970x250": 0,
    "728x90": 0,
    "320x50": 0,
    "300x600": 0,
  })

  // Reset all state to defaults
  const handleReset = () => {
    setBackgroundImage(null)
    setBgMode("single")
    setLayers([])
    setCopyLayout("standard")
    setTitle("Lorem ipsum sit amet")
    setSubtitle("Lorem ipsum dolor amet")
    setEyebrowText("Event Name")
    setTitle2("Donec augue mauris")
    setCtaText("GET THE REPORT")
    setClickUrl("https://www.bain.com")
    setIsPlaying(false)
    setProgress(1)
    setBgAnimation("zoom-out")
    setTimingSynced(true)
    setTextDirection("from-left")
    setShadows({
      "300x250": { ...DEFAULT_SHADOW },
      "160x600": { ...DEFAULT_SHADOW },
      "970x250": { ...DEFAULT_SHADOW },
      "728x90":  { ...DEFAULT_SHADOW },
      "320x50":  { ...DEFAULT_SHADOW },
      "300x600": { ...DEFAULT_SHADOW },
    })
    setElemTimings({
      "300x250": { ...DEFAULT_TIMING },
      "160x600": { ...DEFAULT_TIMING },
      "970x250": { ...DEFAULT_TIMING },
      "728x90":  { ...DEFAULT_TIMING },
      "320x50":  { ...DEFAULT_TIMING },
      "300x600": { ...DEFAULT_TIMING },
    })
    setCopyOverrides({
    "300x250": { synced: true, title: "Lorem ipsum sit amet", subtitle: "Lorem ipsum dolor amet", eyebrowText: "Event Name", title2: "Donec augue mauris", ctaText: "GET THE REPORT" },
    "160x600": { synced: true, title: "Lorem ipsum sit amet", subtitle: "Lorem ipsum dolor amet", eyebrowText: "Event Name", title2: "Donec augue mauris", ctaText: "GET THE REPORT" },
    "970x250": { synced: true, title: "Lorem ipsum sit amet", subtitle: "Lorem ipsum dolor amet", eyebrowText: "Event Name", title2: "Donec augue mauris", ctaText: "GET THE REPORT" },
    "728x90":  { synced: true, title: "Lorem ipsum sit amet", subtitle: "Lorem ipsum dolor amet", eyebrowText: "Event Name", title2: "Donec augue mauris", ctaText: "GET THE REPORT" },
    "320x50":  { synced: true, title: "Lorem ipsum sit amet", subtitle: "Lorem ipsum dolor amet", eyebrowText: "Event Name", title2: "Donec augue mauris", ctaText: "GET THE REPORT" },
    "300x600": { synced: true, title: "Lorem ipsum sit amet", subtitle: "Lorem ipsum dolor amet", eyebrowText: "Event Name", title2: "Donec augue mauris", ctaText: "GET THE REPORT" },
    })
    setCrops({
      "300x250": { offsetX: 0, offsetY: 0, scale: 1 },
      "160x600": { offsetX: 0, offsetY: 0, scale: 1 },
      "970x250": { offsetX: 0, offsetY: 0, scale: 1 },
      "728x90":  { offsetX: 0, offsetY: 0, scale: 1 },
      "320x50":  { offsetX: 0, offsetY: 0, scale: 1 },
      "300x600": { offsetX: 0, offsetY: 0, scale: 1 },
    })
    layerImagesRef.current = new Map()
    setExportQuality(0.92)
    setLayoutType("red-bar")
    setShowRedBar(true)
    setTextColor("#FFFFFF")
    setCtaColor("#FFFFFF")
    setCtaArrowColor("#FFFFFF")
    setDuration(5)
  }

  // Everything that defines the ad. View state (zoom, playhead, open tabs,
  // modals) is deliberately left out — reopening an ad should not reopen a
  // half-dragged crop.
  const projectSnapshot = () => ({
    selectedSize, backgroundImage, bgMode, layers, copyLayout,
    title, subtitle, eyebrowText, title2, ctaText, clickUrl,
    shadows, bgAnimation, timingSynced, textDirection, elemTimings,
    copyOverrides, crops, duration, wordReveal, wrapWidth, exportQuality,
    layoutType, showRedBar, textColor, ctaColor, ctaArrowColor, redBlockExtend,
  })
  type ProjectState = ReturnType<typeof projectSnapshot>

  // GIF export renders with the preview's own drawCanvas, so the GIF is frame-for-frame what the editor shows.
  const handleExportGifs = async () => {
    if (gifStatus?.busy) return
    const startSize = selectedSize
    setIsPlaying(false)
    setGifReport(null)
    const zip = new JSZip()
    const report: GifReportRow[] = []
    const settle = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 30))))
    const sizes = orderedExportSizes
    if (sizes.length === 0) return
    try {
      for (const [n, size] of sizes.entries()) {
        setGifStatus({ busy: true, text: `Rendering ${size} (${n + 1} of ${sizes.length})` })
        setSelectedSize(size)
        const { width: w, height: h } = AD_SIZES[size]
        let canvas = canvasRef.current
        for (let tries = 0; tries < 20 && (!canvas || canvas.width !== w * CANVAS_SCALE || canvas.height !== h * CANVAS_SCALE); tries++) {
          await settle()
          canvas = canvasRef.current
        }
        if (!canvas || canvas.width !== w * CANVAS_SCALE) throw new Error(`The preview did not switch to ${size}`)
        await settle()

        const off = document.createElement("canvas")
        off.width = w
        off.height = h
        const octx = off.getContext("2d", { willReadFrequently: true })!
        octx.imageSmoothingQuality = "high"
        const total = Math.max(2, Math.round(duration * GIF_CAPTURE_FPS) + 1)
        const frames: Uint8ClampedArray[] = []
        for (let i = 0; i < total; i++) {
          drawCanvasRef.current(i / (total - 1))
          octx.clearRect(0, 0, w, h)
          octx.drawImage(canvas, 0, 0, w, h)
          frames.push(octx.getImageData(0, 0, w, h).data)
          if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0))
        }

        setGifStatus({ busy: true, text: `Encoding ${size} (${n + 1} of ${sizes.length})` })
        await new Promise((r) => setTimeout(r, 0))
        const gif = encodeGif(frames, w, h)
        zip.file(`${size}.gif`, gif.bytes)
        report.push({ size, bytes: gif.bytes.length, fps: gif.fps, colors: gif.colors })
      }
      const blob = await zip.generateAsync({ type: "blob" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = "ads-gif.zip"
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
      setGifReport(report)
      setGifStatus(null)
    } catch (err) {
      setGifStatus({ busy: false, text: `GIF export failed: ${err instanceof Error ? err.message : String(err)}` })
    } finally {
      setSelectedSize(startSize)
    }
  }

  const handleSaveProject = () => {
    const bytes = downloadProject(projectSnapshot(), projectFileName(title))
    setProjectNotice({ tone: "ok", text: `Saved ${(bytes / 1024).toFixed(0)} KB project file` })
  }

  const handleOpenProject = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const parsed = parseProject<ProjectState>(await file.text())
    if (!parsed.ok) {
      setProjectNotice({ tone: "error", text: parsed.reason })
      return
    }
    const s = parsed.state
    setIsPlaying(false)
    // Only skip the layout-driven timing reset when the layout really changes,
    // otherwise the effect never runs and the flag would swallow the next edit.
    if (s.copyLayout !== undefined && s.copyLayout !== copyLayout) restoringProjectRef.current = true
    layerImagesRef.current = new Map()
    if (s.selectedSize !== undefined) setSelectedSize(s.selectedSize)
    if (s.backgroundImage !== undefined) setBackgroundImage(s.backgroundImage)
    if (s.bgMode !== undefined) setBgMode(s.bgMode)
    if (s.layers !== undefined) setLayers(s.layers)
    if (s.copyLayout !== undefined) setCopyLayout(s.copyLayout)
    if (s.title !== undefined) setTitle(s.title)
    if (s.subtitle !== undefined) setSubtitle(s.subtitle)
    if (s.eyebrowText !== undefined) setEyebrowText(s.eyebrowText)
    if (s.title2 !== undefined) setTitle2(s.title2)
    if (s.ctaText !== undefined) setCtaText(s.ctaText)
    if (s.clickUrl !== undefined) setClickUrl(s.clickUrl)
    if (s.shadows !== undefined) setShadows(s.shadows)
    if (s.bgAnimation !== undefined) setBgAnimation(s.bgAnimation)
    if (s.timingSynced !== undefined) setTimingSynced(s.timingSynced)
    if (s.textDirection !== undefined) setTextDirection(s.textDirection)
    if (s.elemTimings !== undefined) setElemTimings(s.elemTimings)
    if (s.copyOverrides !== undefined) setCopyOverrides(s.copyOverrides)
    if (s.crops !== undefined) setCrops(s.crops)
    if (s.duration !== undefined) setDuration(s.duration)
    if (s.wordReveal !== undefined) setWordReveal(s.wordReveal)
    if (s.wrapWidth !== undefined) setWrapWidth(s.wrapWidth)
    if (s.exportQuality !== undefined) setExportQuality(s.exportQuality)
    if (s.layoutType !== undefined) setLayoutType(s.layoutType)
    if (s.showRedBar !== undefined) setShowRedBar(s.showRedBar)
    if (s.textColor !== undefined) setTextColor(s.textColor)
    if (s.ctaColor !== undefined) setCtaColor(s.ctaColor)
    if (s.ctaArrowColor !== undefined) setCtaArrowColor(s.ctaArrowColor)
    if (s.redBlockExtend !== undefined) setRedBlockExtend(s.redBlockExtend)
    setProgress(1)
    progressRef.current = 1
    const when = parsed.savedAt ? new Date(parsed.savedAt).toLocaleString() : null
    setProjectNotice({ tone: "ok", text: when ? `Opened project saved ${when}` : "Opened project" })
  }

  const { width, height } = AD_SIZES[selectedSize]

  // Effective copy for the currently selected size
  const effectiveCopy = (size: AdSize) => {
    const ov = copyOverrides[size]
    if (ov.synced) return { title, subtitle, eyebrowText, title2, ctaText }
    return { title: ov.title, subtitle: ov.subtitle, eyebrowText: ov.eyebrowText, title2: ov.title2, ctaText: ov.ctaText }
  }
  const { title: activeTitle, subtitle: activeSubtitle, eyebrowText: activeEyebrow, title2: activeTitle2, ctaText: activeCtaText } = effectiveCopy(selectedSize)

  // Preload background image
  useEffect(() => {
    if (backgroundImage) {
      const img = new window.Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        bgImageRef.current = img
        drawCanvas(progress)
      }
      img.src = backgroundImage
    } else {
      bgImageRef.current = null
    }
  }, [backgroundImage])

  // Preload logo
  useEffect(() => {
    const logoImg = new window.Image()
    logoImg.onload = () => {
      logoImageRef.current = logoImg
      drawCanvasRef.current(progressRef.current)
    }
    logoImg.src = `data:image/svg+xml,${encodeURIComponent(BAIN_LOGO)}`
  }, [])

  // Update element timing defaults when copy layout changes. Opening a saved
  // project sets the layout too, and would otherwise wipe the timings it just
  // restored, so that one change is skipped.
  useEffect(() => {
    if (restoringProjectRef.current) {
      restoringProjectRef.current = false
      return
    }
    const timingDefaults = copyLayout === "two-frame" ? DEFAULT_TIMING_TWO_FRAME : DEFAULT_TIMING
    setElemTimings({
      "300x250": { ...timingDefaults },
      "160x600": { ...timingDefaults },
      "970x250": { ...timingDefaults },
      "728x90":  { ...timingDefaults },
      "320x50":  { ...timingDefaults },
      "300x600": { ...timingDefaults },
    })
  }, [copyLayout])

  // Preload layer images when layers change
  useEffect(() => {
    layers.forEach(layer => {
      if (!layerImagesRef.current.has(layer.id)) {
        const img = new window.Image()
        img.onload = () => {
          layerImagesRef.current.set(layer.id, img)
          drawCanvasRef.current(progressRef.current)
        }
        img.src = layer.src
      }
    })
    // Clean up removed layers
    const layerIds = new Set(layers.map(l => l.id))
    layerImagesRef.current.forEach((_, id) => {
      if (!layerIds.has(id)) layerImagesRef.current.delete(id)
    })
  }, [layers])

  // Handle file upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setBackgroundImage(event.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // Draw canvas - synchronous for smooth animation
  const drawCanvas = useCallback((animProgress: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Drawn in ad pixels on a ${CANVAS_SCALE}x backing store so motion moves in sub-pixel steps.
    ctx.setTransform(CANVAS_SCALE, 0, 0, CANVAS_SCALE, 0, 0)
    ctx.clearRect(0, 0, width, height)

    // Draw background: single image or multi-layer parallax
    if (bgMode === "multi-layer" && layers.length > 0) {
      // Multi-layer parallax rendering
      const crop = crops[selectedSize]

      // Modal reference dimensions - must match the modal's dynamic sizing
      const adAspect = AD_SIZES[selectedSize].width / AD_SIZES[selectedSize].height
      let modalH = 400
      let modalW = modalH * adAspect
      const maxWidth = 740
      if (modalW > maxWidth) {
        modalH = maxWidth / adAspect
        modalW = maxWidth
      }

      // Draw layers from bottom to top (first in array = bottom layer)
      layers.forEach(layer => {
        const img = layerImagesRef.current.get(layer.id)
        if (!img) return

        const fitScale = Math.min(modalW / img.naturalWidth, modalH / img.naturalHeight)
        const baseW = img.naturalWidth * fitScale
        const baseH = img.naturalHeight * fitScale
        const displayW = baseW * crop.scale
        const displayH = baseH * crop.scale

        const srcX = (-crop.offsetX / displayW) * img.naturalWidth
        const srcY = (-crop.offsetY / displayH) * img.naturalHeight
        const srcW = (modalW / displayW) * img.naturalWidth
        const srcH = (modalH / displayH) * img.naturalHeight

        // Layer animation: interpolate from start offset to (0,0) with optional zoom
        const layerDelay = layer.timing.start / 100
        const layerDuration = Math.max(0.01, (layer.timing.end - layer.timing.start) / 100)
        const layerProgress = easeStandard(Math.max(0, Math.min(1, (animProgress - layerDelay) / layerDuration)))

        // X/Y translation: interpolates from startOffset → 0
        const scaleRatio = width / modalW
        const offsetX = layer.startOffsetX * scaleRatio * (1 - layerProgress)
        const offsetY = layer.startOffsetY * scaleRatio * (1 - layerProgress)

        // Zoom: start scale → 1.0 (zoom-in: starts small, zoom-out: starts large)
        let drawScale = 1
        if (layer.zoom === "zoom-in") {
          const startScale = 1 - layer.zoomAmount
          drawScale = startScale + (1 - startScale) * layerProgress
        } else if (layer.zoom === "zoom-out") {
          const startScale = 1 + layer.zoomAmount
          drawScale = startScale - (startScale - 1) * layerProgress
        }

        // Apply scale from centre of canvas
        ctx.save()
        ctx.translate(width / 2 + offsetX, height / 2 + offsetY)
        ctx.scale(drawScale, drawScale)
        ctx.drawImage(img, srcX, srcY, srcW, srcH, -width / 2, -height / 2, width, height)
        ctx.restore()
      })
    } else if (bgImageRef.current) {
      const img = bgImageRef.current
      const crop = crops[selectedSize]

      // Modal reference dimensions - must match the modal's dynamic sizing
      const adAspect = AD_SIZES[selectedSize].width / AD_SIZES[selectedSize].height
      let modalH = 400
      let modalW = modalH * adAspect
      
      // Same constraint as modal: if too wide, scale down to fit
      const maxWidth = 740
      if (modalW > maxWidth) {
        modalH = maxWidth / adAspect
        modalW = maxWidth
      }

      // FIT scale: at user scale=1, the image fits in the modal container
      const fitScale = Math.min(modalW / img.naturalWidth, modalH / img.naturalHeight)
      
      // Base size at scale=1 (image fits in modal, maintains aspect ratio)
      const baseW = img.naturalWidth * fitScale
      const baseH = img.naturalHeight * fitScale

      // Display size with user zoom (CSS scale applied to baseW/baseH)
      const displayW = baseW * crop.scale
      const displayH = baseH * crop.scale

      // Image is positioned at (offsetX, offsetY) and scaled from top-left.
      // Visible region in modal = (0,0) to (modalW, modalH)
      // Image top-left = (offsetX, offsetY), size = displayW x displayH
      // Visible region relative to image = (-offsetX, -offsetY)
      // Convert to source pixels: multiply by (naturalSize / displaySize)
      const srcX = (-crop.offsetX / displayW) * img.naturalWidth
      const srcY = (-crop.offsetY / displayH) * img.naturalHeight
      const srcW = (modalW / displayW) * img.naturalWidth
      const srcH = (modalH / displayH) * img.naturalHeight

      // Background animation based on selected type (camera move: standard curve)
      const bgT = elemTimings[selectedSize].bg || DEFAULT_BG_TIMING
      const bgP = easeStandard(Math.max(0, Math.min(1, (animProgress - bgT.start / 100) / Math.max(0.01, (bgT.end - bgT.start) / 100))))
      let animSx = srcX
      let animSy = srcY
      let animSrcW = srcW
      let animSrcH = srcH

      if (bgAnimation === "zoom-out") {
        // Start zoomed in (1.27x), zoom out to 1x
        const animScale = 1.27 - 0.27 * bgP
        animSrcW = srcW / animScale
        animSrcH = srcH / animScale
        animSx = srcX + (srcW - animSrcW) * 0.5
        animSy = srcY + (srcH - animSrcH) * 0.5
      } else if (bgAnimation === "zoom-in") {
        // Start at 1x, zoom in to 1.27x
        const animScale = 1 + 0.27 * bgP
        animSrcW = srcW / animScale
        animSrcH = srcH / animScale
        animSx = srcX + (srcW - animSrcW) * 0.5
        animSy = srcY + (srcH - animSrcH) * 0.5
      } else if (bgAnimation === "pan-left") {
        // Pan from right to left (source moves right over time)
        const panAmount = srcW * 0.15 // 15% of source width
        animSx = srcX - panAmount * 0.5 + panAmount * bgP
      } else if (bgAnimation === "pan-right") {
        // Pan from left to right (source moves left over time)
        const panAmount = srcW * 0.15 // 15% of source width
        animSx = srcX + panAmount * 0.5 - panAmount * bgP
      }
      // "none" uses the original srcX, srcY, srcW, srcH (no animation)

      ctx.save()
      ctx.drawImage(img, animSx, animSy, animSrcW, animSrcH, 0, 0, width, height)
      ctx.restore()
    } else {
      // Default gradient background
      const gradient = ctx.createLinearGradient(0, 0, width, height)
      gradient.addColorStop(0, "#2d1f3d")
      gradient.addColorStop(1, "#1a1a2e")
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)
    }
    
    // Draw overlay elements
    drawOverlay(ctx, animProgress)
  }, [width, height, activeTitle, activeSubtitle, activeEyebrow, activeTitle2, activeCtaText, crops, selectedSize, copyOverrides, shadows, bgAnimation, elemTimings, copyLayout, bgMode, layers, textDirection, layoutType, redBlockExtend, showRedBar, textColor, ctaColor, ctaArrowColor, wordReveal, wrapWidth, duration])

  const drawOverlay = useCallback((ctx: CanvasRenderingContext2D, animProgress: number) => {
    const padding = AD_PADDING[selectedSize]
    
    // Shadow overlay gradient - driven by shadow config
    const shadow = shadows[selectedSize]
    const resolvedDirection: Exclude<ShadowDirection, "auto"> = shadow.direction === "auto"
      ? (selectedSize === "300x250" || selectedSize === "970x250" || isBanner(selectedSize) ? "left" : "top")
      : shadow.direction

    let shadowGradient: CanvasGradient
    if (resolvedDirection === "left")        shadowGradient = ctx.createLinearGradient(0, 0, width, 0)
    else if (resolvedDirection === "right")  shadowGradient = ctx.createLinearGradient(width, 0, 0, 0)
    else if (resolvedDirection === "bottom") shadowGradient = ctx.createLinearGradient(0, height, 0, 0)
    else                                     shadowGradient = ctx.createLinearGradient(0, 0, 0, height) // top

    const sortedStops = [...shadow.stops].sort((a, b) => a.position - b.position)
    sortedStops.forEach(stop => {
      shadowGradient.addColorStop(stop.position / 100, `rgba(0,0,0,${(stop.opacity / 100).toFixed(2)})`)
    })
    ctx.fillStyle = shadowGradient
    ctx.fillRect(0, 0, width, height)

    // Element timing
    const t = elemTimings[selectedSize]

    // Text slide-in direction helper: returns [dx, dy] offset based on progress (0=start, 1=final)
    // The slide distance scales with canvas size for a consistent feel across formats.
    const slideMax = TEXT_SLIDE_PX
    const textSlide = (progress: number): [number, number] => {
      const remaining = 1 - progress
      if (textDirection === "from-left")   return [-slideMax * remaining, 0]
      if (textDirection === "from-right")  return [slideMax * remaining, 0]
      if (textDirection === "from-top")    return [0, -slideMax * remaining]
      if (textDirection === "from-bottom") return [0, slideMax * remaining]
      return [0, 0]
    }

    // Red bar animation (always rendered for both layouts)
    const redBarWidth = isBanner(selectedSize) ? bannerBarH(selectedSize) : selectedSize === "970x250" ? 20 : Math.min(12, height * 0.05)
    const redBarHeight = isBanner(selectedSize) ? bannerBarH(selectedSize) : Math.min(12, height * 0.05)

    // Red Block geometry per ad size, applying the user's extension on the extendable axis.
    const redBlockGeo: Record<string, { x: number; y: number; w: number; h: number; pad: number }> = (() => {
      const out: Record<string, { x: number; y: number; w: number; h: number; pad: number }> = {}
      ;(Object.keys(RED_BLOCK_BASE) as AdSize[]).forEach((size) => {
        const base = RED_BLOCK_BASE[size]
        const ext = Math.max(0, Math.min(base.maxExtend, redBlockExtend[size] || 0))
        out[size] = {
          x: base.x,
          y: base.y,
          w: base.axis === "w" ? base.w + ext : base.w,
          h: base.axis === "h" ? base.h + ext : base.h,
          pad: base.pad,
        }
      })
      return out
    })()

    // Red graphic element animation (different for Red Bar vs Red Block layouts)
    if (!showRedBar) {
      // Red bar / block removed by the user
    } else if (layoutType === "red-bar") {
      const redBarTimingKey = copyLayout === "standard" ? "redBar" : "eyebrow"
      const redBarTiming = t[redBarTimingKey] || t.redBar
      const redBarDelay = redBarTiming.start / 100
      const redBarDuration = Math.max(0.01, (redBarTiming.end - redBarTiming.start) / 100)
      const redBarProgress = easeStandard(Math.max(0, Math.min(1, (animProgress - redBarDelay) / redBarDuration)))

      if (selectedSize === "970x250") {
        const redBarH = height * redBarProgress
        ctx.fillStyle = "#CC0000"
        ctx.fillRect(width - redBarWidth, height - redBarH, redBarWidth, redBarH)
      } else {
        const redBarH = isBanner(selectedSize) ? bannerBarH(selectedSize) : selectedSize === "300x600" ? 20 : Math.min(12, height * 0.05)
        const rBarWidth = width * redBarProgress
        ctx.fillStyle = "#CC0000"
        ctx.fillRect(0, height - redBarH, rBarWidth, redBarH)
      }
    } else {
      // Red Block layout - wipe in animation with easeInOutCubic
      const redBlockTiming = t.redBar || { start: 0, end: 35 }
      const redBlockDelay = redBlockTiming.start / 100
      const redBlockDuration = Math.max(0.01, (redBlockTiming.end - redBlockTiming.start) / 100)
      const redBlockProgress = easeStandard(Math.max(0, Math.min(1, (animProgress - redBlockDelay) / redBlockDuration)))

      ctx.fillStyle = "#CC0000"

      const geo = redBlockGeo[selectedSize]
      if (geo) {
        if (isBanner(selectedSize)) {
          // Horizontal block wipes right
          ctx.fillRect(geo.x, geo.y, geo.w * redBlockProgress, geo.h)
        } else {
          // Vertical / side block wipes down
          ctx.fillRect(geo.x, geo.y, geo.w, geo.h * redBlockProgress)
        }
      }
    }

    // ============= TEXT AND COPY RENDERING =============
    // Shared progress + helpers used by BOTH red-bar and red-block layouts
    const eyebrowTiming = t.eyebrow || { start: 0, end: 12 }
    const eyebrowProgress = easeEntrance(Math.max(0, Math.min(1, (animProgress - eyebrowTiming.start / 100) / Math.max(0.01, (eyebrowTiming.end - eyebrowTiming.start) / 100))))
    const titleProgress = wordReveal === "title" ? 1 : easeEntrance(Math.max(0, Math.min(1, (animProgress - t.title.start / 100) / Math.max(0.01, (t.title.end - t.title.start) / 100))))
    const subtitleProgress = wordReveal === "subtitle" ? 1 : easeEntrance(Math.max(0, Math.min(1, (animProgress - t.subtitle.start / 100) / Math.max(0.01, (t.subtitle.end - t.subtitle.start) / 100))))
    const eyebrowWipe = easeStandard(Math.max(0, Math.min(1, (animProgress - eyebrowTiming.start / 100) / Math.max(0.01, (eyebrowTiming.end - eyebrowTiming.start) / 100))))
    const txt = (a: number) => hexToRgba(textColor, a)
    const ctaTxt = (a: number) => hexToRgba(ctaColor, a)
    const ctaProgress = easeEntrance(Math.max(0, Math.min(1, (animProgress - t.cta.start / 100) / Math.max(0.01, (t.cta.end - t.cta.start) / 100))))

    // Helper: draw right-pointing triangle after text
    const drawTriangle = (x: number, y: number, size: number, alpha: number) => {
      const h = size
      const w = size * 0.8
      ctx.fillStyle = hexToRgba(ctaArrowColor, alpha)
      ctx.beginPath()
      ctx.moveTo(x, y - h / 2)
      ctx.lineTo(x + w, y)
      ctx.lineTo(x, y + h / 2)
      ctx.closePath()
      ctx.fill()
    }

    // Helper: wrap text to max width, returns array of lines
    // Enter in a copy field forces a break; the wrap-width slider narrows the column.
    const sizeWrap = wrapWidth[selectedSize] || { title: 100, subtitle: 100 }
    const wrapText = (text: string, maxWidth: number, key: "title" | "subtitle" = "title"): string[] => {
      const limit = maxWidth * (sizeWrap[key] / 100)
      const lines: string[] = []
      for (const paragraph of text.split("\n")) {
        const words = paragraph.split(" ").filter(Boolean)
        let current = ""
        for (const word of words) {
          const test = current ? current + " " + word : word
          if (breakWidth(ctx, test) > limit && current) {
            lines.push(current)
            current = word
          } else {
            current = test
          }
        }
        lines.push(current)
      }
      return lines
    }

    // Draws one line of headline/body copy. Under word reveal each word enters on
    // the entrance curve: 13f, 2f apart, dropping 12px from above (motion skill §5).
    const totalFramesNow = duration * FPS
    const frameNow = animProgress * totalFramesNow
    const drawCopyLine = (
      key: "title" | "title2" | "subtitle",
      lines: string[],
      i: number,
      line: string,
      x: number,
      y: number,
      maxW?: number,
    ) => {
      const revealed = wordReveal === (key === "subtitle" ? "subtitle" : "title")
      if (!revealed) {
        if (maxW !== undefined) ctx.fillText(line, x, y, maxW)
        else ctx.fillText(line, x, y)
        return
      }
      const timing = key === "title" ? t.title : key === "title2" ? t.title2 || { start: 55, end: 67 } : t.subtitle
      const startFrame = (timing.start / 100) * totalFramesNow
      let wordIndex = 0
      for (let li = 0; li < i; li++) wordIndex += lines[li].split(" ").filter(Boolean).length
      const space = ctx.measureText(" ").width
      const baseAlpha = ctx.globalAlpha
      let cx = x
      for (const word of line.split(" ").filter(Boolean)) {
        const local = (frameNow - startFrame - wordIndex * WORD_STAGGER_FRAMES) / WORD_ENTRANCE_FRAMES
        const p = easeEntrance(Math.max(0, Math.min(1, local)))
        ctx.globalAlpha = baseAlpha * p
        ctx.fillText(word, cx, y - TEXT_SLIDE_PX * (1 - p))
        cx += ctx.measureText(word).width + space
        wordIndex++
      }
      ctx.globalAlpha = baseAlpha
    }

    if (layoutType === "red-bar") {
      // RED BAR LAYOUT
    ctx.textBaseline = "top"

    if (isBanner(selectedSize)) {
      // --- 728x90: horizontal layout ---
      const logoH = (height - padding * 2) * 0.595
      const logoW = logoH * (120 / 36.45)
      const logoY = (height - logoH) / 2 // Vertically centered on full artboard
      if (logoImageRef.current) {
        ctx.drawImage(logoImageRef.current, padding, logoY, logoW, logoH)
      }

      // Reserve space for CTA on the right before drawing title
      const ctaFontSize = Math.round(height * 0.15)
      ctx.font = `500 ${ctaFontSize}px Graphik, sans-serif`
      const ctaMetrics = ctx.measureText(activeCtaText)
      const triangleGap = ctaFontSize * 0.4
      const triangleSize = ctaFontSize * 0.70875
      const ctaBlockW = ctaMetrics.width + triangleGap + triangleSize + padding

      const textX = padding + logoW + padding
      const maxTextWidth = width - textX - ctaBlockW - padding

      // Two-frame progress (computed once for 728x90)
      const title1OutTiming728 = t.title1out || { start: 40, end: 52 }
      const title2Timing728 = t.title2 || { start: 55, end: 67 }
      const title1OutDelay728 = title1OutTiming728.start / 100
      const title1OutDuration728 = Math.max(0.01, (title1OutTiming728.end - title1OutTiming728.start) / 100)
      const title1OutProgress728 = easeExit(Math.max(0, Math.min(1, (animProgress - title1OutDelay728) / title1OutDuration728)))
      const title2Delay728 = title2Timing728.start / 100
      const title2Duration728 = Math.max(0.01, (title2Timing728.end - title2Timing728.start) / 100)
      const title2Progress728 = wordReveal === "title" ? 1 : easeEntrance(Math.max(0, Math.min(1, (animProgress - title2Delay728) / title2Duration728)))
      const frame1Alpha728 = titleProgress * (1 - title1OutProgress728)
      const frame2Alpha728 = title2Progress728

      if (copyLayout === "two-frame") {
        // --- 728x90 TWO-FRAME LAYOUT ---
        const titleSize = Math.round(height * 0.26)

        // Vertically center a single line of text above the red bar
        const availableH = height - redBarHeight
        const textY = (availableH - titleSize) / 2

        ctx.font = `600 ${titleSize}px Graphik, sans-serif`

        // Frame 1 title — left-aligned at textX, vertically centered
        ctx.fillStyle = txt(frame1Alpha728)
        const [t1dx728, t1dy728] = textSlide(titleProgress)
        drawCopyLine("title", [activeTitle], 0, activeTitle, textX + t1dx728, textY + t1dy728)

        // Frame 2 title — same position
        ctx.fillStyle = txt(frame2Alpha728)
        const [t2dx728, t2dy728] = textSlide(title2Progress728)
        drawCopyLine("title2", [activeTitle2], 0, activeTitle2, textX + t2dx728, textY + t2dy728)

      } else if (copyLayout === "eyebrow") {
        // --- 728x90 EYEBROW LAYOUT ---
        const titleSize = Math.round(height * 0.26)
        const eyebrowSize = Math.round(height * 0.18)
        const eyebrowPadH = eyebrowSize * 0.2
        const eyebrowPadV = eyebrowSize * 0.1
        const eyebrowBlockH = eyebrowSize + eyebrowPadV * 2

        // Anchor: title vertically centered in available height, eyebrow sits above it
        const availableH = height - redBarHeight - padding * 2
        const totalH = eyebrowBlockH + 4 + titleSize   // gap=4 between eyebrow bottom and title top
        const blockTop = padding + (availableH - totalH) / 2

        const [ebdx728, ebdy728] = textSlide(eyebrowProgress)
        const eyebrowY = blockTop + eyebrowPadV + ebdy728

        // Measure eyebrow with Reckless Neue
        ctx.font = `500 ${eyebrowSize}px "Reckless Neue", serif`
        const eyebrowMetrics = ctx.measureText(activeEyebrow)

        // Red highlight: left edge = textX, text inset by padH inside
        ctx.fillStyle = "#CC0000"
        ctx.fillRect(textX, blockTop, (eyebrowMetrics.width + eyebrowPadH * 2) * eyebrowWipe, eyebrowBlockH)

        ctx.fillStyle = txt(eyebrowProgress)
        ctx.fillText(activeEyebrow, textX + eyebrowPadH + ebdx728, eyebrowY)

        // Title sits 6px below the eyebrow rect (+2px more than before per request)
        const [tdx728, tdy728] = textSlide(titleProgress)
        const titleY = blockTop + eyebrowBlockH + 6 + tdy728
        ctx.font = `600 ${titleSize}px Graphik, sans-serif`
        ctx.fillStyle = txt(titleProgress)
        const titleLines = wrapText(activeTitle, maxTextWidth)
        titleLines.forEach((line, i) => drawCopyLine("title", titleLines, i, line, textX + tdx728, titleY + i * (titleSize + 2)))
      } else {
        // --- 728x90 STANDARD LAYOUT ---
        // Title with wrap
        const titleSize = Math.round(height * 0.26)
        ctx.font = `600 ${titleSize}px Graphik, sans-serif`
        ctx.fillStyle = txt(titleProgress)
        const [stdTdx, stdTdy] = textSlide(titleProgress)
        const titleY = padding + stdTdy
        const titleLines = wrapText(activeTitle, maxTextWidth)
        titleLines.forEach((line, i) => drawCopyLine("title", titleLines, i, line, textX + stdTdx, titleY + i * (titleSize + 2)))
        const titleBottom = titleY + titleLines.length * (titleSize + 2)

        // Subtitle with wrap
        const subtitleSize = Math.round(height * 0.21)
        ctx.font = `500 ${subtitleSize}px "Reckless Neue", serif`
        ctx.fillStyle = txt(subtitleProgress)
        const [stdSdx, stdSdy] = textSlide(subtitleProgress)
        const subtitleY = titleBottom + 4 + stdSdy
        const subtitleLines = wrapText(activeSubtitle, maxTextWidth, "subtitle")
        subtitleLines.forEach((line, i) => drawCopyLine("subtitle", subtitleLines, i, line, textX + stdSdx, subtitleY + i * (subtitleSize + 2)))
      }

      // CTA on far right, vertically centered
      ctx.font = `500 ${ctaFontSize}px Graphik, sans-serif`
      ctx.fillStyle = ctaTxt(ctaProgress)
      const totalCtaW = ctaMetrics.width + triangleGap + triangleSize
      const ctaX = width - padding - totalCtaW
      const [cta728dx, cta728dy] = textSlide(ctaProgress)
      const ctaY = (height - redBarHeight) / 2 - ctaFontSize / 2 + cta728dy
      ctx.fillText(activeCtaText, ctaX + cta728dx, ctaY)
      drawTriangle(ctaX + cta728dx + ctaMetrics.width + triangleGap, ctaY + ctaFontSize * 0.5, triangleSize, ctaProgress)
    } else {
      // --- All other sizes: vertical stacked layout (Red Bar) ---
      // Tall vertical sizes (300x600, 160x600) use full width; others wrap at 2/3 by default
      const fullWidthCopy = selectedSize === "300x600" || selectedSize === "160x600"
      const maxTextWidth = fullWidthCopy ? width - padding * 2 : (width - padding * 2) * (2 / 3)

      // Logo sizing per format
      let logoHeight: number
      if (selectedSize === "160x600" || selectedSize === "300x600") {
        // Tall formats: increase logo by 50%
        logoHeight = Math.min(36, height * 0.15)
      } else if (selectedSize === "970x250") {
        // 970x250: increase by 50%
        logoHeight = Math.min(36, height * 0.15)
      } else if (selectedSize === "300x250") {
        // 300x250: increase by 20%
        logoHeight = Math.min(28.8, height * 0.12)
      } else {
        // 300x250: keep standard
        logoHeight = Math.min(24, height * 0.1)
      }
      
      const logoWidth = logoHeight * (120 / 36.45)
      if (logoImageRef.current) {
        ctx.drawImage(logoImageRef.current, padding, padding, logoWidth, logoHeight)
      }

      // Determine if this is a tall vertical format (160x600 or 300x600)
      const isTallFormat = selectedSize === "160x600" || selectedSize === "300x600"
      
      // Title sizing per format
      let titleSize: number
      if (selectedSize === "160x600") {
        titleSize = Math.max(18, Math.min(32, width * 0.09))
      } else if (selectedSize === "300x600") {
        titleSize = Math.max(20, Math.min(36, width * 0.11))
      } else if (selectedSize === "970x250") {
        titleSize = Math.max(18, Math.min(32, width * 0.09))
      } else {
        titleSize = Math.max(16, Math.min(28, width * 0.08))
      }

      // For 970x250 text must not overlap right-side red bar
      const titleMaxWidth = selectedSize === "970x250" ? (width - padding * 2 - redBarWidth - padding) * (2 / 3) : maxTextWidth

      // Two-frame progress values (computed once for use in all branches)
      const title1OutTiming = t.title1out || { start: 40, end: 52 }
      const title2Timing = t.title2 || { start: 55, end: 67 }
      const title1OutDelay = title1OutTiming.start / 100
      const title1OutDuration = Math.max(0.01, (title1OutTiming.end - title1OutTiming.start) / 100)
      const title1OutProgress = easeExit(Math.max(0, Math.min(1, (animProgress - title1OutDelay) / title1OutDuration)))
      const title2Delay = title2Timing.start / 100
      const title2Duration = Math.max(0.01, (title2Timing.end - title2Timing.start) / 100)
      const title2Progress = wordReveal === "title" ? 1 : easeEntrance(Math.max(0, Math.min(1, (animProgress - title2Delay) / title2Duration)))
      const frame1Alpha = titleProgress * (1 - title1OutProgress)
      const frame2Alpha = title2Progress

      // Different rendering based on copy layout
      if (copyLayout === "two-frame") {
        // --- TWO-FRAME LAYOUT ---
        // Compute positioning (same as standard, but reuse titleStartY)
        const logoBottom = padding + logoHeight
        let logoToFrame1Gap: number
        if (selectedSize === "970x250")      logoToFrame1Gap = 30
        else if (selectedSize === "160x600") logoToFrame1Gap = 50
        else if (selectedSize === "300x600") logoToFrame1Gap = 45
        else                                 logoToFrame1Gap = 20   // 300x250
        const frame1Y = logoBottom + logoToFrame1Gap

        // CTA sizing per format
        let ctaSize: number
        if (selectedSize === "160x600") {
          ctaSize = Math.max(12, Math.min(16.8, width * 0.048))
        } else if (selectedSize === "300x600") {
          ctaSize = Math.max(13, Math.min(18.2, width * 0.052))
        } else if (selectedSize === "970x250") {
          ctaSize = Math.max(12, Math.min(16.8, width * 0.018))
        } else {
          ctaSize = Math.max(10, Math.min(14, width * 0.04))
        }

        // Frame 1 title (fades in then out)
        ctx.font = `600 ${titleSize}px Graphik, sans-serif`
        ctx.fillStyle = txt(frame1Alpha)
        const frame1Lines = wrapText(activeTitle, titleMaxWidth)
        const [f1dx, f1dy] = textSlide(titleProgress)
        const frame1Y_anim = frame1Y + f1dy
        frame1Lines.forEach((line, i) => drawCopyLine("title", frame1Lines, i, line, padding + f1dx, frame1Y_anim + i * (titleSize + 4)))

        // Frame 2 title (fades in, positioned at same location as frame 1)
        ctx.fillStyle = txt(frame2Alpha)
        const frame2Lines = wrapText(activeTitle2, titleMaxWidth)
        const [f2dx, f2dy] = textSlide(title2Progress)
        frame2Lines.forEach((line, i) => drawCopyLine("title2", frame2Lines, i, line, padding + f2dx, frame1Y + f2dy + i * (titleSize + 4)))
        const titlesBottom = frame1Y_anim + Math.max(frame1Lines.length, frame2Lines.length) * (titleSize + 4)

        // CTA
        ctx.font = `500 ${ctaSize}px Graphik, sans-serif`
        ctx.fillStyle = ctaTxt(ctaProgress)
        const [ctadx, ctady] = textSlide(ctaProgress)

        let ctaY: number
        if (selectedSize === "160x600") {
          ctaY = titlesBottom + 12 + ctady
        } else if (selectedSize === "300x600") {
          ctaY = titlesBottom + 12 + ctady
        } else if (selectedSize === "970x250") {
          ctaY = height - padding - ctaSize + ctady
        } else {
          ctaY = height - redBarHeight - padding + ctady
        }

        ctx.fillText(activeCtaText, padding + ctadx, ctaY)
        const ctaMetrics = ctx.measureText(activeCtaText)
        const triangleSize =
          selectedSize === "300x250" || selectedSize === "160x600" ? ctaSize * 0.70875 : ctaSize * 0.675
        drawTriangle(
          padding + ctadx + ctaMetrics.width + ctaSize * 0.4,
          ctaY + ctaSize * 0.5,
          triangleSize,
          ctaProgress
        )

      } else if (copyLayout === "eyebrow") {
        // --- EYEBROW LAYOUT ---
        // Eyebrow font: same serif as subtitle (Reckless Neue)
        // Proportions: 300x250 title~24→eyebrow~17, 160x600 same ratio, 970x250 title~30→eyebrow~20
        let eyebrowFontSize: number
        if (selectedSize === "970x250") {
          eyebrowFontSize = titleSize * (20 / 30)   // ratio 20:30
        } else {
          eyebrowFontSize = titleSize * (14 / 20)   // ratio 14:20
        }

        ctx.font = `500 ${eyebrowFontSize}px "Reckless Neue", serif`
        const eyebrowPadH = eyebrowFontSize * 0.25
        const eyebrowPadV = eyebrowFontSize * 0.15

        // Vertical position - eyebrow sits above title; derive titleStartY first
        const logoBottom = padding + logoHeight
        let logoToEyebrowGap: number
        if (selectedSize === "970x250")      logoToEyebrowGap = 30
        else if (selectedSize === "160x600") logoToEyebrowGap = 50
        else if (selectedSize === "300x600") logoToEyebrowGap = 45
        else                                 logoToEyebrowGap = 20   // 300x250

        // titleStartY = where title baseline begins; eyebrow block sits above it
        const eyebrowBlockH2 = eyebrowFontSize + eyebrowPadV * 2
        const eyebrowTitleGap2 = selectedSize === "970x250" ? 3 : 5
        let titleStartY: number
        titleStartY = logoBottom + logoToEyebrowGap + eyebrowBlockH2 + eyebrowTitleGap2

        // eyebrow sits above titleStartY
        const eyebrowBlockH = eyebrowBlockH2
        const [ebdx, ebdy] = textSlide(eyebrowProgress)
        const eyebrowY = titleStartY - eyebrowBlockH - eyebrowTitleGap2 + ebdy

        // Red highlight background — left-aligned with the title (padding), not offset left by padH
        ctx.fillStyle = "#CC0000"
        ctx.fillRect(
          padding + ebdx,
          eyebrowY - eyebrowPadV,
          (ctx.measureText(activeEyebrow).width + eyebrowPadH * 2) * eyebrowWipe,
          eyebrowBlockH
        )

        // Draw eyebrow text — inset by padH inside the rect
        ctx.fillStyle = txt(eyebrowProgress)
        ctx.fillText(activeEyebrow, padding + eyebrowPadH + ebdx, eyebrowY)

        // Title
        ctx.font = `600 ${titleSize}px Graphik, sans-serif`
        ctx.fillStyle = txt(titleProgress)
        const titleLines = wrapText(activeTitle, titleMaxWidth)
        const [tdx, tdy] = textSlide(titleProgress)
        const animatedTitleY = titleStartY + tdy
        titleLines.forEach((line, i) => drawCopyLine("title", titleLines, i, line, padding + tdx, animatedTitleY + i * (titleSize + 4)))
        const titleBottom = animatedTitleY + titleLines.length * (titleSize + 4)

        // CTA
        let ctaSize: number
        if (selectedSize === "160x600") {
          ctaSize = Math.max(12, Math.min(16.8, width * 0.048))
        } else if (selectedSize === "300x600") {
          ctaSize = Math.max(13, Math.min(18.2, width * 0.052))
        } else if (selectedSize === "970x250") {
          ctaSize = Math.max(12, Math.min(16.8, width * 0.018))
        } else {
          ctaSize = Math.max(10, Math.min(14, width * 0.04))
        }

        ctx.font = `500 ${ctaSize}px Graphik, sans-serif`
        ctx.fillStyle = ctaTxt(ctaProgress)
        const [ctadx2, ctady2] = textSlide(ctaProgress)

        let ctaY: number
        if (selectedSize === "970x250") {
          ctaY = height - padding - ctaSize + ctady2
        } else {
          ctaY = titleBottom + 12 + ctady2
        }

        ctx.fillText(activeCtaText, padding + ctadx2, ctaY)
        const ctaMetrics = ctx.measureText(activeCtaText)
        const triangleSize =
          selectedSize === "300x250" || selectedSize === "160x600" ? ctaSize * 0.70875 : ctaSize * 0.675
        drawTriangle(
          padding + ctadx2 + ctaMetrics.width + ctaSize * 0.4,
          ctaY + ctaSize * 0.5,
          triangleSize,
          ctaProgress
        )

      } else {
        // --- STANDARD LAYOUT ---
        ctx.font = `600 ${titleSize}px Graphik, sans-serif`
        ctx.fillStyle = txt(titleProgress)
        const titleLines = wrapText(activeTitle, maxTextWidth)
        
        // For all formats: logo bottom + explicit gap per size
        let titleStartY: number
        const [vstdTdx, vstdTdy] = textSlide(titleProgress)
        {
          const logoBottom = padding + logoHeight
          let gap: number
          if (selectedSize === "970x250")      gap = 30
          else if (selectedSize === "160x600") gap = 50
          else if (selectedSize === "300x600") gap = 45
          else                                 gap = 20   // 300x250
          titleStartY = logoBottom + gap + vstdTdy
        }
        
        titleLines.forEach((line, i) => drawCopyLine("title", titleLines, i, line, padding + vstdTdx, titleStartY + i * (titleSize + 4)))
        const titleBottom = titleStartY + titleLines.length * (titleSize + 4)

        // Subtitle sizing per format
        const subtitleSize = selectedSize === "160x600"
          ? titleSize * 0.9
          : titleSize * 0.85
        
        ctx.font = `500 ${subtitleSize}px "Reckless Neue", serif`
        ctx.fillStyle = txt(subtitleProgress)
        const [vstdSdx, vstdSdy] = textSlide(subtitleProgress)
        
        let subtitleY: number
        subtitleY = titleBottom + 6 + vstdSdy
        
        const subtitleLines = wrapText(activeSubtitle, titleMaxWidth, "subtitle")
        subtitleLines.forEach((line, i) => drawCopyLine("subtitle", subtitleLines, i, line, padding + vstdSdx, subtitleY + i * (subtitleSize + 4)))
        const subtitleBottom = subtitleY + subtitleLines.length * (subtitleSize + 4)

        // CTA sizing per format
        const baseTitleSubtitleSpacing = 6
        let ctaSize: number
        
        if (selectedSize === "160x600") {
          ctaSize = Math.max(12, Math.min(16.8, width * 0.048))
        } else if (selectedSize === "300x600") {
          ctaSize = Math.max(13, Math.min(18.2, width * 0.052))
        } else if (selectedSize === "970x250") {
          ctaSize = Math.max(12, Math.min(16.8, width * 0.018))
        } else {
          ctaSize = Math.max(10, Math.min(14, width * 0.04))
        }
        
        ctx.font = `500 ${ctaSize}px Graphik, sans-serif`
        ctx.fillStyle = ctaTxt(ctaProgress)
        const [vstdCtaDx, vstdCtaDy] = textSlide(ctaProgress)
        
        let ctaY: number
        if (selectedSize === "160x600") {
          const ctaSpacingFromSubtitle = baseTitleSubtitleSpacing * 2.5
          ctaY = subtitleBottom + ctaSpacingFromSubtitle + vstdCtaDy
        } else if (selectedSize === "300x600") {
          const ctaSpacingFromSubtitle = baseTitleSubtitleSpacing * 2.5
          ctaY = subtitleBottom + ctaSpacingFromSubtitle + vstdCtaDy
        } else if (selectedSize === "970x250") {
          ctaY = height - padding - ctaSize + vstdCtaDy
        } else if (isTallFormat) {
          ctaY = height - redBarHeight - padding - ctaSize + vstdCtaDy
        } else {
          ctaY = height - redBarHeight - padding + vstdCtaDy
        }
        
        ctx.fillText(activeCtaText, padding + vstdCtaDx, ctaY)
        const ctaMetrics = ctx.measureText(activeCtaText)
        
        // Triangle size adjustment per format
        let triangleSize: number
        if (selectedSize === "300x250") {
          triangleSize = ctaSize * 0.6379
        } else if (selectedSize === "970x250") {
          triangleSize = ctaSize * 0.6075
        } else if (selectedSize === "160x600") {
          triangleSize = ctaSize * 0.70875
        } else {
          triangleSize = ctaSize * 0.675
        }
        
        drawTriangle(
          padding + vstdCtaDx + ctaMetrics.width + ctaSize * 0.4,
          ctaY + ctaSize * 0.5,
          triangleSize,
          ctaProgress
        )
      }
    }
    } else {
      // RED BLOCK LAYOUT — copy + logo placed to match the PNG mockups
      ctx.textBaseline = "top"
      const logoAspect = 120 / 36.45

      const geo = redBlockGeo[selectedSize]
      if (geo) {
        const contentX = geo.x + geo.pad
        const contentTop = geo.y + geo.pad
        const contentW = geo.w - geo.pad * 2
        const blockBottom = geo.y + geo.h - geo.pad

        // Per-size config. gapLogo = space below logo, gapTitle = space below title block.
        const cfg: Record<
          string,
          { logoH: number; title: number; sub: number; cta: number; lineGap: number; gapLogo: number; gapTitle: number }
        > = {
          "300x250": { logoH: 30, title: 20, sub: 20, cta: 12, lineGap: 4, gapLogo: 18, gapTitle: 4 },
          "160x600": { logoH: 26, title: 20, sub: 20, cta: 12, lineGap: 4, gapLogo: 16, gapTitle: 6 },
          "728x90": { logoH: 27, title: 20, sub: 20, cta: 12, lineGap: 2, gapLogo: 14, gapTitle: 4 },
          "320x50": { logoH: 18, title: 13, sub: 12, cta: 8, lineGap: 1, gapLogo: 8, gapTitle: 2 },
          "300x600": { logoH: 34, title: 30, sub: 30, cta: 18, lineGap: 5, gapLogo: 24, gapTitle: 6 },
          "970x250": { logoH: 42, title: 30, sub: 30, cta: 18, lineGap: 5, gapLogo: 16, gapTitle: 4 },
        }
        const f = cfg[selectedSize]
        // 300x250, 160x600 and 728x90 get a 5% larger CTA triangle
        const triangleScale =
          selectedSize === "300x250" || selectedSize === "160x600" || isBanner(selectedSize)
            ? 0.70875
            : 0.675
        const triangleSize = f.cta * triangleScale
        const triangleGap = f.cta * 0.4
        // Eyebrow uses the serif face, sized slightly below the title
        const eyebrowSize = Math.round(f.title * 0.7)
        const eyebrowGap = Math.max(4, Math.round(f.title * 0.25))
        // Two-frame progress (title 1 fades out, title 2 fades in)
        const tf1Out = t.title1out || { start: 40, end: 52 }
        const tf2In = t.title2 || { start: 55, end: 67 }
        const tf1OutProgress = easeExit(
          Math.max(0, Math.min(1, (animProgress - tf1Out.start / 100) / Math.max(0.01, (tf1Out.end - tf1Out.start) / 100))),
        )
        const tf2InProgress = wordReveal === "title" ? 1 : easeEntrance(
          Math.max(0, Math.min(1, (animProgress - tf2In.start / 100) / Math.max(0.01, (tf2In.end - tf2In.start) / 100))),
        )
        const frame1Alpha = titleProgress * (1 - tf1OutProgress)
        const frame2Alpha = tf2InProgress

        if (isBanner(selectedSize)) {
          // --- 728x90: logo + copy side-by-side; CTA outside, right-aligned ---
          // Logo, vertically centered in the block (always visible, never animated)
          const logoW = f.logoH * logoAspect
          const logoY = geo.y + (geo.h - f.logoH) / 2
          if (logoImageRef.current) {
            ctx.drawImage(logoImageRef.current, contentX, logoY, logoW, f.logoH)
          }

          const textX = contentX + logoW + 18
          const textMaxW = geo.x + geo.w - geo.pad - textX

          if (copyLayout === "two-frame") {
            // Single title line (frame 1 / frame 2), vertically centered
            const groupTop = geo.y + (geo.h - f.title) / 2
            ctx.font = `600 ${f.title}px Graphik, sans-serif`
            const [t1dx, t1dy] = textSlide(titleProgress)
            ctx.fillStyle = txt(frame1Alpha)
            drawCopyLine("title", [activeTitle], 0, activeTitle, textX + t1dx, groupTop + t1dy, textMaxW)
            const [t2dx, t2dy] = textSlide(tf2InProgress)
            ctx.fillStyle = txt(frame2Alpha)
            drawCopyLine("title2", [activeTitle2], 0, activeTitle2, textX + t2dx, groupTop + t2dy, textMaxW)
          } else if (copyLayout === "eyebrow") {
            // Eyebrow (serif, white, no highlight) above title; group vertically centered
            const groupH = eyebrowSize + eyebrowGap + f.title
            const groupTop = geo.y + (geo.h - groupH) / 2
            const [ebdx, ebdy] = textSlide(eyebrowProgress)
            ctx.font = `500 ${eyebrowSize}px "Reckless Neue", serif`
            ctx.fillStyle = txt(eyebrowProgress)
            ctx.fillText(activeEyebrow, textX + ebdx, groupTop + ebdy, textMaxW)
            const [tdx, tdy] = textSlide(titleProgress)
            ctx.font = `600 ${f.title}px Graphik, sans-serif`
            ctx.fillStyle = txt(titleProgress)
            drawCopyLine("title", [activeTitle], 0, activeTitle, textX + tdx, groupTop + eyebrowSize + eyebrowGap + tdy, textMaxW)
          } else {
            // Standard: title + subtitle stacked, vertically centered
            const groupH = f.title + f.gapTitle + f.sub
            const groupTop = geo.y + (geo.h - groupH) / 2
            const [tdx, tdy] = textSlide(titleProgress)
            ctx.font = `600 ${f.title}px Graphik, sans-serif`
            ctx.fillStyle = txt(titleProgress)
            drawCopyLine("title", [activeTitle], 0, activeTitle, textX + tdx, groupTop + tdy, textMaxW)
            const [sdx, sdy] = textSlide(subtitleProgress)
            ctx.font = `400 ${f.sub}px "Reckless Neue", serif`
            ctx.fillStyle = txt(subtitleProgress)
            drawCopyLine("subtitle", [activeSubtitle], 0, activeSubtitle, textX + sdx, groupTop + f.title + f.gapTitle + sdy, textMaxW)
          }

          // CTA outside the block, right-aligned to the ad, bottom-aligned (20px insets)
          const [cdx, cdy] = textSlide(ctaProgress)
          ctx.font = `500 ${f.cta}px Graphik, sans-serif`
          ctx.fillStyle = ctaTxt(ctaProgress)
          const ctaMetrics = ctx.measureText(activeCtaText)
          const ctaGroupW = ctaMetrics.width + triangleGap + triangleSize
          const ctaX = width - 20 - ctaGroupW
          const ctaY = height - 20 - f.cta
          ctx.fillText(activeCtaText, ctaX + cdx, ctaY + cdy)
          drawTriangle(ctaX + cdx + ctaMetrics.width + triangleGap, ctaY + cdy + f.cta * 0.5, triangleSize, ctaProgress)
        } else {
          // --- Vertical / box sizes: logo (top) and CTA (bottom) are fixed;
          // the copy group is centered in the band between them. ---

          // Logo (always visible, never animated), pinned to top
          const logoW = f.logoH * logoAspect
          if (logoImageRef.current) {
            ctx.drawImage(logoImageRef.current, contentX, contentTop, logoW, f.logoH)
          }

          // CTA top / logo bottom define the band the copy group is centered within
          const logoEnd = contentTop + f.logoH
          const ctaTop = blockBottom - f.cta

          // Measure the copy group height for the active copy layout, keeping the
          // internal spacing between the two labels identical across all layouts.
          let titleLines: string[] = []
          let subtitleLines: string[] = []
          let frame1Lines: string[] = []
          let frame2Lines: string[] = []
          let groupH = 0
          if (copyLayout === "two-frame") {
            ctx.font = `600 ${f.title}px Graphik, sans-serif`
            frame1Lines = wrapText(activeTitle, contentW)
            frame2Lines = wrapText(activeTitle2, contentW)
            const maxLines = Math.max(frame1Lines.length, frame2Lines.length)
            groupH = maxLines * f.title + (maxLines - 1) * f.lineGap
          } else if (copyLayout === "eyebrow") {
            ctx.font = `600 ${f.title}px Graphik, sans-serif`
            titleLines = wrapText(activeTitle, contentW)
            groupH =
              eyebrowSize + eyebrowGap + titleLines.length * f.title + (titleLines.length - 1) * f.lineGap
          } else {
            ctx.font = `600 ${f.title}px Graphik, sans-serif`
            titleLines = wrapText(activeTitle, contentW)
            ctx.font = `400 ${f.sub}px "Reckless Neue", serif`
            subtitleLines = wrapText(activeSubtitle, contentW, "subtitle")
            const titleH = titleLines.length * f.title + (titleLines.length - 1) * f.lineGap
            const subH = subtitleLines.length * f.sub + (subtitleLines.length - 1) * f.lineGap
            groupH = titleH + f.gapTitle + subH
          }

          // Center the group vertically in the available band
          let cursorY = logoEnd + Math.max(0, (ctaTop - logoEnd - groupH) / 2)

          if (copyLayout === "two-frame") {
            ctx.font = `600 ${f.title}px Graphik, sans-serif`
            const [f1dx, f1dy] = textSlide(titleProgress)
            ctx.fillStyle = txt(frame1Alpha)
            frame1Lines.forEach((line, i) =>
              drawCopyLine("title", frame1Lines, i, line, contentX + f1dx, cursorY + i * (f.title + f.lineGap) + f1dy),
            )
            const [f2dx, f2dy] = textSlide(tf2InProgress)
            ctx.fillStyle = txt(frame2Alpha)
            frame2Lines.forEach((line, i) =>
              drawCopyLine("title2", frame2Lines, i, line, contentX + f2dx, cursorY + i * (f.title + f.lineGap) + f2dy),
            )
          } else if (copyLayout === "eyebrow") {
            // Eyebrow (serif, white, no highlight) then title — no subtitle
            const [ebdx, ebdy] = textSlide(eyebrowProgress)
            ctx.font = `500 ${eyebrowSize}px "Reckless Neue", serif`
            ctx.fillStyle = txt(eyebrowProgress)
            ctx.fillText(activeEyebrow, contentX + ebdx, cursorY + ebdy, contentW)
            cursorY += eyebrowSize + eyebrowGap

            const [tdx, tdy] = textSlide(titleProgress)
            ctx.font = `600 ${f.title}px Graphik, sans-serif`
            ctx.fillStyle = txt(titleProgress)
            titleLines.forEach((line, i) =>
              drawCopyLine("title", titleLines, i, line, contentX + tdx, cursorY + i * (f.title + f.lineGap) + tdy),
            )
          } else {
            // Standard: title then subtitle
            const [tdx, tdy] = textSlide(titleProgress)
            ctx.font = `600 ${f.title}px Graphik, sans-serif`
            ctx.fillStyle = txt(titleProgress)
            titleLines.forEach((line, i) => drawCopyLine("title", titleLines, i, line, contentX + tdx, cursorY + i * (f.title + f.lineGap) + tdy))
            cursorY += titleLines.length * f.title + (titleLines.length - 1) * f.lineGap + f.gapTitle

            const [sdx, sdy] = textSlide(subtitleProgress)
            ctx.font = `400 ${f.sub}px "Reckless Neue", serif`
            ctx.fillStyle = txt(subtitleProgress)
            subtitleLines.forEach((line, i) => drawCopyLine("subtitle", subtitleLines, i, line, contentX + sdx, cursorY + i * (f.sub + f.lineGap) + sdy))
          }

          // CTA bottom-aligned within the block padding
          const [cdx, cdy] = textSlide(ctaProgress)
          ctx.font = `500 ${f.cta}px Graphik, sans-serif`
          ctx.fillStyle = ctaTxt(ctaProgress)
          const ctaY = blockBottom - f.cta
          ctx.fillText(activeCtaText, contentX + cdx, ctaY + cdy)
          const ctaMetrics = ctx.measureText(activeCtaText)
          drawTriangle(contentX + cdx + ctaMetrics.width + triangleGap, ctaY + cdy + f.cta * 0.5, triangleSize, ctaProgress)
        }
      }
    }
  }, [width, height, activeTitle, activeSubtitle, activeEyebrow, activeTitle2, activeCtaText, selectedSize, copyOverrides, shadows, elemTimings, copyLayout, textDirection, layoutType, redBlockExtend, showRedBar, textColor, ctaColor, ctaArrowColor, wordReveal, wrapWidth, duration])

  // Keep ref updated so animation loop always uses latest drawCanvas
  drawCanvasRef.current = drawCanvas

  // Animation loop - runs at real-time speed using refs to avoid re-renders
  useEffect(() => {
    if (!isPlaying) return
    
    let lastProgressUpdate = 0
    
    const animate = (time: number) => {
      const elapsed = time - startTimeRef.current
      const newProgress = Math.min(1, elapsed / (duration * 1000))
      progressRef.current = newProgress
      
      // Draw the frame immediately using ref to get latest drawCanvas
      drawCanvasRef.current(newProgress)
      
      // Only update React state every 100ms for UI (progress bar)
      if (time - lastProgressUpdate > 100) {
        setProgress(newProgress)
        lastProgressUpdate = time
      }
      
      if (newProgress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        // Animation complete - freeze on last frame
        progressRef.current = 1
        setProgress(1)
        setIsPlaying(false)
        startTimeRef.current = 0
        // Draw final frame to ensure it stays visible
        drawCanvasRef.current(1)
      }
    }
    
    animationRef.current = requestAnimationFrame(animate)
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying, duration])

  // Initial draw and redraw when settings change (not during animation)
  useEffect(() => {
    if (!isPlaying) {
      drawCanvas(progressRef.current)
    }
  }, [selectedSize, layoutType, activeTitle, activeSubtitle, activeCtaText, drawCanvas, isPlaying, crops, copyOverrides])

  // Force redraw whenever copy overrides change (for live preview during editing)
  useEffect(() => {
    drawCanvasRef.current(progressRef.current)
  }, [activeTitle, activeSubtitle, activeCtaText, shadows, elemTimings, showRedBar, textColor, ctaColor, ctaArrowColor, bgAnimation, layoutType])

  const handlePlayPause = () => {
    if (isPlaying) {
      // Pause - cancel animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      setIsPlaying(false)
    } else {
      // Play - always reset to beginning and play from start
      progressRef.current = 0
      setProgress(0)
      startTimeRef.current = performance.now()
      setIsPlaying(true)
    }
  }

  // ---- Timeline ----
  const blockLabel = layoutType === "red-block" ? "Red block" : "Red bar"
  const timelineTracks: (TimelineTrack & { key: ElemKey })[] = (() => {
    const t = elemTimings[selectedSize]
    const row = (key: ElemKey, label: string, color: string, curve: TimelineTrack["curve"], isCopy = false) => ({
      key,
      label,
      color,
      curve,
      isCopy,
      timing: t[key] || (key === "bg" ? DEFAULT_BG_TIMING : { start: 0, end: 10 }),
    })
    const rows: (TimelineTrack & { key: ElemKey })[] = []
    if (bgMode === "single" && bgAnimation !== "none") rows.push(row("bg", "Background", "#8a7f78", "standard"))
    if (copyLayout === "eyebrow") {
      if (showRedBar && layoutType === "red-block") rows.push(row("redBar", blockLabel, "#CC0000", "standard"))
      rows.push(row("eyebrow", showRedBar && layoutType === "red-bar" ? "Eyebrow + bar" : "Eyebrow", "#CC0000", "entrance", true))
      rows.push(row("title", "Title", "#185fa5", "entrance", true))
      rows.push(row("cta", "CTA", "#3b6d11", "entrance", true))
    } else if (copyLayout === "two-frame") {
      if (showRedBar) rows.push(row("redBar", blockLabel, "#CC0000", "standard"))
      rows.push(row("title", "Frame 1 in", "#185fa5", "entrance", true))
      rows.push(row("title1out", "Frame 1 out", "#6b7280", "exit", true))
      rows.push(row("title2", "Frame 2 in", "#185fa5", "entrance", true))
      rows.push(row("cta", "CTA", "#3b6d11", "entrance", true))
    } else {
      if (showRedBar) rows.push(row("redBar", blockLabel, "#CC0000", "standard"))
      rows.push(row("title", "Title", "#185fa5", "entrance", true))
      rows.push(row("subtitle", "Subtitle", "#185fa5", "entrance", true))
      rows.push(row("cta", "CTA", "#3b6d11", "entrance", true))
    }
    return rows
  })()

  const writeTimings = (updates: Partial<Record<ElemKey, ElemTiming>>) => {
    const targets = timingSynced ? (Object.keys(AD_SIZES) as AdSize[]) : [selectedSize]
    setElemTimings((prev) => {
      const next = { ...prev }
      for (const size of targets) next[size] = { ...prev[size], ...updates }
      return next
    })
  }

  const applyTiming = (key: ElemKey, timing: ElemTiming) => {
    if (timing.end <= timing.start) return
    if (copyLayout === "two-frame") {
      // Frames fade through: frame 2 may not start before frame 1 has left.
      const cur = elemTimings[selectedSize]
      if (key === "title2" && timing.start < (cur.title1out?.end ?? 0) - 1e-6) return
      if (key === "title1out" && timing.end > (cur.title2?.start ?? 100) + 1e-6) return
    }
    writeTimings({ [key]: timing })
  }

  const snapToTokens = () => {
    const total = Math.round(duration * 25)
    const updates: Partial<Record<ElemKey, ElemTiming>> = {}
    for (const tr of timelineTracks) {
      const s = Math.round((tr.timing.start / 100) * total)
      const len = Math.round((tr.timing.end / 100) * total) - s
      const tok = Math.min(nearestToken(Math.max(1, len)), MAX_MOVE_FRAMES)
      const start = Math.min(s, total - tok)
      updates[tr.key] = { start: (start / total) * 100, end: ((start + tok) / total) * 100 }
    }
    writeTimings(updates)
  }

  const scrubTo = (p: number) => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
    setIsPlaying(false)
    progressRef.current = p
    setProgress(p)
    drawCanvasRef.current(p)
  }

  const handleRestart = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    progressRef.current = 1
    setProgress(1)
    startTimeRef.current = 0
    setIsPlaying(false)
    drawCanvas(1)
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Left Panel - Sidebar */}
      <div className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
        <div className="p-4 border-b border-sidebar-border">
          <p className="text-[11px] text-muted-foreground mb-2">Layout type</p>
          <select
            value={layoutType}
            onChange={(e) => setLayoutType(e.target.value as "red-bar" | "red-block")}
            className="w-full border border-sidebar-border rounded-lg px-3 py-2 text-[13px] bg-sidebar-border text-sidebar-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="red-bar">Red Bar</option>
            <option value="red-block">Red Block</option>
          </select>

          <label className="mt-3 flex items-center justify-between gap-2 text-[12px] cursor-pointer">
            <span>{layoutType === "red-block" ? "Show red block" : "Show red bar"}</span>
            <button
              type="button"
              role="switch"
              aria-checked={showRedBar}
              onClick={() => setShowRedBar((v) => !v)}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${showRedBar ? "bg-primary" : "bg-sidebar-border"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-sidebar-foreground transition-transform ${showRedBar ? "translate-x-4" : "translate-x-0"}`}
              />
            </button>
          </label>

          <p className="text-[11px] text-muted-foreground mt-4 mb-2">Colours</p>
          <div className="flex flex-col gap-2">
            {[
              { label: "Text", value: textColor, set: setTextColor },
              { label: "CTA text", value: ctaColor, set: setCtaColor },
              { label: "CTA arrow", value: ctaArrowColor, set: setCtaArrowColor },
            ].map((c) => (
              <div key={c.label} className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label={`${c.label} colour`}
                  value={c.value}
                  onChange={(e) => c.set(e.target.value.toUpperCase())}
                  className="h-7 w-7 shrink-0 cursor-pointer rounded border border-sidebar-border bg-transparent p-0"
                />
                <span className="flex-1 text-[12px]">{c.label}</span>
                <input
                  type="text"
                  aria-label={`${c.label} hex`}
                  value={c.value}
                  onChange={(e) => {
                    const v = e.target.value.trim()
                    if (/^#[0-9a-fA-F]{6}$/.test(v)) c.set(v.toUpperCase())
                  }}
                  maxLength={7}
                  className="w-20 rounded border border-sidebar-border bg-sidebar-border px-2 py-1 font-mono text-[11px] text-sidebar-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-sidebar-border">
          {[
            { id: "assets", icon: ImageIcon, label: "Assets" },
            { id: "copy", icon: Type, label: "Copy" },
            { id: "shadow", icon: Layers, label: "Shadow" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-[11px] transition-colors ${
                activeTab === tab.id
                  ? "bg-sidebar-border text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === "assets" && (
            <div className="space-y-4">
              {/* Background Mode Selector */}
              <div>
                <label className="block text-[11px] text-gray-400 mb-2">Background type</label>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => setBgMode("single")}
                    className={`py-2 px-3 rounded-lg text-[11px] transition-colors ${
                      bgMode === "single"
                        ? "bg-primary text-white"
                        : "bg-sidebar-border text-gray-300 hover:text-white"
                    }`}
                  >
                    Single Image
                  </button>
                  <button
                    onClick={() => setBgMode("multi-layer")}
                    className={`py-2 px-3 rounded-lg text-[11px] transition-colors ${
                      bgMode === "multi-layer"
                        ? "bg-primary text-white"
                        : "bg-sidebar-border text-gray-300 hover:text-white"
                    }`}
                  >
                    Multi-Layer
                  </button>
                </div>
              </div>

              {bgMode === "single" ? (
                <div>
                  <label className="block text-[11px] text-gray-400 mb-2">Background Image</label>
                  <label className="flex items-center justify-center gap-2 p-3 border border-dashed border-sidebar-border rounded-lg cursor-pointer hover:border-gray-500 transition-colors">
                    <Upload className="w-4 h-4" />
                    <span className="text-[13px]">Upload image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                  {backgroundImage && (
                    <div className="mt-3 space-y-2">
                      <div className="text-[11px] text-green-400">Image uploaded</div>
                      <div className="relative overflow-hidden rounded-lg bg-black w-full">
                        <img
                          src={backgroundImage}
                          alt="Background"
                          className="w-full h-auto"
                        />
                      </div>
                      <button
                        onClick={() => {
                          setTempCrop(crops[selectedSize])
                          setIsDragging(false)
                          setCropModalOpen(true)
                        }}
                        className="w-full py-2 px-3 text-[11px] bg-sidebar-border hover:bg-gray-600 rounded-lg transition-colors text-left"
                      >
                        Edit crop for {selectedSize}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] text-gray-400">Layers ({layers.length}/5)</label>
                    {layers.length > 0 && (
                      <button
                        onClick={() => setLayers([])}
                        className="text-[10px] text-red-400 hover:text-red-300"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  {layers.length < 5 && (
                    <label className="flex items-center justify-center gap-2 p-3 border border-dashed border-sidebar-border rounded-lg cursor-pointer hover:border-gray-500 transition-colors">
                      <Upload className="w-4 h-4" />
                      <span className="text-[13px]">Add layers (PNG/SVG)</span>
                      <input
                        type="file"
                        accept="image/png,image/svg+xml"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files || [])
                          const availableSlots = 5 - layers.length
                          const filesToProcess = files.slice(0, availableSlots)
                          
                          filesToProcess.forEach((file, idx) => {
                            const reader = new FileReader()
                            reader.onload = (event) => {
                              const newLayer: LayerConfig = {
                                id: `layer-${Date.now()}-${idx}`,
                                src: event.target?.result as string,
                                startOffsetX: 0,
                                startOffsetY: 50,
                                zoom: "none",
                                zoomAmount: 0.2,
                                timing: { start: 0, end: 30 },
                              }
                              setLayers(prev => [...prev, newLayer].slice(0, 5))
                            }
                            reader.readAsDataURL(file)
                          })
                          e.target.value = ""
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                  {/* Layer list with reorder */}
                  {layers.length > 0 && (
                    <div className="space-y-2">
                      {[...layers].reverse().map((layer, reversedIdx) => {
                        const idx = layers.length - 1 - reversedIdx
                        return (
                        <div key={layer.id} className="flex items-center gap-2 p-2 bg-sidebar-border rounded-lg">
                          <div className="w-10 h-10 bg-black rounded overflow-hidden flex-shrink-0">
                            <img src={layer.src} alt={`Layer ${idx + 1}`} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-medium truncate">Layer {idx + 1}</div>
                            <div className="text-[10px] text-gray-400">{idx === 0 ? "Bottom" : idx === layers.length - 1 ? "Top" : "Middle"}</div>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => {
                                if (idx < layers.length - 1) {
                                  const newLayers = [...layers]
                                  ;[newLayers[idx], newLayers[idx + 1]] = [newLayers[idx + 1], newLayers[idx]]
                                  setLayers(newLayers)
                                }
                              }}
                              disabled={idx === layers.length - 1}
                              className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => {
                                if (idx > 0) {
                                  const newLayers = [...layers]
                                  ;[newLayers[idx - 1], newLayers[idx]] = [newLayers[idx], newLayers[idx - 1]]
                                  setLayers(newLayers)
                                }
                              }}
                              disabled={idx === 0}
                              className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>
                          <button
                            onClick={() => setLayers(prev => prev.filter(l => l.id !== layer.id))}
                            className="p-1 text-gray-400 hover:text-red-400"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        )
                      })}
                      <button
                        onClick={() => {
                          setTempCrop(crops[selectedSize])
                          setIsDragging(false)
                          setCropModalOpen(true)
                        }}
                        className="w-full py-2 px-3 text-[11px] bg-sidebar-border hover:bg-gray-600 rounded-lg transition-colors text-left"
                      >
                        Edit crop for {selectedSize}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-[11px] text-gray-400 mb-2">Click URL</label>
                <input
                  type="url"
                  value={clickUrl}
  onChange={(e) => setClickUrl(e.target.value)}
  placeholder="Leave empty for an ad-server exit tag"
  className="w-full bg-sidebar-border border-0 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-primary"
  />
  <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400">
  {clickUrl.trim()
  ? "Exported as the clickTag default. An ad server can still override it."
  : <>Exported as an exit tag <code className="font-mono text-gray-300">{'clickTag = ""'}</code>. Every click still fires it; the ad server fills in the URL.</>}
  </p>
  </div>

              {exportReport && (
                <div>
                  <label className="block text-[11px] text-gray-400 mb-2">Last export · limit 150 KB per zip</label>
                  <ul className="flex flex-col gap-1">
                    {exportReport.map((r) => (
                      <li key={r.size} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-mono text-gray-300">{r.size}</span>
                        <span className="text-gray-400">
                          {r.dpi ? `${r.dpi} dpi · q${Math.round((r.quality ?? 0) * 100)}` : "no image"}
                        </span>
                        <span className={`font-mono tabular-nums ${r.fits ? "text-gray-300" : "text-primary"}`}>
                          {(r.zipBytes / 1000).toFixed(1)} KB{r.fits ? "" : " over"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === "copy" && (() => {
            const ov = copyOverrides[selectedSize]
            const isSynced = ov.synced

            type CopyFieldKey = "title" | "subtitle" | "eyebrowText" | "title2" | "ctaText"

            const setGlobalField = (field: CopyFieldKey, value: string) => {
              if (field === "title") setTitle(value)
              else if (field === "subtitle") setSubtitle(value)
              else if (field === "eyebrowText") setEyebrowText(value)
              else if (field === "title2") setTitle2(value)
              else setCtaText(value)
              // Also keep all synced overrides in sync
              setCopyOverrides(prev => {
                const next = { ...prev }
                ;(Object.keys(next) as AdSize[]).forEach(size => {
                  if (next[size].synced) next[size] = { ...next[size], [field]: value }
                })
                return next
              })
            }

            const setOverrideField = (field: CopyFieldKey, value: string) => {
              setCopyOverrides(prev => ({
                ...prev,
                [selectedSize]: { ...prev[selectedSize], synced: false, [field]: value },
              }))
            }

            const toggleSync = () => {
              setCopyOverrides(prev => {
                const current = prev[selectedSize]
                if (current.synced) {
                  // Unsync: copy current global values as starting point
                  return { ...prev, [selectedSize]: { synced: false, title, subtitle, eyebrowText, ctaText } }
                } else {
                  // Re-sync: revert to global values
                  return { ...prev, [selectedSize]: { synced: true, title, subtitle, eyebrowText, ctaText } }
                }
              })
            }

            // Fields depend on layout
            const standardFields: { key: CopyFieldKey; label: string; value: string }[] = [
              { key: "title", label: "Title", value: isSynced ? title : ov.title },
              { key: "subtitle", label: "Subtitle", value: isSynced ? subtitle : ov.subtitle },
              { key: "ctaText", label: "CTA Text", value: isSynced ? ctaText : ov.ctaText },
            ]

            const eyebrowFields: { key: CopyFieldKey; label: string; value: string }[] = [
              { key: "eyebrowText", label: "Eyebrow", value: isSynced ? eyebrowText : ov.eyebrowText },
              { key: "title", label: "Title", value: isSynced ? title : ov.title },
              { key: "ctaText", label: "CTA Text", value: isSynced ? ctaText : ov.ctaText },
            ]

            const twoFrameFields: { key: CopyFieldKey; label: string; value: string }[] = [
              { key: "title", label: "Frame 1 title", value: isSynced ? title : ov.title },
              { key: "title2", label: "Frame 2 title", value: isSynced ? title2 : ov.title2 },
              { key: "ctaText", label: "CTA Text", value: isSynced ? ctaText : ov.ctaText },
            ]

            const fields = copyLayout === "eyebrow" ? eyebrowFields : copyLayout === "two-frame" ? twoFrameFields : standardFields

            return (
              <div className="space-y-4">
                {/* Layout selector */}
                <div>
                  <label className="block text-[11px] text-gray-400 mb-2">Copy layout</label>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      onClick={() => {
                        setCopyLayout("standard")
                        setDuration(5)
                      }}
                      className={`py-2 px-3 rounded-lg text-[11px] transition-colors ${
                        copyLayout === "standard"
                          ? "bg-primary text-white"
                          : "bg-sidebar-border text-gray-300 hover:text-white"
                      }`}
                    >
                      Standard
                    </button>
                    <button
                      onClick={() => {
                        setCopyLayout("eyebrow")
                        setDuration(5)
                      }}
                      className={`py-2 px-3 rounded-lg text-[11px] transition-colors ${
                        copyLayout === "eyebrow"
                          ? "bg-primary text-white"
                          : "bg-sidebar-border text-gray-300 hover:text-white"
                      }`}
                    >
                      Eyebrow
                    </button>
                    <button
                      onClick={() => {
                        setCopyLayout("two-frame")
                        setDuration(10)
                      }}
                      className={`py-2 px-3 rounded-lg text-[11px] transition-colors ${
                        copyLayout === "two-frame"
                          ? "bg-primary text-white"
                          : "bg-sidebar-border text-gray-300 hover:text-white"
                      }`}
                    >
                      Two Frames
                    </button>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1.5">
                    {copyLayout === "standard" 
                      ? "Title + Subtitle + CTA with red bar" 
                      : copyLayout === "eyebrow"
                      ? "Eyebrow (highlighted) + Title + CTA"
                      : "Frame 1 title -> Frame 2 title + CTA"}
                  </div>
                </div>

                {/* Sync toggle */}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-sidebar-border">
                  <div>
                    <div className="text-[13px] font-medium">{selectedSize}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {isSynced ? "Using global copy" : "Custom copy"}
                    </div>
                  </div>
                  <button
                    onClick={toggleSync}
                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                      isSynced ? "bg-primary" : "bg-gray-600"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        isSynced ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {!isSynced && (
                  <div className="text-[11px] text-amber-400 px-1">
                    Copy sync off for {selectedSize}. Changes here only affect this size.
                  </div>
                )}

                {fields.map(({ key, label, value }) => (
                  <div key={key}>
                    <label className="block text-[11px] text-gray-400 mb-2">{label}</label>
                    {key === "title" || key === "title2" || key === "subtitle" ? (
                      <textarea
                        rows={2}
                        value={value}
                        onChange={(e) => isSynced ? setGlobalField(key, e.target.value) : setOverrideField(key, e.target.value)}
                        className={`w-full resize-y bg-sidebar-border border-0 rounded-lg px-3 py-2 text-[13px] leading-snug focus:outline-none focus:ring-1 focus:ring-primary ${!isSynced ? "ring-1 ring-amber-500/40" : ""}`}
                      />
                    ) : (
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => isSynced ? setGlobalField(key, e.target.value) : setOverrideField(key, e.target.value)}
                        className={`w-full bg-sidebar-border border-0 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-primary ${!isSynced ? "ring-1 ring-amber-500/40" : ""}`}
                      />
                    )}
                  </div>
                ))}

                <TextMotionPanel
                  copyLayout={copyLayout}
                  selectedSize={selectedSize}
                  wordReveal={wordReveal}
                  setWordReveal={setWordReveal}
                  wrap={wrapWidth[selectedSize] || { title: 100, subtitle: 100 }}
                  setWrap={(next) => setWrapWidth((prev) => ({ ...prev, [selectedSize]: next }))}
                  headline={activeTitle}
                  headline2={copyLayout === "two-frame" ? activeTitle2 : ""}
                  body={activeSubtitle}
                  timings={elemTimings[selectedSize]}
                  totalFrames={duration * FPS}
                  revealFrames={wordRevealFrames}
                />

                {/* Red block size — only relevant for the red block layout */}
                {layoutType === "red-block" && (() => {
                  const base = RED_BLOCK_BASE[selectedSize]
                  const ext = Math.max(0, Math.min(base.maxExtend, redBlockExtend[selectedSize] || 0))
                  const isWidth = base.axis === "w"
                  const blockW = isWidth ? base.w + ext : base.w
                  const blockH = isWidth ? base.h : base.h + ext
                  return (
                    <div className="pt-2 border-t border-sidebar-border">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] text-gray-400">
                          Red block size ({isWidth ? "width" : "height"})
                        </label>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/20 text-white">
                          {Math.round(blockW)} × {Math.round(blockH)} px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={base.maxExtend}
                        value={ext}
                        onChange={(e) =>
                          setRedBlockExtend((prev) => ({ ...prev, [selectedSize]: +e.target.value }))
                        }
                        className="w-full h-1.5 accent-primary"
                      />
                      <div className="flex justify-between text-[10px] text-gray-500 mt-1.5">
                        <span>Default</span>
                        <span>Extend {isWidth ? "right" : "down"}</span>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })()}

          {activeTab === "shadow" && (() => {
            const shadow = shadows[selectedSize]
            const updateShadow = (updater: (prev: ShadowConfig) => ShadowConfig) => {
              setShadows(prev => ({
                ...prev,
                [selectedSize]: updater(prev[selectedSize]),
              }))
            }

            return (
            <div className="space-y-5">
              {/* Current size indicator */}
              <div className="text-[11px] text-gray-400 bg-sidebar-border px-3 py-2 rounded-lg">
                Editing shadow for <span className="text-white font-medium">{selectedSize}</span>
              </div>

              {/* Direction */}
              <div>
                <label className="block text-[11px] text-gray-400 mb-2">Direction</label>
                <div className="grid grid-cols-3 gap-1">
                  {(["auto", "left", "top", "right", "bottom"] as ShadowDirection[]).map(dir => (
                    <button
                      key={dir}
                      onClick={() => updateShadow(prev => ({ ...prev, direction: dir }))}
                      className={`py-1.5 rounded text-[11px] capitalize transition-colors ${
                        shadow.direction === dir
                          ? "bg-primary text-white"
                          : "bg-sidebar-border text-gray-300 hover:text-white"
                      }`}
                    >
                      {dir}
                    </button>
                  ))}
                </div>
              </div>

              {/* Colour stops */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] text-gray-400">Colour stops</label>
                  <button
                    onClick={() => {
                      if (shadow.stops.length >= 5) return
                      const sorted = [...shadow.stops].sort((a, b) => a.position - b.position)
                      const last = sorted[sorted.length - 1]
                      const secondLast = sorted[sorted.length - 2]
                      const newPos = Math.round((last.position + secondLast.position) / 2)
                      updateShadow(prev => ({
                        ...prev,
                        stops: [...prev.stops, { position: newPos, opacity: 30 }],
                      }))
                    }}
                    disabled={shadow.stops.length >= 5}
                    className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add stop
                  </button>
                </div>

                {/* Visual gradient bar */}
                <div
                  className="w-full h-5 rounded mb-3"
                  style={{
                    background: (() => {
                      const sorted = [...shadow.stops].sort((a, b) => a.position - b.position)
                      const stops = sorted.map(s => `rgba(0,0,0,${s.opacity / 100}) ${s.position}%`).join(", ")
                      return `linear-gradient(to right, ${stops})`
                    })()
                  }}
                />

                {/* Stop rows */}
                <div className="space-y-3">
                  {[...shadow.stops]
                    .map((stop, originalIdx) => ({ stop, originalIdx }))
                    .sort((a, b) => a.stop.position - b.stop.position)
                    .map(({ stop, originalIdx }) => (
                    <div key={originalIdx} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-gray-400">Stop {originalIdx + 1}</span>
                        {shadow.stops.length > 2 && (
                          <button
                            onClick={() => updateShadow(prev => ({
                              ...prev,
                              stops: prev.stops.filter((_, i) => i !== originalIdx),
                            }))}
                            className="text-gray-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      {/* Position */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-500 w-14 shrink-0">Position</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={stop.position}
                          onChange={e => updateShadow(prev => ({
                            ...prev,
                            stops: prev.stops.map((s, i) => i === originalIdx ? { ...s, position: +e.target.value } : s),
                          }))}
                          className="flex-1 accent-primary h-1"
                        />
                        <span className="text-[11px] text-gray-400 w-8 text-right">{stop.position}%</span>
                      </div>
                      {/* Opacity */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-500 w-14 shrink-0">Opacity</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={stop.opacity}
                          onChange={e => updateShadow(prev => ({
                            ...prev,
                            stops: prev.stops.map((s, i) => i === originalIdx ? { ...s, opacity: +e.target.value } : s),
                          }))}
                          className="flex-1 accent-primary h-1"
                        />
                        <span className="text-[11px] text-gray-400 w-8 text-right">{stop.opacity}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reset */}
              <button
                onClick={() => updateShadow(() => ({ ...DEFAULT_SHADOW }))}
                className="text-[11px] text-gray-500 hover:text-white transition-colors"
              >
                Reset to default
              </button>
            </div>
            )
          })()}
        </div>

        {/* Export + Reset */}
        <div className="p-4 border-t border-sidebar-border flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={handleSaveProject}
              className="flex-1 flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 text-foreground py-2 px-3 rounded-lg text-[12px] font-medium transition-colors"
              title="Download this ad as a project file you can reopen later"
            >
              <Save className="w-4 h-4" />
              Save project
            </button>
            <button
              onClick={() => projectInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 text-foreground py-2 px-3 rounded-lg text-[12px] font-medium transition-colors"
              title="Open a saved project file"
            >
              <FolderOpen className="w-4 h-4" />
              Open project
            </button>
            <input
              ref={projectInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              aria-label="Open project file"
              onChange={handleOpenProject}
            />
          </div>
          {projectNotice && (
            <p
              role="status"
              className={`text-[11px] leading-relaxed ${projectNotice.tone === "error" ? "text-destructive" : "text-muted-foreground"}`}
            >
              {projectNotice.text}
            </p>
          )}
          <div role="group" aria-labelledby="export-sizes-label" className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span id="export-sizes-label" className="text-[11px] text-muted-foreground">Sizes to export</span>
              <button
                type="button"
                onClick={() => setExportSizes(orderedExportSizes.length === ALL_SIZES.length ? [] : ALL_SIZES)}
                className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              >
                {orderedExportSizes.length === ALL_SIZES.length ? "Clear" : "Select all"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_SIZES.map((s) => {
                const on = exportSizes.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleExportSize(s)}
                    className={`px-2 py-1 rounded-md text-[11px] font-mono border transition-colors ${
                      on ? "bg-foreground text-background border-foreground" : "bg-transparent text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowExportModal(true)}
              disabled={orderedExportSizes.length === 0}
              className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white py-2 px-4 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={orderedExportSizes.length === 0 ? "Pick at least one size to export" : undefined}
            >
              <Download className="w-4 h-4" />
              {`Export ${exportCountLabel}`}
            </button>
            <button
              onClick={handleExportGifs}
              disabled={!!gifStatus?.busy || orderedExportSizes.length === 0}
              className="flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 text-foreground py-2 px-3 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              title={orderedExportSizes.length === 0 ? "Pick at least one size to export" : `Export ${exportCountLabel} as full-quality GIF previews for PowerPoint`}
            >
              <Film className="w-4 h-4" />
              GIF
            </button>
            <button
              onClick={handleReset}
              className="flex items-center justify-center p-2 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
              title="Reset to defaults"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
          {gifStatus && (
            <p role="status" className={`text-[11px] leading-relaxed ${gifStatus.busy ? "text-gray-400" : "text-primary"}`}>
              {gifStatus.text}
            </p>
          )}
          {gifReport && (
            <div>
              <p className="text-[11px] text-gray-400 mb-1">Last GIF export · plays once, rests on the end frame · full quality, for PowerPoint previews</p>
              <ul className="flex flex-col gap-1">
                {gifReport.map((r) => (
                  <li key={r.size} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-mono text-gray-300">{r.size}</span>
                    <span className="text-gray-400">{r.fps} fps · {r.colors} colours</span>
                    <span className="font-mono tabular-nums text-gray-300">{(r.bytes / 1000).toFixed(1)} KB</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Export Quality Modal */}
      {showExportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          onClick={() => setShowExportModal(false)}
        >
          <div
            className="bg-card rounded-[10px] p-6 w-[340px] flex flex-col gap-5"
            style={{ border: "0.5px solid #e4e7ed" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div>
              <p className="text-[15px] text-foreground" style={{ fontWeight: 500 }}>Export ads</p>
              <p className="text-[13px] text-muted-foreground mt-0.5">Choose image quality before exporting all 5 sizes.</p>
            </div>

            {/* Quality Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] text-foreground">Image quality</span>
                <span
                  className="text-[11px] px-2 py-0.5 rounded-full"
                  style={{ background: "#e6f1fb", color: "#185fa5" }}
                >
                  {Math.round(exportQuality * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                value={Math.round(exportQuality * 100)}
                onChange={(e) => setExportQuality(+e.target.value / 100)}
                className="w-full h-1.5 accent-primary"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1.5">
                <span>Smaller file</span>
                <span>Better quality</span>
              </div>
            </div>

            {/* Size estimates */}
            <div className="rounded-[8px] p-3 flex flex-col gap-1.5" style={{ background: "#f8f9fb", border: "0.5px solid #e4e7ed" }}>
              <p className="text-[11px] text-muted-foreground mb-0.5">Estimated zip size per format</p>
              {orderedExportSizes.map((s) => {
                const { width, height } = AD_SIZES[s]
                const pixels = width * height
                const kb = Math.round(pixels * exportQuality * 0.00033 + 6)
                return (
                  <div key={s} className="flex items-center justify-between">
                    <span className="text-[12px] text-foreground">{s}</span>
                    <span className="text-[11px] text-muted-foreground">~{kb} KB</span>
                  </div>
                )
              })}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 py-2 rounded-lg text-[13px] text-muted-foreground transition-colors"
                style={{ background: "#f1f0f0" }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowExportModal(false)
                  exportAllSizes({
                    backgroundImage,
                    layers,
                    bgMode,
                    crops,
                    copyLayout,
                    title,
                    subtitle,
                    eyebrowText,
                    title2,
                    ctaText,
                    clickUrl,
                    bgAnimation,
                    elemTimings,
                    shadows,
                    textDirection,
                    copyOverrides,
                    quality: exportQuality,
                    duration,
                    layoutType,
                    showRedBar,
                    wordReveal,
                    wrapWidth,
                    textColor,
                    ctaColor,
                    ctaArrowColor,
                    sizes: orderedExportSizes,
                  }).then(setExportReport)
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white py-2 rounded-lg text-[13px] font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Center Panel - Preview */}
      <div className="flex-1 flex flex-col">
        {/* Size Tabs */}
        <div className="flex border-b border-border bg-card">
          {(Object.keys(AD_SIZES) as AdSize[]).map((size) => (
            <button
              key={size}
              onClick={() => setSelectedSize(size)}
              className={`px-4 py-3 text-[13px] transition-colors ${
                selectedSize === size
                  ? "border-b-2 border-primary text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {size}
            </button>
          ))}
        </div>

        {/* Canvas Container */}
        <div className="flex-1 flex items-center justify-center p-8 bg-muted">
          <div
            className="bg-white shadow-lg"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: "center",
            }}
          >
            <canvas
              ref={canvasRef}
              width={width * CANVAS_SCALE}
              height={height * CANVAS_SCALE}
              style={{ width, height }}
              className="block"
            />
          </div>
        </div>

        {/* Playback Controls */}
        <div className="border-t border-border bg-card p-4">
          <div className="flex flex-nowrap items-center gap-4 min-h-10">
            <button
              onClick={handlePlayPause}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={handleRestart}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title="Jump to end"
            >
              <SkipForward className="w-5 h-5" />
            </button>

            <span className="text-[13px] text-muted-foreground shrink-0 font-mono" style={{ minWidth: "90px" }}>
              {(progress * duration).toFixed(1)}s / {duration.toFixed(1)}s
            </span>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setZoom(Math.max(25, zoom - 25))}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-[13px] w-12 text-center">{zoom}%</span>
              <button
                onClick={() => setZoom(Math.min(200, zoom + 25))}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="mt-3">
            <TimelinePanel
              tracks={timelineTracks}
              durationSec={duration}
              minDurationSec={5}
              maxDurationSec={20}
              progress={progress}
              onScrub={scrubTo}
              onChange={(key, timing) => applyTiming(key as ElemKey, timing)}
              onDurationChange={setDuration}
              onSnapToTokens={snapToTokens}
            />
          </div>
        </div>
      </div>

      {/* Right Panel - Animation Settings */}
      <div className="w-72 border-l border-border bg-card overflow-y-auto overflow-x-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-[15px] font-medium">Animation</h2>
          <p className="text-[11px] text-muted-foreground mt-1">
            {selectedSize}
          </p>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-[11px] text-muted-foreground mb-2">
              Background Effect
            </label>
            <select 
              value={bgAnimation}
              onChange={(e) => setBgAnimation(e.target.value as BgAnimationType)}
              className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-card focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="zoom-out">Zoom Out</option>
              <option value="zoom-in">Zoom In</option>
              <option value="pan-left">Pan Left</option>
              <option value="pan-right">Pan Right</option>
              <option value="none">None</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-muted-foreground mb-2">
              Duration (seconds)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={5}
                max={20}
                value={duration}
                onChange={(e) => setDuration(+e.target.value)}
                className="flex-1 accent-primary h-1"
              />
              <span className="text-[13px] font-medium w-6 text-right">{duration}s</span>
            </div>
          </div>

          {/* Tab selector for Element timing / Layer Animation */}
          {bgMode === "multi-layer" && layers.length > 0 && (
            <div className="flex gap-1 mb-3">
              <button
                onClick={() => setRightPanelTab("elements")}
                className={`flex-1 py-2 px-3 rounded-lg text-[11px] transition-colors ${
                  rightPanelTab === "elements"
                    ? "bg-primary text-white"
                    : "bg-sidebar-border text-gray-300 hover:text-white"
                }`}
              >
                Element timing
              </button>
              <button
                onClick={() => setRightPanelTab("layers")}
                className={`flex-1 py-2 px-3 rounded-lg text-[11px] transition-colors ${
                  rightPanelTab === "layers"
                    ? "bg-primary text-white"
                    : "bg-sidebar-border text-gray-300 hover:text-white"
                }`}
              >
                Layer animation
              </button>
            </div>
          )}

          {/* Element timing - shown when not in multi-layer mode OR when elements tab is active */}
          {(bgMode !== "multi-layer" || layers.length === 0 || rightPanelTab === "elements") && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[13px] font-medium">Element timing</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTimingSynced(!timingSynced)}
                  className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors ${
                    timingSynced 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={timingSynced ? "Synced across all sizes" : "Independent per size"}
                >
                  {timingSynced ? <Link className="w-3 h-3" /> : <Unlink className="w-3 h-3" />}
                  {timingSynced ? "Synced" : "Per size"}
                </button>
                <button
                  onClick={() => {
                    if (timingSynced) {
                      // Reset all sizes
                      setElemTimings({
                        "300x250": { ...DEFAULT_TIMING },
                        "160x600": { ...DEFAULT_TIMING },
                        "970x250": { ...DEFAULT_TIMING },
                        "728x90":  { ...DEFAULT_TIMING },
                        "320x50":  { ...DEFAULT_TIMING },
                        "300x600": { ...DEFAULT_TIMING },
                      })
                    } else {
                      setElemTimings(prev => ({ ...prev, [selectedSize]: { ...DEFAULT_TIMING } }))
                    }
                  }}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Text animation direction */}
            <div className="mb-3">
              <div className="text-[11px] text-muted-foreground mb-1.5">Text direction</div>
              <div className="grid grid-cols-3 gap-1">
                {([
                  { value: "none",        label: "None"  },
                  { value: "from-left",   label: "Left"  },
                  { value: "from-right",  label: "Right" },
                  { value: "from-top",    label: "Top"   },
                  { value: "from-bottom", label: "Bottom"},
                ] as const).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setTextDirection(value)}
                    className={`py-1.5 rounded text-[10px] transition-colors ${
                      textDirection === value
                        ? "bg-primary text-white"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Drag bars on the timeline under the preview to move a keyframe, drag their edges to change its length, and drag the handle at the end to stretch the whole ad. Everything snaps to whole frames at 25 fps.
            </p>
          </div>
          )}

          {/* Layer Animation tab - shown when multi-layer mode is active and layers tab is selected */}
          {bgMode === "multi-layer" && layers.length > 0 && rightPanelTab === "layers" && (
            <div className="space-y-4">
              {[...layers].reverse().map((layer, reversedIdx) => {
                const idx = layers.length - 1 - reversedIdx
                return (
                <div key={layer.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-100 rounded overflow-hidden flex-shrink-0 border border-gray-200">
                      <img src={layer.src} alt={`Layer ${idx + 1}`} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[11px] font-medium text-gray-900">Layer {idx + 1}</span>
                    <span className="text-[10px] text-gray-500">({idx === 0 ? "Bottom" : idx === layers.length - 1 ? "Top" : "Middle"})</span>
                  </div>
                  
                  {/* Start position offsets */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] text-gray-500 mb-1">Start position offset (px)</div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-600 w-8 shrink-0">X</span>
                      <input
                        type="range"
                        min={-150}
                        max={150}
                        value={layer.startOffsetX}
                        onChange={(e) => {
                          setLayers(prev => prev.map(l => 
                            l.id === layer.id ? { ...l, startOffsetX: +e.target.value } : l
                          ))
                        }}
                        className="flex-1 accent-primary h-1"
                      />
                      <input
                        type="number"
                        value={layer.startOffsetX}
                        onChange={(e) => {
                          const val = Math.max(-150, Math.min(150, +e.target.value || 0))
                          setLayers(prev => prev.map(l => 
                            l.id === layer.id ? { ...l, startOffsetX: val } : l
                          ))
                        }}
                        className="w-14 bg-white border border-gray-200 rounded px-1.5 py-0.5 text-[11px] text-gray-900 text-right focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-600 w-8 shrink-0">Y</span>
                      <input
                        type="range"
                        min={-150}
                        max={150}
                        value={layer.startOffsetY}
                        onChange={(e) => {
                          setLayers(prev => prev.map(l => 
                            l.id === layer.id ? { ...l, startOffsetY: +e.target.value } : l
                          ))
                        }}
                        className="flex-1 accent-primary h-1"
                      />
                      <input
                        type="number"
                        value={layer.startOffsetY}
                        onChange={(e) => {
                          const val = Math.max(-150, Math.min(150, +e.target.value || 0))
                          setLayers(prev => prev.map(l => 
                            l.id === layer.id ? { ...l, startOffsetY: val } : l
                          ))
                        }}
                        className="w-14 bg-white border border-gray-200 rounded px-1.5 py-0.5 text-[11px] text-gray-900 text-right focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="text-[9px] text-gray-400">Negative X = from left, Positive X = from right. Negative Y = from top, Positive Y = from bottom.</div>
                  </div>

                  {/* Zoom */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] text-gray-500 mb-1">Zoom</div>
                    <div className="flex items-center gap-1">
                      {(["none", "zoom-in", "zoom-out"] as LayerZoom[]).map(z => (
                        <button
                          key={z}
                          onClick={() => setLayers(prev => prev.map(l => l.id === layer.id ? { ...l, zoom: z } : l))}
                          className={`flex-1 py-1 rounded text-[10px] transition-colors ${
                            layer.zoom === z
                              ? "bg-primary text-white"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {z === "none" ? "None" : z === "zoom-in" ? "Zoom in" : "Zoom out"}
                        </button>
                      ))}
                    </div>
                    {layer.zoom !== "none" && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-600 w-8 shrink-0">Amt</span>
                        <input
                          type="range"
                          min={5}
                          max={80}
                          value={Math.round(layer.zoomAmount * 100)}
                          onChange={(e) => {
                            setLayers(prev => prev.map(l =>
                              l.id === layer.id ? { ...l, zoomAmount: +e.target.value / 100 } : l
                            ))
                          }}
                          className="flex-1 accent-primary h-1"
                        />
                        <span className="text-[11px] text-gray-600 w-8 text-right">{Math.round(layer.zoomAmount * 100)}%</span>
                      </div>
                    )}
                  </div>

                  {/* Timing sliders */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] text-gray-500 mb-1">Animation timing (%)</div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-600 w-8 shrink-0">Start</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={layer.timing.start}
                        onChange={(e) => {
                          const val = Math.min(+e.target.value, layer.timing.end - 1)
                          setLayers(prev => prev.map(l => 
                            l.id === layer.id ? { ...l, timing: { ...l.timing, start: val } } : l
                          ))
                        }}
                        className="flex-1 accent-primary h-1"
                      />
                      <span className="text-[11px] text-gray-600 w-8 text-right">{layer.timing.start}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-600 w-8 shrink-0">End</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={layer.timing.end}
                        onChange={(e) => {
                          const val = Math.max(+e.target.value, layer.timing.start + 1)
                          setLayers(prev => prev.map(l => 
                            l.id === layer.id ? { ...l, timing: { ...l.timing, end: val } } : l
                          ))
                        }}
                        className="flex-1 accent-primary h-1"
                      />
                      <span className="text-[11px] text-gray-600 w-8 text-right">{layer.timing.end}%</span>
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Crop Tool Modal */}
      {cropModalOpen && ((bgMode === "single" && backgroundImage && bgImageRef.current) || (bgMode === "multi-layer" && layers.length > 0)) && (() => {
        const adW = AD_SIZES[selectedSize].width
        const adH = AD_SIZES[selectedSize].height
        const containerAspect = adW / adH

        // Get reference image dimensions (first layer or single image)
        let imgNatW: number, imgNatH: number
        if (bgMode === "multi-layer" && layers.length > 0) {
          const firstImg = layerImagesRef.current.get(layers[0].id)
          if (!firstImg) return null
          imgNatW = firstImg.naturalWidth
          imgNatH = firstImg.naturalHeight
        } else {
          imgNatW = bgImageRef.current!.naturalWidth
          imgNatH = bgImageRef.current!.naturalHeight
        }

        // Fixed container height, but constrain width to modal (780px - 40px padding)
        let containerH = 400
        let containerW = containerH * containerAspect
        
        // If too wide, scale down containerH to fit in modal
        const maxWidth = 740 // 780 - 40px padding
        if (containerW > maxWidth) {
          containerH = maxWidth / containerAspect
          containerW = maxWidth
        }

        // At scale=1, image should FIT in container (fully visible, may have black bars)
        // User zooms in from there to cover if desired
        // FIT scale = min ratio so entire image fits
        const fitScale = Math.min(containerW / imgNatW, containerH / imgNatH)
        
        // Image display size at scale=1 (FIT)
        const baseW = imgNatW * fitScale
        const baseH = imgNatH * fitScale

        // Current display size with user zoom
        const displayW = baseW * tempCrop.scale
        const displayH = baseH * tempCrop.scale

        // Pan limits - allow free movement, but clamp so image stays within reasonable bounds
        // Allow moving until edge of image reaches opposite edge of container
        const minX = Math.min(0, containerW - displayW)
        const maxX = Math.max(0, containerW - displayW)
        const minY = Math.min(0, containerH - displayH)
        const maxY = Math.max(0, containerH - displayH)
        
        const clampOffset = (ox: number, oy: number) => ({
          x: Math.max(minX, Math.min(maxX, ox)),
          y: Math.max(minY, Math.min(maxY, oy)),
        })

        const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
          e.preventDefault()
          setIsDragging(true)
          setDragStart({ x: e.clientX, y: e.clientY, ox: tempCrop.offsetX, oy: tempCrop.offsetY })
        }

        const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
          if (!isDragging) return
          const rawX = dragStart.ox + (e.clientX - dragStart.x)
          const rawY = dragStart.oy + (e.clientY - dragStart.y)
          const clamped = clampOffset(rawX, rawY)
          setTempCrop(prev => ({ ...prev, offsetX: clamped.x, offsetY: clamped.y }))
        }

        const handleMouseUp = () => setIsDragging(false)

        const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
          e.preventDefault()
          const delta = e.deltaY > 0 ? -0.1 : 0.1
          const newScale = Math.min(20, Math.max(0.5, +(tempCrop.scale + delta).toFixed(2)))
          const newDisplayW = baseW * newScale
          const newDisplayH = baseH * newScale
          const newMinX = Math.min(0, containerW - newDisplayW)
          const newMaxX = Math.max(0, containerW - newDisplayW)
          const newMinY = Math.min(0, containerH - newDisplayH)
          const newMaxY = Math.max(0, containerH - newDisplayH)
          setTempCrop(prev => ({
            scale: newScale,
            offsetX: Math.max(newMinX, Math.min(newMaxX, prev.offsetX)),
            offsetY: Math.max(newMinY, Math.min(newMaxY, prev.offsetY)),
          }))
        }

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
            <div className="bg-card rounded-xl shadow-2xl w-full mx-4 overflow-hidden" style={{ maxWidth: 780 }}>
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <h3 className="text-[15px] font-medium">Crop image — {selectedSize}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Drag to pan, scroll to zoom</p>
                </div>
                <button onClick={() => setCropModalOpen(false)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div
                  className="relative overflow-hidden rounded-lg bg-neutral-900 mx-auto select-none"
                  style={{ width: containerW, height: containerH, cursor: isDragging ? "grabbing" : "grab" }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onWheel={handleWheel}
                >
                  {/* 
                    Image sized to FIT at scale=1 (baseW x baseH maintains aspect ratio).
                    User zoom is applied via CSS transform scale() which cannot distort.
                  */}
                  {bgMode === "multi-layer" ? (
                    // Multi-layer: show all layers stacked
                    layers.map((layer, idx) => {
                      const img = layerImagesRef.current.get(layer.id)
                      if (!img) return null
                      return (
                        <img
                          key={layer.id}
                          src={layer.src}
                          alt={`Layer ${idx + 1}`}
                          draggable={false}
                          className="absolute pointer-events-none"
                          style={{
                            width: baseW,
                            height: baseH,
                            left: tempCrop.offsetX,
                            top: tempCrop.offsetY,
                            transformOrigin: 'top left',
                            transform: `scale(${tempCrop.scale})`,
                            zIndex: idx,
                          }}
                        />
                      )
                    })
                  ) : (
                    // Single image mode
                    <img
                      src={backgroundImage!}
                      alt="Crop preview"
                      draggable={false}
                      className="absolute pointer-events-none"
                      style={{
                        width: baseW,
                        height: baseH,
                        left: tempCrop.offsetX,
                        top: tempCrop.offsetY,
                        transformOrigin: 'top left',
                        transform: `scale(${tempCrop.scale})`,
                      }}
                    />
                  )}
                  {/* Grid overlay */}
                  <div className="absolute inset-0 pointer-events-none opacity-20">
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} className="border border-white/50" />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Zoom indicator and controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const newScale = Math.max(0.5, +(tempCrop.scale - 0.25).toFixed(2))
                        const newDisplayW = baseW * newScale
                        const newDisplayH = baseH * newScale
                        const newMinX = Math.min(0, containerW - newDisplayW)
                        const newMaxX = Math.max(0, containerW - newDisplayW)
                        const newMinY = Math.min(0, containerH - newDisplayH)
                        const newMaxY = Math.max(0, containerH - newDisplayH)
                        setTempCrop(prev => ({
                          scale: newScale,
                          offsetX: Math.max(newMinX, Math.min(newMaxX, prev.offsetX)),
                          offsetY: Math.max(newMinY, Math.min(newMaxY, prev.offsetY)),
                        }))
                      }}
                      className="p-2 rounded-lg hover:bg-muted transition-colors border border-border"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-[13px] font-medium w-14 text-center">{Math.round(tempCrop.scale * 100)}%</span>
                    <button
                      onClick={() => {
                        const newScale = Math.min(20, +(tempCrop.scale + 0.25).toFixed(2))
                        const newDisplayW = baseW * newScale
                        const newDisplayH = baseH * newScale
                        const newMinX = Math.min(0, containerW - newDisplayW)
                        const newMaxX = Math.max(0, containerW - newDisplayW)
                        const newMinY = Math.min(0, containerH - newDisplayH)
                        const newMaxY = Math.max(0, containerH - newDisplayH)
                        setTempCrop(prev => ({
                          scale: newScale,
                          offsetX: Math.max(newMinX, Math.min(newMaxX, prev.offsetX)),
                          offsetY: Math.max(newMinY, Math.min(newMaxY, prev.offsetY)),
                        }))
                      }}
                      className="p-2 rounded-lg hover:bg-muted transition-colors border border-border"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => setTempCrop({ offsetX: 0, offsetY: 0, scale: 1 })}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Reset
                  </button>
                </div>

                {/* Quick fit buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      // Scale image to fill container width
                      const fillWidthScale = containerW / baseW
                      const newDisplayH = baseH * fillWidthScale
                      // Center vertically
                      const centeredY = (containerH - newDisplayH) / 2
                      setTempCrop({ scale: fillWidthScale, offsetX: 0, offsetY: centeredY })
                    }}
                    className="flex-1 py-2 px-3 text-[11px] bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    Fill Width
                  </button>
                  <button
                    onClick={() => {
                      // Scale image to fill container height
                      const fillHeightScale = containerH / baseH
                      const newDisplayW = baseW * fillHeightScale
                      // Center horizontally
                      const centeredX = (containerW - newDisplayW) / 2
                      setTempCrop({ scale: fillHeightScale, offsetX: centeredX, offsetY: 0 })
                    }}
                    className="flex-1 py-2 px-3 text-[11px] bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    Fill Height
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 pb-5 flex gap-3">
                <button
                  onClick={() => {
                    setCrops(prev => ({ ...prev, [selectedSize]: tempCrop }))
                    setCropModalOpen(false)
                  }}
                  className="flex-1 py-2 px-4 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors"
                >
                  Apply to {selectedSize}
                </button>
                <button
                  onClick={() => {
                    const updated = {} as typeof crops
                    for (const s of Object.keys(AD_SIZES) as AdSize[]) updated[s] = tempCrop
                    setCrops(updated)
                    setCropModalOpen(false)
                  }}
                  className="flex-1 py-2 px-4 bg-muted rounded-lg text-[13px] font-medium hover:bg-muted/80 transition-colors"
                >
                  Apply to all sizes
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
