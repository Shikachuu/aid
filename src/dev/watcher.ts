import { watch } from "node:fs"
import path from "node:path"
import type { BuildContext } from "../core/types"

export type ChangeBatch = {
  /** Absolute paths that changed in the debounce window (deduped). */
  paths: string[]
  /** True iff aid.yaml is in this batch — the session should restart, not rebuild. */
  configChanged: boolean
}

export type WatchHandle = {
  close: () => void
  /** Replace the Tailwind-dependency watch set. Call after a successful rebuild reports new deps. */
  updateTailwindDeps: (deps: readonly string[]) => void
}

/**
 * Watch every input the build pipeline reads from. Events under `<cwd>/.aid/`
 * are filtered out so our own writes can't loop back. Events whose target file
 * has the same mtime as the last time we saw it are also dropped — Bun's
 * recursive `fs.watch` on macOS emits events for reads as well as writes, and
 * the build pipeline reads colocated assets every rebuild. Batched into a
 * single `onChange` callback per ~100ms debounce window.
 */
export function watchContent(
  ctx: BuildContext,
  initialTailwindDeps: readonly string[],
  onChange: (batch: ChangeBatch) => void,
): WatchHandle {
  const configPath = path.join(ctx.cwd, "aid.yaml")
  const ignoreRoot = path.join(ctx.cwd, ".aid")

  const watchers = new Set<ReturnType<typeof watch>>()
  const tailwindWatchers = new Set<ReturnType<typeof watch>>()

  const seenMtimes = new Map<string, number>()
  let pending = new Map<string, true>()
  let timer: ReturnType<typeof setTimeout> | null = null
  const DEBOUNCE_MS = 100

  const flush = () => {
    timer = null
    if (pending.size === 0) return
    const paths = [...pending.keys()]
    pending = new Map()
    const configChanged = paths.some((p) => p === configPath)
    onChange({ paths, configChanged })
  }

  const enqueue = async (absPath: string) => {
    if (absPath.startsWith(`${ignoreRoot}${path.sep}`) || absPath === ignoreRoot) return
    let mtime: number | null = null
    try {
      const stat = await Bun.file(absPath).stat()
      mtime = stat.mtimeMs
    } catch {
      // File deleted — treat as a real change.
      seenMtimes.delete(absPath)
    }
    if (mtime !== null) {
      const prev = seenMtimes.get(absPath)
      if (prev !== undefined && mtime <= prev) return
      seenMtimes.set(absPath, mtime)
    }
    pending.set(absPath, true)
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(flush, DEBOUNCE_MS)
  }

  const watchDir = (dir: string, set: Set<ReturnType<typeof watch>> = watchers) => {
    try {
      const w = watch(dir, { recursive: true }, (_event, filename) => {
        if (!filename) return
        void enqueue(path.join(dir, filename.toString()))
      })
      set.add(w)
    } catch {
      // Directory may not exist yet (e.g. user has no templates/); ignore.
    }
  }

  const watchFile = (filePath: string, set: Set<ReturnType<typeof watch>> = watchers) => {
    try {
      const w = watch(filePath, () => {
        void enqueue(filePath)
      })
      set.add(w)
    } catch {
      // File may not exist; ignore.
    }
  }

  watchDir(ctx.contentDir)
  watchDir(ctx.staticDir)
  if (ctx.templatesDir !== null) watchDir(ctx.templatesDir)
  watchFile(configPath)
  for (const dep of initialTailwindDeps) watchFile(dep, tailwindWatchers)

  return {
    close() {
      if (timer !== null) clearTimeout(timer)
      for (const w of watchers) w.close()
      for (const w of tailwindWatchers) w.close()
      watchers.clear()
      tailwindWatchers.clear()
    },
    updateTailwindDeps(deps) {
      for (const w of tailwindWatchers) w.close()
      tailwindWatchers.clear()
      for (const dep of deps) watchFile(dep, tailwindWatchers)
    },
  }
}
