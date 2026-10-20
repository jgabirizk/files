"use client"

import type { WordReveal } from "@/lib/motion"

type Span = { start: number; end: number }
type Wrap = { title: number; subtitle: number; cta?: number }
type Scale = { title: number; subtitle: number; cta: number }

interface Props {
  fontScale: Scale
  setFontScale: (v: Scale) => void
  copyLayout: "standard" | "eyebrow" | "two-frame" | "build"
  selectedSize: string
  wordReveal: WordReveal
  setWordReveal: (v: WordReveal) => void
  wrap: Wrap
  setWrap: (v: Wrap) => void
  headline: string
  headline2: string
  body: string
  timings: { title: Span; title2?: Span; subtitle: Span } | undefined
  totalFrames: number
  revealFrames: (words: number) => number
  /** Names what the font/wrap controls are editing, e.g. "300x250 · Variant 2". Defaults to the size. */
  scope?: string
  /** For a variant: which settings still follow the size rather than being its own. */
  inherited?: { fontScale: boolean; wrap: boolean }
  /** For a variant, Reset returns a setting to following the size instead of writing 100%. */
  onReset?: (which: "fontScale" | "wrap") => void
}

const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length

export function TextMotionPanel({
  fontScale,
  setFontScale,
  copyLayout,
  selectedSize,
  wordReveal,
  setWordReveal,
  wrap,
  setWrap,
  headline,
  headline2,
  body,
  timings,
  totalFrames,
  revealFrames,
  scope,
  inherited,
  onReset,
}: Props) {
  const label = scope ?? selectedSize
  const hasBody = copyLayout === "standard"
  // A body choice made under Standard has nothing to animate in the other layouts.
  const effective: WordReveal = wordReveal === "subtitle" && !hasBody ? "none" : wordReveal

  const options: { value: WordReveal; label: string; disabled?: string }[] = [
    { value: "none", label: "Slide" },
    { value: "title", label: "Headline words" },
    { value: "subtitle", label: "Body words", disabled: hasBody ? undefined : "This layout has no body copy" },
  ]

  // How long the reveal actually takes, measured against the ad's own length.
  const readout = (() => {
    if (effective === "none" || !timings) return null
    const runs =
      effective === "title"
        ? [
            { text: headline, span: timings.title, name: copyLayout === "two-frame" ? "Frame 1" : copyLayout === "build" ? "Line 1" : "Headline" },
            ...(headline2 ? [{ text: headline2, span: timings.title2 || { start: 55, end: 67 }, name: copyLayout === "build" ? "Line 2" : "Frame 2" }] : []),
          ]
        : [{ text: body, span: timings.subtitle, name: "Body" }]
    return runs.map(({ text, span, name }) => {
      const words = countWords(text)
      const frames = revealFrames(words)
      const startF = Math.round((span.start / 100) * totalFrames)
      const endF = startF + frames
      return { name, words, frames, startF, endF, overruns: endF > totalFrames }
    })
  })()

  const sliders: { key: "title" | "subtitle"; label: string }[] = [
    { key: "title", label: copyLayout === "two-frame" ? "Headline wrap (both frames)" : copyLayout === "build" ? "Headline wrap (both lines)" : "Headline wrap" },
    ...(hasBody ? [{ key: "subtitle" as const, label: "Body wrap" }] : []),
  ]

  return (
    <div className="flex flex-col gap-4 border-t border-sidebar-border pt-3">
      <div>
        <span id="text-anim-label" className="mb-2 block text-[11px] text-gray-400">
          Text animation
        </span>
        <div role="radiogroup" aria-labelledby="text-anim-label" className="grid grid-cols-3 gap-1 rounded-lg bg-sidebar-border p-1">
          {options.map((o) => {
            const active = effective === o.value
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={!!o.disabled}
                title={o.disabled}
                onClick={() => setWordReveal(o.value)}
                className={`rounded-md px-2 py-1.5 text-[11px] transition-colors ${
                  active ? "bg-primary text-white" : "text-gray-300 hover:bg-white/5"
                } disabled:cursor-not-allowed disabled:text-gray-600 disabled:hover:bg-transparent`}
              >
                {o.label}
              </button>
            )
          })}
        </div>
        <p className="mt-1.5 text-[10px] leading-relaxed text-gray-500">
          {effective === "none"
            ? "Each element slides in whole, in the direction set above."
            : "Each word fades in with a 12px drop from above, 13f entrance, 2f apart. Only one of headline or body can use it."}
        </p>
        {readout && (
          <ul className="mt-2 flex flex-col gap-1">
            {readout.map((r) => (
              <li
                key={r.name}
                className={`rounded-md px-2 py-1 font-mono text-[10px] ${
                  r.overruns ? "bg-amber-500/10 text-amber-300" : "bg-sidebar-border text-gray-300"
                }`}
              >
                {r.name}: {r.words} {r.words === 1 ? "word" : "words"} · f{r.startF} → f{r.endF} ({r.frames}f)
                {r.overruns && ` — runs past the end of the ad (f${totalFrames}); start it earlier or cut words`}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            Font size · {label}
            {inherited?.fontScale && <span className="text-gray-500"> · following {selectedSize}</span>}
          </span>
          {(onReset ? !inherited?.fontScale : fontScale.title !== 100 || fontScale.subtitle !== 100 || fontScale.cta !== 100) && (
            <button
              type="button"
              onClick={() => (onReset ? onReset("fontScale") : setFontScale({ title: 100, subtitle: 100, cta: 100 }))}
              className="text-[10px] text-gray-400 underline-offset-2 hover:text-white hover:underline"
            >
              Reset
            </button>
          )}
        </div>
        {(
          [
            { key: "title", label: copyLayout === "eyebrow" ? "Headline & eyebrow" : "Headline" },
            ...(hasBody ? [{ key: "subtitle", label: "Body" }] : []),
            { key: "cta", label: "CTA & arrow" },
          ] as { key: keyof Scale; label: string }[]
        ).map(({ key, label }) => (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor={`fs-${key}`} className="text-[11px] text-gray-300">
                {label}
              </label>
              <span className="font-mono text-[10px] text-gray-400">{fontScale[key]}%</span>
            </div>
            <input
              id={`fs-${key}`}
              type="range"
              min={60}
              max={160}
              step={5}
              value={fontScale[key]}
              onChange={(e) => setFontScale({ ...fontScale, [key]: +e.target.value })}
              className="h-1.5 w-full accent-primary"
            />
          </div>
        ))}
        <p className="text-[10px] leading-relaxed text-gray-500">
          Percent of this size&apos;s default. Line spacing and the arrow scale with it.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-400">
            Text wrap · {label}
            {inherited?.wrap && <span className="text-gray-500"> · following {selectedSize}</span>}
          </span>
          {(onReset ? !inherited?.wrap : wrap.title !== 100 || wrap.subtitle !== 100 || wrap.cta !== undefined) && (
            <button
              type="button"
              onClick={() => (onReset ? onReset("wrap") : setWrap({ title: 100, subtitle: 100 }))}
              className="text-[10px] text-gray-400 underline-offset-2 hover:text-white hover:underline"
            >
              Reset
            </button>
          )}
        </div>
        {sliders.map(({ key, label }) => (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor={`wrap-${key}`} className="text-[11px] text-gray-300">
                {label}
              </label>
              <span className="font-mono text-[10px] text-gray-400">{wrap[key]}% of column</span>
            </div>
            <input
              id={`wrap-${key}`}
              type="range"
              min={40}
              max={100}
              step={5}
              value={wrap[key]}
              onChange={(e) => setWrap({ ...wrap, [key]: +e.target.value })}
              className="h-1.5 w-full accent-primary"
            />
          </div>
        ))}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="wrap-cta" className="text-[11px] text-gray-300">
              CTA wrap
            </label>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-gray-400">
                {wrap.cta === undefined ? "Off · one line" : `${wrap.cta}% of column`}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={wrap.cta !== undefined}
                aria-label="Wrap the CTA by width"
                onClick={() => setWrap({ ...wrap, cta: wrap.cta === undefined ? 100 : undefined })}
                className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${wrap.cta !== undefined ? "bg-primary" : "bg-sidebar-border"}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-sidebar-foreground transition-transform ${wrap.cta !== undefined ? "translate-x-3" : "translate-x-0"}`}
                />
              </button>
            </div>
          </div>
          <input
            id="wrap-cta"
            type="range"
            min={30}
            max={100}
            step={5}
            disabled={wrap.cta === undefined}
            value={wrap.cta ?? 100}
            onChange={(e) => setWrap({ ...wrap, cta: +e.target.value })}
            className="h-1.5 w-full accent-primary disabled:opacity-40"
          />
        </div>
        <p className="text-[10px] leading-relaxed text-gray-500">
          Press Enter in a copy field (CTA included) to force a line break. Extra CTA lines stack upward and the arrow follows the last line. Narrower widths wrap earlier; each size keeps its own setting.
          {selectedSize === "728x90" && " The 728×90 keeps copy on one line, so only forced breaks change it there."}
        </p>
      </div>
    </div>
  )
}
