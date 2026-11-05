import { existsSync, type FSWatcher, watch } from "node:fs"
import path from "node:path"
import type { BuildContext } from "../core/types"

/** What `aid dev` keeps after starting the watcher: a way to stop it and to watch the stylesheet partials a rebuild reports. */
export type WatchHandle = {
  close: () => void
  watchFiles: (files: Iterable<string>) => void
}

/** Runs `fn` after the debounce window and returns a function that cancels it. Tests pass one that runs at once. */
export type Schedule = (fn: () => void) => () => void

const DEBOUNCE_MS = 100

const MAX_WAIT_MS = 1000

const EMBEDDED_PREFIX = "/$bunfs/"

const PERMISSION_ERRORS = new Set(["EACCES", "EPERM"])

const IGNORED_SEGMENTS = new Set([".git", "node_modules"])

const debounce: Schedule = (fn) => {
  const timer = setTimeout(fn, DEBOUNCE_MS)
  return () => clearTimeout(timer)
}

/**
 * Watch the content, static and templates dirs, the config file at
 * `configPath`, and `files`. Stylesheet `@import` partials join later through
 * `watchFiles`. A single file is watched through its parent dir, so an
 * atomic-rename save or a file created after start still reports. A dir that
 * does not exist yet is watched through its nearest existing ancestor, and a
 * content, static or templates dir that is created or recreated gets a fresh
 * recursive watch. Any watch error other than ENOENT, such as EMFILE, throws.
 * See {@link createChangeQueue} for the event filters.
 */
export function watchContent(
  ctx: BuildContext,
  configPath: string,
  files: readonly string[],
  onChange: (configChanged: boolean) => void,
  schedule: Schedule = debounce,
): WatchHandle {
  const queue = createChangeQueue({
    isIgnored: ignoredIn(ctx),
    configPath,
    onChange,
    schedule,
  })
  const watchers = new Set<FSWatcher>()
  const roots = new Map<string, FSWatcher | null>()
  const fileDirs = new Map<string, Set<string>>()
  const missingDirs = new Map<string, Set<string>>()
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
    onName: (name: string) => void,
  ): FSWatcher | null => {
    try {
      const watcher = watch(target, { recursive }, (_event, name) => {
        if (name) {
          onName(name.toString())
        }
      })
      watchers.add(watcher)
      return watcher
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err
      }
      return null
    }
  }

  const armRoot = (dir: string) => {
    const previous = roots.get(dir)
    if (previous) {
      previous.close()
      watchers.delete(previous)
    }
    roots.set(
      dir,
      tryWatch(dir, true, (name) => void queue.enqueue(path.join(dir, name))),
    )
  }

  const noticeCreated = (target: string) => {
    if (closed || !existsSync(target)) {
      return
    }
    if (roots.has(target)) {
      armRoot(target)
    }
    const waiting = missingDirs.get(target)
    if (waiting === undefined) {
      return
    }
    missingDirs.delete(target)
    watchFiles(waiting)
    for (const file of waiting) {
      noticeCreated(file)
      if (existsSync(file)) {
        void queue.enqueue(file)
      }
    }
  }

  const reportUnwatchable = (file: string, dir: string, err: unknown) => {
    if (PERMISSION_ERRORS.has((err as NodeJS.ErrnoException).code ?? "")) {
      unwatchableDirs.add(dir)
    }
    if (!reportedDirs.has(dir)) {
      reportedDirs.add(dir)
      console.error(`[aid] cannot watch ${file}: ${(err as Error).message}`)
    }
  }

  const onDirEntry = (dir: string, name: string) => {
    const changed = path.join(dir, name)
    try {
      noticeCreated(changed)
    } catch (err) {
      reportUnwatchable(changed, changed, err)
    }
    void queue.enqueue(changed)
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
      const onName = (name: string) => {
        if (watched.has(name)) {
          onDirEntry(dir, name)
        }
      }
      if (tryWatch(dir, false, onName)) {
        fileDirs.set(dir, watched)
        continue
      }
      const waiting = missingDirs.get(dir)
      if (waiting !== undefined) {
        waiting.add(file)
      } else if (dir !== path.dirname(dir)) {
        missingDirs.set(dir, new Set([file]))
        watchFiles([dir])
      }
    }
  }

  try {
    for (const dir of [ctx.contentDir, ctx.staticDir, ctx.templatesDir]) {
      if (dir !== null) {
        armRoot(dir)
        if (dir !== ctx.cwd) {
          watchFiles([dir])
        }
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
        reportUnwatchable(file, dir, err)
      }
    }
  }

  return { close: closeAll, watchFiles: watchMoreFiles }
}

/**
 * Match the paths whose events never change the site: the dev output dir
 * `.aid`, and `.git` and `node_modules` below the project. They show up when
 * `dir.content` is `.`, because the recursive watch then covers the whole
 * project. `dir.output` cannot sit inside an input dir, so it needs no rule.
 */
export function ignoredIn(ctx: BuildContext): (absPath: string) => boolean {
  const devOutputDir = path.join(ctx.cwd, ".aid")
  return (absPath) =>
    absPath === devOutputDir ||
    absPath.startsWith(`${devOutputDir}${path.sep}`) ||
    path
      .relative(ctx.cwd, absPath)
      .split(path.sep)
      .some((segment) => IGNORED_SEGMENTS.has(segment))
}

/** Inputs for {@link createChangeQueue}. */
export type ChangeQueueArgs = {
  isIgnored: (absPath: string) => boolean
  configPath: string
  onChange: (configChanged: boolean) => void
  schedule: Schedule
  statMtime?: (absPath: string) => Promise<number | null>
  now?: () => number
}

/**
 * Collect watch events into one `onChange` call per debounce window, with
 * `configChanged` true when `configPath` was among them. A steady stream of
 * events, such as a long copy, still reports once `MAX_WAIT_MS` has passed
 * since the window opened. An event whose file still has the mtime seen last
 * time is dropped. Any other mtime counts as a change, including an older one
 * from `mv`, `cp -p` or `rsync -a`.
 */
export function createChangeQueue(args: ChangeQueueArgs) {
  const {
    isIgnored,
    configPath,
    onChange,
    schedule,
    statMtime = statFileMtime,
    now = performance.now.bind(performance),
  } = args
  const seenMtimes = new Map<string, number>()
  let dirty = false
  let configChanged = false
  let cancelPending: (() => void) | null = null
  let windowStart = 0

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

  const isStaleEvent = async (absPath: string): Promise<boolean> => {
    const mtime = await statMtime(absPath)
    if (mtime === null) {
      seenMtimes.delete(absPath)
      return false
    }
    if (seenMtimes.get(absPath) === mtime) {
      return true
    }
    seenMtimes.set(absPath, mtime)
    return false
  }

  const enqueue = async (absPath: string) => {
    if (isIgnored(absPath) || (await isStaleEvent(absPath))) {
      return
    }
    dirty = true
    configChanged ||= absPath === configPath
    const time = now()
    if (cancelPending === null) {
      windowStart = time
    } else if (time - windowStart >= MAX_WAIT_MS) {
      return
    } else {
      cancelPending()
    }
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
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`[aid] cannot stat ${absPath}: ${(err as Error).message}`)
    }
    return null
  }
}
