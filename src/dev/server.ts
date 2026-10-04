import { extname, resolve } from "node:path"
import type { AidConfig } from "../core/config"
import { RELOAD_CLIENT_SCRIPT, RELOAD_PATH } from "./reload"
import { type DevState, sseFrame } from "./state"

/** Inputs for {@link startDevServer}. */
export type StartDevServerArgs = {
  state: DevState
  config: AidConfig
  host: string
  port: number
}

/** Lets the session read the bound port and stop the server on shutdown. */
export type DevServerHandle = {
  /** Bound port, which differs from the requested one when the caller passes 0. */
  port: number
  stop: () => void
}

/**
 * Long-running Bun.serve handler. Routes `/__aid/reload` to an SSE channel,
 * everything else to a path-traversal-safe lookup under `state.currentDir`.
 * `.html` responses are rewritten on the fly to inject the reload client
 * script. While `state.currentDir` is null, every non-SSE request gets a 503
 * shell that only loads the reload client, which renders the error overlay.
 */
export function startDevServer(args: StartDevServerArgs): DevServerHandle {
  const { state, config, host, port } = args

  let server: ReturnType<typeof Bun.serve>
  try {
    server = Bun.serve({
      port,
      hostname: host,
      // SSE streams stay open indefinitely; the default 10s idle timeout
      // would close them and surface a "network connection was lost" error
      // in the browser.
      idleTimeout: 0,
      fetch: (req) => handle(req, state, config),
    })
  } catch (err) {
    if (isAddrInUse(err)) {
      throw new Error(
        `aid dev: port ${port} on ${host} is already in use. Pass --port to choose a different one.`,
      )
    }
    throw err
  }

  return {
    port: server.port ?? port,
    stop: () => server.stop(true),
  }
}

async function handle(req: Request, state: DevState, config: AidConfig): Promise<Response> {
  const url = new URL(req.url)
  const rawPath = decodeURIComponent(url.pathname)

  if (rawPath === RELOAD_PATH) {
    return openSseStream(state)
  }

  const relative = stripBasePath(rawPath, config.base_path)
  if (relative === null) {
    return Response.redirect(withSlash(config.base_path), 302)
  }

  if (state.currentDir === null) {
    return htmlResponse(BOOTSTRAP_PAGE, 503)
  }

  const res = await serveFile(state.currentDir, relative)
  if (res.headers.get("Content-Type")?.startsWith("text/html")) {
    return htmlResponse(injectReloadScript(await res.text()), res.status)
  }
  return res
}

const BOOTSTRAP_PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>aid dev</title></head><body><script>${RELOAD_CLIENT_SCRIPT}</script></body></html>`

const htmlResponse = (html: string, status: number): Response =>
  new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } })

function openSseStream(state: DevState): Response {
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller
      state.sseClients.add(controller)
      controller.enqueue(new TextEncoder().encode(": connected\n\n"))
      if (state.errorState !== null) {
        controller.enqueue(sseFrame("error-detail", JSON.stringify(state.errorState)))
      }
    },
    cancel() {
      if (controllerRef !== null) {
        state.sseClients.delete(controllerRef)
      }
    },
  })
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

/**
 * Serve `pathname` from `distDir`. Rejects paths that resolve outside
 * `distDir`, and maps directory-style URLs (`/`, `/api/`, `/api`) to their
 * `index.html`.
 */
export async function serveFile(distDir: string, pathname: string): Promise<Response> {
  const candidate = resolve(distDir, `.${pathname}`)
  if (candidate !== distDir && !candidate.startsWith(`${distDir}/`)) {
    return new Response("Bad Request", { status: 400 })
  }
  const target =
    pathname === "/" || pathname.endsWith("/") || extname(pathname) === ""
      ? resolve(candidate, "index.html")
      : candidate
  const file = Bun.file(target)
  if (!(await file.exists())) {
    return new Response("Not Found", { status: 404 })
  }
  return new Response(file)
}

function injectReloadScript(html: string): string {
  const tag = `<script>${RELOAD_CLIENT_SCRIPT}</script>`
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${tag}</body>`)
  }
  if (/<\/html>/i.test(html)) {
    return html.replace(/<\/html>/i, `${tag}</html>`)
  }
  return `${html}\n${tag}`
}

/** Normalize `basePath` to the trailing-slash form that the server redirects to and the session prints. */
export const withSlash = (basePath: string): string =>
  basePath.endsWith("/") ? basePath : `${basePath}/`

function stripBasePath(pathname: string, basePath: string): string | null {
  const norm = withSlash(basePath)
  if (norm === "/") {
    return pathname
  }
  const bare = norm.slice(0, -1)
  if (pathname === bare) {
    return "/"
  }
  if (pathname.startsWith(norm)) {
    return `/${pathname.slice(norm.length)}`
  }
  return null
}

function isAddrInUse(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "EADDRINUSE"
}
