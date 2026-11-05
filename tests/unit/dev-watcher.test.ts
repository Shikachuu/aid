import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createChangeQueue, type Schedule, watchContent } from "../../src/dev/watcher"
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
      ignoreRoot: "/site/.aid",
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

  test("cancel drops the pending report", async () => {
    const { queue, reports, flush } = setup({ "/site/docs/a.md": 1 })
    await queue.enqueue("/site/docs/a.md")
    queue.cancel()
    flush()
    expect(reports).toEqual([])
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
})
