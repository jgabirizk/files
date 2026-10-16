import { GIFEncoder, quantize, applyPalette, type Palette } from "gifenc"

/** Frames are captured once at this rate; lower rates are taken by subsampling. */
export const GIF_CAPTURE_FPS = 15

export type GifResult = {
  bytes: Uint8Array
  fps: number
  colors: number
  frames: number
}

function sameFrame(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function encode(frames: Uint8ClampedArray[], width: number, height: number, fps: number, colors: number) {
  const step = GIF_CAPTURE_FPS / fps
  const picked: Uint8ClampedArray[] = []
  for (let f = 0; f < frames.length; f += step) picked.push(frames[Math.round(f)] ?? frames[frames.length - 1])
  // Always end on the true final frame so the resting end state is exact.
  if (picked[picked.length - 1] !== frames[frames.length - 1]) picked.push(frames[frames.length - 1])

  // One shared palette (sampled across the run) avoids colour flicker between frames and saves a table per frame.
  const sampleEvery = Math.max(1, Math.floor(picked.length / 8))
  const samples = picked.filter((_, i) => i % sampleEvery === 0)
  const pool = new Uint8ClampedArray(samples.reduce((n, s) => n + s.length, 0))
  let o = 0
  for (const s of samples) { pool.set(s, o); o += s.length }
  const palette: Palette = quantize(pool, colors)

  const frameMs = 1000 / fps
  const indexed = picked.map((p) => applyPalette(p, palette))
  // Merge identical consecutive frames into one longer frame (the held end state costs one frame, not dozens).
  const runs: { index: Uint8Array; delay: number }[] = []
  for (const idx of indexed) {
    const last = runs[runs.length - 1]
    if (last && sameFrame(last.index, idx)) last.delay += frameMs
    else runs.push({ index: idx, delay: frameMs })
  }

  const gif = GIFEncoder()
  runs.forEach((r, i) => {
    gif.writeFrame(r.index, width, height, {
      palette,
      delay: Math.round(r.delay),
      // -1 = play once and rest on the last frame; set only on the first frame.
      ...(i === 0 ? { repeat: -1 } : {}),
    })
  })
  gif.finish()
  return { bytes: gif.bytes(), frames: runs.length }
}

/**
 * GIFs are PowerPoint previews, not ad deliverables, so no size limit applies:
 * always encode at the full capture rate and a full palette.
 */
export function encodeGif(frames: Uint8ClampedArray[], width: number, height: number): GifResult {
  const { bytes, frames: n } = encode(frames, width, height, GIF_CAPTURE_FPS, 256)
  return { bytes, fps: GIF_CAPTURE_FPS, colors: 256, frames: n }
}
