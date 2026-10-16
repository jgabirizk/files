// Bain motion system: one definition shared by the preview canvas and the
// exported ad. `makeBezier` must stay self-contained (no outer references)
// because export-ads.ts serialises it with Function.prototype.toString().

export function makeBezier(x1: number, y1: number, x2: number, y2: number) {
  const ca = (a1: number, a2: number) => 1 - 3 * a2 + 3 * a1
  const cb = (a1: number, a2: number) => 3 * a2 - 6 * a1
  const cc = (a1: number) => 3 * a1
  const calc = (t: number, a1: number, a2: number) => ((ca(a1, a2) * t + cb(a1, a2)) * t + cc(a1)) * t
  const slope = (t: number, a1: number, a2: number) => 3 * ca(a1, a2) * t * t + 2 * cb(a1, a2) * t + cc(a1)
  return function (x: number) {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 8; i++) {
      const s = slope(t, x1, x2)
      if (Math.abs(s) < 1e-6) break
      t -= (calc(t, x1, x2) - x) / s
    }
    if (t < 0 || t > 1 || Math.abs(calc(t, x1, x2) - x) > 1e-4) {
      let lo = 0
      let hi = 1
      t = x
      for (let j = 0; j < 40; j++) {
        const v = calc(t, x1, x2)
        if (Math.abs(v - x) < 1e-6) break
        if (v < x) lo = t
        else hi = t
        t = (lo + hi) / 2
      }
    }
    return calc(t, y1, y2)
  }
}

export type CurveName = "standard" | "entrance" | "exit"

export const CURVES: Record<CurveName, [number, number, number, number]> = {
  standard: [0.45, 0, 0.15, 1],
  entrance: [0.15, 0.55, 0.25, 1],
  exit: [0.6, 0, 0.85, 0.35],
}

export const easeStandard = makeBezier(...CURVES.standard)
export const easeEntrance = makeBezier(...CURVES.entrance)
export const easeExit = makeBezier(...CURVES.exit)

export const FPS = 25
export const DURATION_TOKENS = [2, 3, 5, 8, 13, 21, 34] as const
export const MAX_MOVE_FRAMES = 34
export const MIN_HOLD_FRAMES = 55
// Section 5: word/line slide-in is a 12px drop at most; anything larger reads as a swipe.
export const TEXT_SLIDE_PX = 12
// Section 5 "slide-in, word by word": each word fades in with a 12px drop from
// above, 13f entrance, words 2f apart. Applies to the headline OR the body, never both.
export const WORD_ENTRANCE_FRAMES = 13
export const WORD_STAGGER_FRAMES = 2
export type WordReveal = "none" | "title" | "subtitle"
// Frames a word-by-word reveal needs from its start to the last word landing.
export const wordRevealFrames = (wordCount: number) =>
  wordCount <= 0 ? 0 : (wordCount - 1) * WORD_STAGGER_FRAMES + WORD_ENTRANCE_FRAMES

export const nearestToken = (frames: number) =>
  DURATION_TOKENS.reduce((best, tok) => (Math.abs(tok - frames) < Math.abs(best - frames) ? tok : best), DURATION_TOKENS[0])

export const isToken = (frames: number) => (DURATION_TOKENS as readonly number[]).includes(frames)

export const totalFramesFor = (seconds: number) => Math.round(seconds * FPS)
