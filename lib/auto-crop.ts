export type Crop = { offsetX: number; offsetY: number; scale: number }

/** The crop modal's box for an ad aspect. Crops are stored in this space, so it must match the modal exactly. */
export function cropBox(adW: number, adH: number) {
  const aspect = adW / adH
  let h = 400
  let w = h * aspect
  if (w > 740) {
    h = 740 / aspect
    w = 740
  }
  return { w, h }
}

/**
 * Re-crops one size from another so both show the same part of the image at the same relative zoom.
 * The source crop's centre becomes the target's centre; zoom is measured against "cover", so a crop that
 * just fills its frame still just fills a frame of a different shape. Never leaves an empty edge.
 */
export function proportionalCrop(
  img: { w: number; h: number },
  from: { w: number; h: number; crop: Crop },
  to: { w: number; h: number },
): Crop {
  const a = cropBox(from.w, from.h)
  const fitA = Math.min(a.w / img.w, a.h / img.h)
  const coverA = Math.max(a.w / (img.w * fitA), a.h / (img.h * fitA))
  const dispAW = img.w * fitA * from.crop.scale
  const dispAH = img.h * fitA * from.crop.scale
  const fx = Math.min(1, Math.max(0, (a.w / 2 - from.crop.offsetX) / dispAW))
  const fy = Math.min(1, Math.max(0, (a.h / 2 - from.crop.offsetY) / dispAH))
  const zoom = Math.max(1, from.crop.scale / coverA)

  const b = cropBox(to.w, to.h)
  const fitB = Math.min(b.w / img.w, b.h / img.h)
  const coverB = Math.max(b.w / (img.w * fitB), b.h / (img.h * fitB))
  const scale = coverB * zoom
  const dispW = img.w * fitB * scale
  const dispH = img.h * fitB * scale
  const clamp = (v: number, min: number) => Math.min(0, Math.max(min, v))
  return {
    scale,
    offsetX: clamp(b.w / 2 - fx * dispW, b.w - dispW),
    offsetY: clamp(b.h / 2 - fy * dispH, b.h - dispH),
  }
}
