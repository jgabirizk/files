// Build lines 2+ live in the title2 field, separated by U+2029 (paragraph separator).
// That keeps every copy store — per-size overrides, variants, saved projects, the
// export — carrying the extra lines with no new field. A plain "\n" inside a line
// is still a manual line break within that line.
export const BUILD_SEP = "\u2029"

export const splitBuild = (title2: string): string[] => title2.split(BUILD_SEP)
export const joinBuild = (parts: string[]): string => parts.join(BUILD_SEP)
/** title2 as shown by layouts with a single second headline (two-frame). */
export const firstBuildPart = (title2: string): string => splitBuild(title2)[0]

export const MAX_BUILD_LINES = 6

type Span = { start: number; end: number }

/**
 * Line k (0-based) of an n-line build. Line 0 runs on the title timing, line 1 on
 * title2; every later line enters one "step" after the line before it, where the
 * step is line 2's offset from line 1, so the hold set for line 2 repeats down the
 * build. The CTA is pushed back by the same step per extra line so it still lands
 * after the last one.
 */
export function buildTiming(title: Span, title2: Span | undefined, n: number) {
  const t2 = title2 || { start: 55, end: 67 }
  const step = t2.start - title.start
  const line = (k: number): Span =>
    k <= 0 ? title : { start: t2.start + (k - 1) * step, end: t2.end + (k - 1) * step }
  return { line, step, ctaShift: Math.max(0, n - 2) * step, lastEnd: line(n - 1).end }
}
