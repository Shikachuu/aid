import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { chmodSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createChangeQueue, ignoredIn, type Schedule, watchContent } from "../../src/dev/watcher"
import { makeCtx } from "../helpers"

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "aid-watch-"))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const ctx = () => makeCtx(dir, { dir: { templates: "templates" } })

const immediate: Schedule = (fn) => {
  queueMicrotask(fn)
  return () => {}
}

/**
 * Collects watcher reports. `until(act)` repeats `act` until a new report
 * arrives, because the OS may deliver the first event before or after the
 * watch is armed.
 */
function reporter() {
  const reports: boolean[] = []
  let next = Promise.withResolvers<boolean>()
  const onChange = (configChanged: boolean) => {
    reports.push(configChanged)
    next.resolve(true)
  }
  const until = async (act: (attempt: number) => Promise<unknown>) => {
    next = Promise.withResolvers<boolean>()
    for (let i = 0; i < 20; i++) {
      await act(i)
      if (await Promise.race([next.promise, Bun.sleep(100)])) {
        return reports
      }
    }
    throw new Error("watcher never reported the change")
  }
  return { onChange, until }
}

describe("createChangeQueue", () => {
  const setup = (mtimes: Record<string, number | null>) => {
    const reports: boolean[] = []
    let pending: (() => void) | null = null
    const queue = createChangeQueue({
      isIgnored: (p) => p.startsWith("/site/.aid"),
      configPath: "/site/aid.yaml",
      onChange: (configChanged) => reports.push(configChanged),
      schedule: (fn) => {
        pending = fn
        return () => {
          pending = null
        }
      },
      statMtime: async (p) => mtimes[p] ?? null,
    })
    const flush = () => pending?.()
    return { queue, reports, flush, mtimes }
  }

  test("collapses the events of one window into one report", async () => {
    const { queue, reports, flush } = setup({ "/site/docs/a.md": 1, "/site/docs/b.md": 1 })
    await queue.enqueue("/site/docs/a.md")
    await queue.enqueue("/site/docs/b.md")
    flush()
    expect(reports).toEqual([false])
  })

  test("flags a window that contains the config file", async () => {
    const { queue, reports, flush } = setup({ "/site/docs/a.md": 1, "/site/aid.yaml": 1 })
    await queue.enqueue("/site/docs/a.md")
    await queue.enqueue("/site/aid.yaml")
    flush()
    await queue.enqueue("/site/docs/a.md")
    flush()
    expect(reports).toEqual([true])
  })

  test("drops events under the ignore root", async () => {
    const { queue, reports, flush } = setup({ "/site/.aid/dev/x.html": 1, "/site/.aid": 1 })
    await queue.enqueue("/site/.aid/dev/x.html")
    await queue.enqueue("/site/.aid")
    flush()
    expect(reports).toEqual([])
  })

  test("drops an event only when the mtime is unchanged", async () => {
    const { queue, reports, flush, mtimes } = setup({ "/site/docs/a.md": 5 })
    await queue.enqueue("/site/docs/a.md")
    flush()
    await queue.enqueue("/site/docs/a.md")
    flush()
    expect(reports).toEqual([false])

    mtimes["/site/docs/a.md"] = 3
    await queue.enqueue("/site/docs/a.md")
    flush()
    mtimes["/site/docs/a.md"] = null
    await queue.enqueue("/site/docs/a.md")
    flush()
    expect(reports).toEqual([false, false, false])
  })

  test("stops pushing the report back once the window is a second old", async () => {
    const clock = { now: 0 }
    let mtime = 0
    let cancels = 0
    const queue = createChangeQueue({
      isIgnored: () => false,
      configPath: "/site/aid.yaml",
      onChange: () => {},
      schedule: () => () => cancels++,
      statMtime: async () => ++mtime,
      now: () => clock.now,
    })
    for (const time of [0, 500, 999, 1000, 1500]) {
      clock.now = time
      await queue.enqueue("/site/docs/a.md")
    }
    expect(cancels).toBe(2)
  })

  test("cancel drops the pending report", async () => {
    const { queue, reports, flush } = setup({ "/site/docs/a.md": 1 })
    await queue.enqueue("/site/docs/a.md")
    queue.cancel()
    flush()
    expect(reports).toEqual([])
  })
})

describe("ignoredIn", () => {
  test("ignores .aid, .git and node_modules inside the project only", () => {
    const ignored = ignoredIn(makeCtx(dir))
    expect(ignored(join(dir, ".aid", "dev", "index.html"))).toBe(true)
    expect(ignored(join(dir, ".git", "index"))).toBe(true)
    expect(ignored(join(dir, "pkg", "node_modules", "x.md"))).toBe(true)
    expect(ignored(join(dir, "guide", "index.md"))).toBe(false)
    expect(ignored(join(dir, ".aidrc.md"))).toBe(false)
    expect(
      ignoredIn(makeCtx(join(dir, "node_modules", "site")))(
        join(dir, "node_modules", "site", "docs", "a.md"),
      ),
    ).toBe(false)
  })
})

