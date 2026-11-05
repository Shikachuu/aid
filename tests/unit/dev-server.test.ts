import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AidConfigSchema } from "../../src/core/config"
import { RELOAD_CLIENT_SCRIPT, RELOAD_PATH } from "../../src/dev/reload"
import { type DevServerHandle, serveFile, startDevServer } from "../../src/dev/server"
import type { DevState } from "../../src/dev/state"

let dist: string

beforeEach(async () => {
  dist = await mkdtemp(path.join(tmpdir(), "aid-serve-"))
  await Bun.write(path.join(dist, "index.html"), "home")
  await Bun.write(path.join(dist, "user.schema", "index.html"), "schema page")
  await Bun.write(path.join(dist, "user.schema.json"), "{}")
})

afterEach(async () => {
  await rm(dist, { recursive: true, force: true })
})

describe("serveFile", () => {
  test("serves a route folder's index.html", async () => {
    expect(await (await serveFile(dist, "/")).text()).toBe("home")
  })

  test("serves a file whose name has an extension", async () => {
    expect(await (await serveFile(dist, "/user.schema.json")).text()).toBe("{}")
  })

  test("serves the index.html of a route whose last segment has a dot", async () => {
    expect(await (await serveFile(dist, "/user.schema")).text()).toBe("schema page")
  })

  test("serves an extensionless file that has no route folder", async () => {
    await Bun.write(path.join(dist, "LICENSE"), "MIT")
    expect(await (await serveFile(dist, "/LICENSE")).text()).toBe("MIT")
  })

  test("answers an HTML 404 for a missing file and 400 for a path outside dist", async () => {
    const missing = await serveFile(dist, "/nope.css")
    expect(missing.status).toBe(404)
    expect(missing.headers.get("Content-Type")).toStartWith("text/html")
    expect((await serveFile(dist, "/../etc/passwd")).status).toBe(400)
  })
})

describe("startDevServer", () => {
  let state: DevState
  let server: DevServerHandle
  const url = (p: string) => `http://127.0.0.1:${server.port}${p}`
  const start = (raw: Record<string, unknown> = {}) => {
    server = startDevServer({
      state,
      config: AidConfigSchema.parse({ name: "T", ...raw }),
      host: "127.0.0.1",
      port: 0,
    })
  }

  beforeEach(() => {
    state = {
      currentDir: dist,
      buffers: { a: dist, b: dist },
      errorState: null,
      sseClients: new Set(),
    }
  })

  afterEach(() => {
    server.stop()
  })

  const tag = `<script>${RELOAD_CLIENT_SCRIPT}</script>`

  test("answers 503 with a shell that loads the reload client until the first build lands", async () => {
    state.currentDir = null
    start()
    const res = await fetch(url("/"))
    expect(res.status).toBe(503)
    expect(await res.text()).toContain(tag)
  })

  test("redirects paths outside base_path to the base", async () => {
    start({ base_path: "/docs" })
    const res = await fetch(url("/other"), { redirect: "manual" })
    expect(res.status).toBe(302)
    expect(res.headers.get("Location")).toBe("/docs/")
    expect(await (await fetch(url("/docs"))).text()).toStartWith("home")
  })

  test("injects the reload client before </body>, before </html>, or at the end", async () => {
    await Bun.write(path.join(dist, "body", "index.html"), "<html><body>b</body></html>")
    await Bun.write(path.join(dist, "html", "index.html"), "<html>h</html>")
    start()
    expect(await (await fetch(url("/body/"))).text()).toBe(`<html><body>b${tag}</body></html>`)
    expect(await (await fetch(url("/html/"))).text()).toBe(`<html>h${tag}</html>`)
    expect(await (await fetch(url("/"))).text()).toBe(`home\n${tag}`)
  })

  test("injects before the last </body>, past one inside an inline script", async () => {
    const html = `<html><body><script>let s = "</body>"</script></body></html>`
    await Bun.write(path.join(dist, "inline", "index.html"), html)
    start()
    expect(await (await fetch(url("/inline/"))).text()).toBe(
      `<html><body><script>let s = "</body>"</script>${tag}</body></html>`,
    )
  })

  test("gives a 404 page the reload client so the tab recovers once the page exists", async () => {
    start()
    const res = await fetch(url("/missing/"))
    expect(res.status).toBe(404)
    expect(await res.text()).toContain(tag)
  })

  test("answers 403 to a Host header that is not loopback while bound to loopback", async () => {
    start()
    const rebound = await fetch(url("/"), { headers: { Host: `evil.example:${server.port}` } })
    expect(rebound.status).toBe(403)
    const local = await fetch(url("/"), { headers: { Host: `localhost:${server.port}` } })
    expect(local.status).toBe(200)
  })

  test("serves non-HTML files untouched", async () => {
    start()
    const res = await fetch(url("/user.schema.json"))
    expect(await res.text()).toBe("{}")
  })

  test("answers 400 for a malformed escape or a NUL byte", async () => {
    start()
    expect((await fetch(url("/%E0%A4%A"))).status).toBe(400)
    const nul = await fetch(url("/a%00b"))
    expect(nul.status).toBe(400)
    expect(await nul.text()).toBe("Bad Request")
  })

  test("answers a plain 500 when the handler throws", async () => {
    const error = spyOn(console, "error").mockImplementation(() => {})
    Object.defineProperty(state, "currentDir", {
      get: () => {
        throw new Error("boom")
      },
    })
    start()
    try {
      const res = await fetch(url("/"))
      expect(res.status).toBe(500)
      expect(await res.text()).toBe("Internal Server Error")
      expect(error).toHaveBeenCalledTimes(1)
    } finally {
      error.mockRestore()
    }
  })

  test("replays the last build error to a client that connects later", async () => {
    state.errorState = { message: "boom" }
    start()
    const res = await fetch(url(RELOAD_PATH))
    const reader = (res.body as ReadableStream<Uint8Array>).getReader()
    let text = ""
    while (!text.includes("boom")) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }
      text += new TextDecoder().decode(value)
    }
    await reader.cancel()
    expect(text).toBe(': connected\n\nevent: error-detail\ndata: {"message":"boom"}\n\n')
  })

  test("names the port and the --port flag when the port is taken", () => {
    start()
    const taken = server.port
    expect(() =>
      startDevServer({
        state,
        config: AidConfigSchema.parse({ name: "T" }),
        host: "127.0.0.1",
        port: taken,
      }),
    ).toThrow(
      `aid dev: port ${taken} on 127.0.0.1 is already in use. Pass --port to choose a different one.`,
    )
  })
})
