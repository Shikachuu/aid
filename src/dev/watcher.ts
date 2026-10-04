import { type FSWatcher, watch } from "node:fs"
import path from "node:path"
import type { BuildContext } from "../core/types"

/** Stops every watcher that `watchContent` opened. */
export type WatchHandle = { close: () => void }

/**
 * Watch every input the build pipeline reads: the content, static and
 * templates dirs, the config file at `configPath`, and `files`. Events under
 * `<cwd>/.aid/` are filtered out so our own writes can't loop back. Events
 * whose target file has the same mtime as the last time we saw it are also
 * dropped, because Bun's recursive `fs.watch` on macOS emits events for reads
 * as well as writes. Calls `onChange` once per 100 ms debounce window, with
 * `configChanged` true when the config file was among the changes.
 *
 * Inputs that do not exist yet (no `templates/`, for example) are skipped.
 * Any other watch error, such as EMFILE, throws.
 */
export function watchContent(
  ctx: BuildContext,
  configPath: string,
  files: readonly string[],
  onChange: (configChanged: boolean) => void,
): WatchHandle {
  const ignoreRoot = path.join(ctx.cwd, ".aid")
  const watchers: FSWatcher[] = []
  const seenMtimes = new Map<string, number>()
  let dirty = false
  let configChanged = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = () => {
    timer = null
    if (!dirty) {
      return
    }
    const changed = configChanged
    dirty = false
    configChanged = false
    onChange(changed)
  }

  const enqueue = async (absPath: string) => {
    if (absPath.startsWith(`${ignoreRoot}${path.sep}`) || absPath === ignoreRoot) {
      return
    }
    const mtime = await statMtime(absPath)
    if (mtime === null) {
      seenMtimes.delete(absPath)
    } else {
      const prev = seenMtimes.get(absPath)
      if (prev !== undefined && mtime <= prev) {
        return
      }
      seenMtimes.set(absPath, mtime)
    }
    dirty = true
    configChanged ||= absPath === configPath
    if (timer !== null) {
      clearTimeout(timer)
    }
    timer = setTimeout(flush, 100)
  }

  const tryWatch = (
    target: string,
    recursive: boolean,
    toPath: (name?: string) => string | undefined,
  ) => {
    try {
      watchers.push(
        watch(target, { recursive }, (_event, name) => {
          const changed = toPath(name?.toString())
          if (changed !== undefined) {
            void enqueue(changed)
          }
        }),
      )
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        for (const w of watchers) {
          w.close()
        }
        throw err
      }
    }
  }

  for (const dir of [ctx.contentDir, ctx.staticDir, ctx.templatesDir]) {
    if (dir !== null) {
      tryWatch(dir, true, (name) => (name ? path.join(dir, name) : undefined))
    }
  }
  for (const file of [configPath, ...files]) {
    tryWatch(file, false, () => file)
  }

  return {
    close() {
      if (timer !== null) {
        clearTimeout(timer)
      }
      for (const w of watchers) {
        w.close()
      }
    },
  }
}

const statMtime = async (absPath: string): Promise<number | null> => {
  try {
    return (await Bun.file(absPath).stat()).mtimeMs
  } catch {
    return null
  }
}
