import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { rebuild, serializeRuns } from "../../src/dev/loop"
import { startDevServer } from "../../src/dev/server"
import { endSession } from "../../src/dev/session"
import { broadcast, type DevState } from "../../src/dev/state"
import type { BuildContext } from "../../src/core/types"
import { AidConfigSchema } from "../../src/core/config"
import { makeSite } from "../helpers"

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-dev-loop-"))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

const newState = (): DevState => ({
  currentDir: null,
  buffers: { a: path.join(cwd, ".aid/dev/build-a"), b: path.join(cwd, ".aid/dev/build-b") },
  errorState: null,
  sseClients: new Set(),
})

const recordEvents = (state: DevState): string[] => {
  const events: string[] = []
  state.sseClients.add({
    enqueue: (frame: Uint8Array) => {
      events.push(/^event: (.*)$/m.exec(new TextDecoder().decode(frame))?.[1] ?? "")
    },
  } as unknown as ReadableStreamDefaultController<Uint8Array>)
  return events
}

const writePage = (ctx: BuildContext, body: string) =>
  Bun.write(path.join(ctx.contentDir, "index.md"), body)

describe("rebuild", () => {
  test("alternates between the two buffers and reloads the browser", async () => {
    const ctx = await makeSite(cwd)
    await writePage(ctx, "# Home\n")
    const state = newState()
    const events = recordEvents(state)

    expect((await rebuild(state, ctx)).ok).toBe(true)
    expect(state.currentDir).toBe(state.buffers.a)
    expect(await Bun.file(path.join(state.buffers.a, "index.html")).exists()).toBe(true)

    expect((await rebuild(state, ctx)).ok).toBe(true)
    expect(state.currentDir).toBe(state.buffers.b)
    expect(events).toEqual(["clear-error", "reload", "clear-error", "reload"])
  })

  test("keeps serving the last good build after a failure, then clears the error before reloading", async () => {
    const ctx = await makeSite(cwd)
    await writePage(ctx, "# Home\n")
    const state = newState()
    await rebuild(state, ctx)
    const good = state.currentDir
    const events = recordEvents(state)

    await writePage(ctx, "# Home\n\n[Gone](./gone.md)\n")
    const failed = await rebuild(state, ctx)
    expect(failed.ok).toBe(false)
    expect(state.currentDir).toBe(good)
    expect(state.errorState?.message).toContain("broken reference")
    expect(events).toEqual(["error-detail"])

    await writePage(ctx, "# Home\n")
    expect((await rebuild(state, ctx)).ok).toBe(true)
    expect(state.errorState).toBeNull()
    expect(events).toEqual(["error-detail", "clear-error", "reload"])
  })

  test("reports the files the stylesheet imports", async () => {
    const ctx = await makeSite(cwd)
    await writePage(ctx, "# Home\n")
    const partial = path.join(cwd, "partials", "brand.css")
    await Bun.write(partial, "@theme { --color-brand: oklch(50% 0.1 200); }\n")
    await Bun.write(
      path.join(cwd, "main.css"),
      '@import "tailwindcss";\n@import "aid/theme";\n@import "./partials/brand.css";\n',
    )
    const result = await rebuild(newState(), ctx)
    expect(result.ok && result.stylesheetDependencies).toContain(partial)
  })
})

describe("serializeRuns", () => {
  test("runs one call at a time and collapses calls made meanwhile into one more run", async () => {
    let runs = 0
    let release = () => {}
    const run = serializeRuns(async () => {
      runs++
      await new Promise<void>((resolve) => {
        release = resolve
      })
    })
    const first = run()
    void run()
    void run()
    expect(runs).toBe(1)
    release()
    await Bun.sleep(0)
    expect(runs).toBe(2)
    release()
    await first
    expect(runs).toBe(2)
  })

  test("accepts new runs after a run throws", async () => {
    let runs = 0
    const run = serializeRuns(async () => {
      runs++
      throw new Error("boom")
    })
    await expect(run()).rejects.toThrow("boom")
    await expect(run()).rejects.toThrow("boom")
    expect(runs).toBe(2)
  })
})

describe("broadcast", () => {
  test("drops clients whose stream has closed", () => {
    const state = newState()
    const events = recordEvents(state)
    state.sseClients.add({
      enqueue: () => {
        throw new TypeError("closed")
      },
    } as unknown as ReadableStreamDefaultController<Uint8Array>)
    broadcast(state, "reload", "")
    expect(events).toEqual(["reload"])
    expect(state.sseClients.size).toBe(1)
  })
})

describe("endSession", () => {
  test("delivers the message to open tabs before the server stops", async () => {
    const state = newState()
    state.currentDir = cwd
    const server = startDevServer({
      state,
      config: AidConfigSchema.parse({ name: "T" }),
      host: "127.0.0.1",
      port: 0,
    })
    const res = await fetch(`http://127.0.0.1:${server.port}/__aid/reload`)
    const body = res.text()
    while (state.sseClients.size === 0) {
      await Bun.sleep(1)
    }
    await endSession(state, server, "aid.yaml changed.")
    expect(await body).toBe(
      ': connected\n\nevent: error-detail\ndata: {"message":"aid.yaml changed."}\n\n',
    )
    await expect(fetch(`http://127.0.0.1:${server.port}/`)).rejects.toThrow()
  })
})
