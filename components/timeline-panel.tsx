"use client"

import { useRef } from "react"
import {
  CURVES,
  FPS,
  MAX_MOVE_FRAMES,
  MIN_HOLD_FRAMES,
  isToken,
  nearestToken,
  type CurveName,
} from "@/lib/motion"

export type TimelineTrack = {
  key: string
  label: string
  color: string
  curve: CurveName
  /** Percent of total duration, 0-100 */
  timing: { start: number; end: number }
  /** Counts toward the final-frame hold (text and CTA do; background does not) */
  isCopy?: boolean
}

type DragMode = "move" | "start" | "end"

type Props = {
  tracks: TimelineTrack[]
  durationSec: number
  minDurationSec: number
  maxDurationSec: number
  progress: number
  onScrub: (progress: number) => void
  onChange: (key: string, timing: { start: number; end: number }) => void
  onDurationChange: (seconds: number) => void
  onSnapToTokens: () => void
}

const EASE_UI = "cubic-bezier(0.45,0,0.15,1)"

function CurveGlyph({ curve }: { curve: CurveName }) {
  const [x1, y1, x2, y2] = CURVES[curve]
  const w = 16
  const h = 10
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0">
      <path
        d={`M0 ${h} C ${x1 * w} ${h - y1 * h}, ${x2 * w} ${h - y2 * h}, ${w} 0`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </svg>
  )
}

