import { type FSWatcher, watch } from "node:fs"
import path from "node:path"
import type { BuildContext } from "../core/types"

/** Stops every watcher that `watchContent` opened, and adds single files to watch later. */
export type WatchHandle = {
  close: () => void
  watchFiles: (files: Iterable<string>) => void
}

/** Runs `fn` after the debounce window and returns a function that cancels it. */
export type Schedule = (fn: () => void) => () => void

const DEBOUNCE_MS = 100

const EMBEDDED_PREFIX = "/$bunfs/"

const PERMISSION_ERRORS = new Set(["EACCES", "EPERM"])

const debounce: Schedule = (fn) => {
  const timer = setTimeout(fn, DEBOUNCE_MS)
  return () => clearTimeout(timer)
}

/**
 * Watch the content, static and templates dirs, the config file at
 * `configPath`, and `files`. A single file is watched through its parent dir,
 * so an atomic-rename save or a file created after start still reports.
 * Inputs whose folder does not exist yet are skipped. Any other watch error,
 * such as EMFILE, throws. See {@link createChangeQueue} for the event filters.
 */
export function watchContent(
  ctx: BuildContext,
  configPath: string,
  files: readonly string[],
  onChange: (configChanged: boolean) => void,
  schedule: Schedule = debounce,
): WatchHandle {
  const queue = createChangeQueue({
    devOutputDir: path.join(ctx.cwd, ".aid"),
    configPath,
    onChange,
    schedule,
  })
  const watchers: FSWatcher[] = []
  const fileDirs = new Map<string, Set<string>>()
  const unwatchableDirs = new Set<string>()
  const reportedDirs = new Set<string>()
  let closed = false

  const closeAll = () => {
    closed = true
    queue.cancel()
    for (const w of watchers) {
      w.close()
    }
  }

  const tryWatch = (
    target: string,
    recursive: boolean,
    toPath: (name: string) => string | null,
  ) => {
    try {
      watchers.push(
        watch(target, { recursive }, (_event, name) => {
          const changed = name ? toPath(name.toString()) : null
          if (changed !== null) {
            void queue.enqueue(changed)
          }
        }),
      )
      return true
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err
      }
      return false
    }
  }

  const watchFiles = (paths: Iterable<string>) => {
    for (const file of paths) {
      if (file.startsWith(EMBEDDED_PREFIX)) {
        continue
      }
      const dir = path.dirname(file)
      const names = fileDirs.get(dir)
      if (names !== undefined) {
        names.add(path.basename(file))
        continue
      }
      const watched = new Set([path.basename(file)])
      if (tryWatch(dir, false, (name) => (watched.has(name) ? path.join(dir, name) : null))) {
        fileDirs.set(dir, watched)
      }
    }
  }

  try {
    for (const dir of [ctx.contentDir, ctx.staticDir, ctx.templatesDir]) {
      if (dir !== null) {
        tryWatch(dir, true, (name) => path.join(dir, name))
      }
    }
    watchFiles([configPath, ...files])
  } catch (err) {
    closeAll()
    throw err
  }

  const watchMoreFiles = (paths: Iterable<string>) => {
    for (const file of paths) {
      const dir = path.dirname(file)
      if (closed || unwatchableDirs.has(dir)) {
        continue
      }
      try {
        watchFiles([file])
      } catch (err) {
        if (PERMISSION_ERRORS.has((err as NodeJS.ErrnoException).code ?? "")) {
          unwatchableDirs.add(dir)
        }
        if (!reportedDirs.has(dir)) {
          reportedDirs.add(dir)
          console.error(`[aid] cannot watch ${file}: ${(err as Error).message}`)
        }
      }
    }
  }

  return { close: closeAll, watchFiles: watchMoreFiles }
}

/** Inputs for {@link createChangeQueue}. */
export type ChangeQueueArgs = {
  devOutputDir: string
  configPath: string
  onChange: (configChanged: boolean) => void
  schedule: Schedule
  statMtime?: (absPath: string) => Promise<number | null>
}

/**
 * Collect watch events into one `onChange` call per debounce window, with
 * `configChanged` true when `configPath` was among them. An event whose file
 * still has the mtime seen last time is dropped, because Bun's recursive
 * `fs.watch` on macOS reports reads as well as writes. Any other mtime counts
 * as a change, including an older one from `mv`, `cp -p` or `rsync -a`.
 */
export function createChangeQueue(args: ChangeQueueArgs) {
  const { devOutputDir, configPath, onChange, schedule, statMtime = statFileMtime } = args
  const seenMtimes = new Map<string, number>()
  let dirty = false
  let configChanged = false
  let cancelPending: (() => void) | null = null

  const flush = () => {
    cancelPending = null
    if (!dirty) {
      return
    }
    const changed = configChanged
    dirty = false
    configChanged = false
    onChange(changed)
  }

  const enqueue = async (absPath: string) => {
    if (absPath === devOutputDir || absPath.startsWith(`${devOutputDir}${path.sep}`)) {
      return
    }
    const mtime = await statMtime(absPath)
    if (mtime === null) {
      seenMtimes.delete(absPath)
    } else {
      if (seenMtimes.get(absPath) === mtime) {
        return
      }
      seenMtimes.set(absPath, mtime)
    }
    dirty = true
    configChanged ||= absPath === configPath
    cancelPending?.()
    cancelPending = schedule(flush)
  }

  return {
    enqueue,
    cancel: () => {
      cancelPending?.()
      cancelPending = null
    },
  }
}

const statFileMtime = async (absPath: string): Promise<number | null> => {
  try {
    return (await Bun.file(absPath).stat()).mtimeMs
  } catch {
    return null
  }
}