describe("watchContent", () => {
  test("skips inputs whose folder does not exist", () => {
    expect(() =>
      watchContent(
        ctx(),
        join(dir, "aid.yaml"),
        [join(dir, "nope", "missing.css")],
        () => {},
      ).close(),
    ).not.toThrow()
  })

  test("throws watch errors other than ENOENT", async () => {
    await Bun.write(join(dir, "file"), "")
    expect(() =>
      watchContent(
        makeCtx(dir, { dir: { content: "file/docs" } }),
        join(dir, "aid.yaml"),
        [],
        () => {},
      ),
    ).toThrow(expect.objectContaining({ code: "ENOTDIR" }))
  })

  test("reports a change to the config file it was given", async () => {
    mkdirSync(join(dir, "docs"))
    const configPath = join(dir, "custom.yml")
    await Bun.write(configPath, "title: a\n")
    const r = reporter()
    const handle = watchContent(ctx(), configPath, [], r.onChange, immediate)
    try {
      expect(await r.until((i) => Bun.write(configPath, `title: ${i}\n`))).toContain(true)
    } finally {
      handle.close()
    }
  })

  test("keeps reporting a stylesheet after an atomic-rename save", async () => {
    const css = join(dir, "main.css")
    await Bun.write(css, "a{}")
    let saves = 0
    const save = async () => {
      const tmp = join(dir, `.main.css.${++saves}.tmp`)
      await Bun.write(tmp, `a{--i:${saves}}`)
      renameSync(tmp, css)
    }
    const r = reporter()
    const handle = watchContent(ctx(), join(dir, "aid.yaml"), [css], r.onChange, immediate)
    try {
      await r.until(save)
      const before = (await r.until(save)).length
      expect(before).toBeGreaterThanOrEqual(2)
      await r.until(() => Bun.write(css, `a{--i:${++saves}}`))
    } finally {
      handle.close()
    }
  })

  test("reports a stylesheet created after start and files added with watchFiles", async () => {
    const css = join(dir, "main.css")
    const partial = join(dir, "partials", "brand.css")
    mkdirSync(join(dir, "partials"))
    const r = reporter()
    const handle = watchContent(ctx(), join(dir, "aid.yaml"), [css], r.onChange, immediate)
    try {
      await r.until((i) => Bun.write(css, `a{--i:${i}}`))
      handle.watchFiles([partial])
      await r.until((i) => Bun.write(partial, `b{--i:${i}}`))
    } finally {
      handle.close()
    }
  })

  test("watches a partial whose folder is created after start", async () => {
    const partial = join(dir, "new", "deep", "brand.css")
    const r = reporter()
    const handle = watchContent(ctx(), join(dir, "aid.yaml"), [], r.onChange, immediate)
    try {
      handle.watchFiles([partial])
      await r.until(async (i) => {
        mkdirSync(join(dir, "new", "deep"), { recursive: true })
        await Bun.write(partial, `b{--i:${i}}`)
      })
      const before = (await r.until((i) => Bun.write(partial, `b{--j:${i}}`))).length
      expect((await r.until((i) => Bun.write(partial, `b{--k:${i}}`))).length).toBeGreaterThan(
        before,
      )
    } finally {
      handle.close()
    }
  })

  test("watches a content dir that is created or recreated after start", async () => {
    const docs = join(dir, "docs")
    const r = reporter()
    const handle = watchContent(ctx(), join(dir, "aid.yaml"), [], r.onChange, immediate)
    try {
      await r.until(async () => mkdirSync(docs, { recursive: true }))
      await r.until((i) => Bun.write(join(docs, "guide", "a.md"), `# ${i}\n`))
      rmSync(docs, { recursive: true })
      await r.until(async () => mkdirSync(docs, { recursive: true }))
      await r.until((i) => Bun.write(join(docs, "guide", "b.md"), `# ${i}\n`))
    } finally {
      handle.close()
    }
  })

  test.skipIf(process.getuid?.() === 0)(
    "keeps watching when a partial's folder cannot be watched, and logs each folder once",
    async () => {
      const css = join(dir, "main.css")
      const locked = join(dir, "locked")
      mkdirSync(locked)
      chmodSync(locked, 0o000)
      const error = spyOn(console, "error").mockImplementation(() => {})
      const r = reporter()
      const handle = watchContent(ctx(), join(dir, "aid.yaml"), [css], r.onChange, immediate)
      try {
        const partials = ["/$bunfs/root/theme.css", join(locked, "a.css"), join(locked, "b.css")]
        handle.watchFiles(partials)
        handle.watchFiles(partials)
        expect(error).toHaveBeenCalledTimes(1)
        expect(String(error.mock.calls[0]?.[0])).toContain(`cannot watch ${join(locked, "a.css")}`)
        await r.until((i) => Bun.write(css, `a{--i:${i}}`))
      } finally {
        error.mockRestore()
        chmodSync(locked, 0o700)
        handle.close()
      }
    },
  )

  test.skipIf(process.getuid?.() === 0)(
    "logs instead of crashing when a missing partial's folder appears unreadable",
    async () => {
      const css = join(dir, "main.css")
      const later = join(dir, "later")
      const error = spyOn(console, "error").mockImplementation(() => {})
      const r = reporter()
      const handle = watchContent(ctx(), join(dir, "aid.yaml"), [css], r.onChange, immediate)
      try {
        handle.watchFiles([join(later, "a.css")])
        mkdirSync(later, { mode: 0o000 })
        for (let i = 0; i < 250 && error.mock.calls.length === 0; i++) {
          await Bun.sleep(20)
        }
        if (error.mock.calls.length === 0) {
          throw new Error(`no "cannot watch" report within 5 s of creating ${later}`)
        }
        expect(String(error.mock.calls[0]?.[0])).toContain(`cannot watch ${later}:`)
        await r.until((i) => Bun.write(css, `a{--i:${i}}`))
      } finally {
        error.mockRestore()
        if (existsSync(later)) {
          chmodSync(later, 0o700)
        }
        handle.close()
      }
    },
  )
})