export function TimelinePanel({
  tracks,
  durationSec,
  minDurationSec,
  maxDurationSec,
  progress,
  onScrub,
  onChange,
  onDurationChange,
  onSnapToTokens,
}: Props) {
  const areaRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    mode: DragMode
    key: string
    originFrame: number
    startF: number
    endF: number
  } | null>(null)
  const durationDragRef = useRef<{ originX: number; originDur: number; width: number } | null>(null)

  const total = Math.max(1, Math.round(durationSec * FPS))
  const toFrame = (pct: number) => Math.round((pct / 100) * total)
  const toPct = (frame: number) => (frame / total) * 100

  const frameAt = (clientX: number) => {
    const rect = areaRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return Math.round(((clientX - rect.left) / rect.width) * total)
  }

  // ---- bar dragging ----
  const beginDrag = (e: React.PointerEvent, key: string, mode: DragMode, timing: { start: number; end: number }) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { mode, key, originFrame: frameAt(e.clientX), startF: toFrame(timing.start), endF: toFrame(timing.end) }
  }

  const onDragMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const delta = frameAt(e.clientX) - d.originFrame
    let s = d.startF
    let en = d.endF
    if (d.mode === "move") {
      const len = d.endF - d.startF
      s = Math.max(0, Math.min(total - len, d.startF + delta))
      en = s + len
    } else if (d.mode === "start") {
      s = Math.max(0, Math.min(d.endF - 1, d.startF + delta))
    } else {
      en = Math.min(total, Math.max(d.startF + 1, d.endF + delta))
    }
    onChange(d.key, { start: toPct(s), end: toPct(en) })
  }

  const endDrag = () => {
    dragRef.current = null
  }

  // ---- scrubbing ----
  const scrubFrom = (clientX: number) => {
    const rect = areaRef.current?.getBoundingClientRect()
    if (!rect) return
    const f = Math.max(0, Math.min(total, Math.round(((clientX - rect.left) / rect.width) * total)))
    onScrub(f / total)
  }

  // ---- duration stretch ----
  const beginDurationDrag = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    durationDragRef.current = {
      originX: e.clientX,
      originDur: durationSec,
      width: areaRef.current?.getBoundingClientRect().width ?? 1,
    }
  }
  const onDurationMove = (e: React.PointerEvent) => {
    const d = durationDragRef.current
    if (!d) return
    const next = d.originDur * (1 + (e.clientX - d.originX) / d.width)
    const snapped = Math.round(next * 2) / 2
    const clamped = Math.max(minDurationSec, Math.min(maxDurationSec, snapped))
    if (clamped !== durationSec) onDurationChange(clamped)
  }

  // ---- rule checks ----
  const copyTracks = tracks.filter((t) => t.isCopy)
  const lastCopyEnd = copyTracks.length ? Math.max(...copyTracks.map((t) => toFrame(t.timing.end))) : 0
  const holdFrames = total - lastCopyEnd
  const holdOk = holdFrames >= MIN_HOLD_FRAMES
  const offTokenCount = tracks.filter((t) => {
    const len = toFrame(t.timing.end) - toFrame(t.timing.start)
    return len > MAX_MOVE_FRAMES || !isToken(len)
  }).length

  const seconds = Array.from({ length: Math.floor(durationSec) + 1 }, (_, i) => i)
  const playheadPct = progress * 100
  const currentFrame = Math.round(progress * total)

  return (
    <div className="flex flex-col gap-2">
      {/* Status line */}
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <div className="flex items-center gap-3 text-muted-foreground">
          <span className="font-mono text-foreground">
            f{currentFrame} / {total}f
          </span>
          <span>25 fps</span>
          <span className={holdOk ? "text-muted-foreground" : "text-amber-500"}>
            Final hold {holdFrames}f{holdOk ? "" : ` · needs ${MIN_HOLD_FRAMES}f`}
          </span>
          {offTokenCount > 0 && (
            <span className="text-amber-500">
              {offTokenCount} {offTokenCount === 1 ? "move is" : "moves are"} off the duration tokens
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onSnapToTokens}
          disabled={offTokenCount === 0}
          className="shrink-0 rounded px-2 py-1 text-[11px] text-primary hover:bg-primary/10 disabled:text-muted-foreground disabled:hover:bg-transparent"
          style={{ transition: `background-color 120ms ${EASE_UI}, color 120ms ${EASE_UI}` }}
          title={offTokenCount === 0 ? "Every move already uses a duration token" : "Round each move to the nearest token (max 34f)"}
        >
          Snap to motion tokens
        </button>
      </div>

      <div className="flex">
        {/* Label column */}
        <div className="w-32 shrink-0">
          <div className="h-6" />
          {tracks.map((t) => (
            <div key={t.key} className="flex h-7 items-center gap-1.5 pr-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
              <span className="truncate text-[11px] text-foreground">{t.label}</span>
              <span className="ml-auto text-muted-foreground" title={`${t.curve} curve`}>
                <CurveGlyph curve={t.curve} />
              </span>
            </div>
          ))}
        </div>

        {/* Track area */}
        <div className="relative min-w-0 flex-1">
          <div ref={areaRef} className="relative">
            {/* Ruler: click or drag to scrub */}
            <div
              className="relative h-6 cursor-ew-resize select-none border-b border-border"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                scrubFrom(e.clientX)
              }}
              onPointerMove={(e) => {
                if (e.buttons & 1) scrubFrom(e.clientX)
              }}
              role="slider"
              aria-label="Playhead"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={currentFrame}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") onScrub(Math.max(0, currentFrame - 1) / total)
                if (e.key === "ArrowRight") onScrub(Math.min(total, currentFrame + 1) / total)
              }}
            >
              {seconds.map((sec) => (
                <div
                  key={sec}
                  className="absolute top-0 h-full border-l border-border"
                  style={{ left: `${((sec * FPS) / total) * 100}%` }}
                >
                  <span className="absolute left-1 top-1 font-mono text-[10px] text-muted-foreground">{sec}s</span>
                </div>
              ))}
            </div>

            {/* Tracks */}
            {tracks.map((t) => {
              const sF = toFrame(t.timing.start)
              const eF = toFrame(t.timing.end)
              const len = eF - sF
              const warn = len > MAX_MOVE_FRAMES || !isToken(len)
              return (
                <div key={t.key} className="relative h-7 border-b border-border/60">
                  <div
                    className="group absolute top-1 bottom-1 flex cursor-grab items-center rounded-[4px] active:cursor-grabbing"
                    style={{
                      left: `${t.timing.start}%`,
                      width: `${Math.max(0.4, t.timing.end - t.timing.start)}%`,
                      backgroundColor: t.color,
                      outline: warn ? "1px dashed rgb(245 158 11)" : undefined,
                      outlineOffset: 1,
                    }}
                    onPointerDown={(e) => beginDrag(e, t.key, "move", t.timing)}
                    onPointerMove={onDragMove}
                    onPointerUp={endDrag}
                    title={`${t.label}: f${sF}–f${eF} (${len}f, ${t.curve})${
                      warn ? ` · nearest token ${Math.min(nearestToken(len), MAX_MOVE_FRAMES)}f` : ""
                    }`}
                  >
                    <div
                      className="absolute left-0 top-0 h-full w-2 cursor-ew-resize rounded-l-[4px] bg-black/20 opacity-0 group-hover:opacity-100"
                      onPointerDown={(e) => beginDrag(e, t.key, "start", t.timing)}
                      onPointerMove={onDragMove}
                      onPointerUp={endDrag}
                    />
                    <span className="pointer-events-none mx-auto truncate px-2 font-mono text-[10px] text-white">
                      {len}f
                    </span>
                    <div
                      className="absolute right-0 top-0 h-full w-2 cursor-ew-resize rounded-r-[4px] bg-black/20 opacity-0 group-hover:opacity-100"
                      onPointerDown={(e) => beginDrag(e, t.key, "end", t.timing)}
                      onPointerMove={onDragMove}
                      onPointerUp={endDrag}
                    />
                  </div>
                </div>
              )
            })}

            {/* Final-frame hold region */}
            {copyTracks.length > 0 && (
              <div
                className="pointer-events-none absolute bottom-0 top-6"
                style={{
                  left: `${(lastCopyEnd / total) * 100}%`,
                  right: 0,
                  backgroundImage: holdOk
                    ? "repeating-linear-gradient(135deg, transparent 0 5px, rgb(127 127 127 / 0.12) 5px 6px)"
                    : "repeating-linear-gradient(135deg, transparent 0 5px, rgb(245 158 11 / 0.25) 5px 6px)",
                }}
              />
            )}

            {/* Playhead */}
            <div
              className="pointer-events-none absolute bottom-0 top-0 w-px bg-primary"
              style={{ left: `${playheadPct}%` }}
            >
              <div className="absolute -left-1 top-0 h-2 w-2 rotate-45 bg-primary" />
            </div>
          </div>

          {/* Duration stretch handle */}
          <div
            className="absolute -right-2 top-0 bottom-0 flex w-4 cursor-ew-resize items-start justify-center"
            onPointerDown={beginDurationDrag}
            onPointerMove={onDurationMove}
            onPointerUp={() => (durationDragRef.current = null)}
            title="Drag to change length — keyframes scale with it"
          >
            <div className="mt-1 h-4 w-1.5 rounded-sm bg-foreground/40 hover:bg-foreground/70" />
          </div>
        </div>
      </div>
    </div>
  )
}
