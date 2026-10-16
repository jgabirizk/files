// A saved ad is a self-contained JSON file the user keeps. Images are already
// held as data URLs, so the file carries them and reopens with no server.
// Persistence is a downloaded file rather than a database because every
// database integration is blocked for this team's role.

export const PROJECT_APP_ID = "paid-media-ads-generator"
export const PROJECT_VERSION = 1
export const PROJECT_EXTENSION = ".adproject.json"

export interface ProjectFile<State> {
  app: typeof PROJECT_APP_ID
  version: number
  savedAt: string
  state: State
}

export function projectFileName(title: string, date = new Date()): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  const stamp = date.toISOString().slice(0, 10)
  return `${slug || "ad"}-${stamp}${PROJECT_EXTENSION}`
}

export function downloadProject<State>(state: State, fileName: string): number {
  const file: ProjectFile<State> = {
    app: PROJECT_APP_ID,
    version: PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    state,
  }
  const blob = new Blob([JSON.stringify(file)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return blob.size
}

export type ParsedProject<State> =
  | { ok: true; state: Partial<State>; savedAt: string }
  | { ok: false; reason: string }

// Refuses anything that isn't one of our project files, by name, rather than
// loading a stray JSON file into the editor and leaving it half-populated.
export function parseProject<State>(text: string): ParsedProject<State> {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, reason: "That file isn't valid JSON." }
  }
  if (!data || typeof data !== "object") {
    return { ok: false, reason: "That file isn't an ad project." }
  }
  const file = data as Partial<ProjectFile<State>>
  if (file.app !== PROJECT_APP_ID) {
    return { ok: false, reason: "That file wasn't saved from this ad generator." }
  }
  if (typeof file.version !== "number" || file.version > PROJECT_VERSION) {
    return { ok: false, reason: "That project was saved by a newer version of this tool." }
  }
  if (!file.state || typeof file.state !== "object") {
    return { ok: false, reason: "That project file has no ad in it." }
  }
  return { ok: true, state: file.state as Partial<State>, savedAt: String(file.savedAt ?? "") }
}
