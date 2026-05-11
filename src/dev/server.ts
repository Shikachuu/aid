import { extname, resolve } from "node:path"
import type { AidConfig } from "../core/config"
import { RELOAD_CLIENT_SCRIPT, RELOAD_PATH } from "./reload"
import { type DevState, serializeError } from "./state"

export type StartDevServerArgs = {
  state: DevState
  config: AidConfig
  host: string
  port: number
}

export type DevServerHandle = {
  /** Resolved listening port (useful when callers ask for a random one). */
  port: number
  stop: () => void
}

/**
 * Long-running Bun.serve handler. Routes `/__aid/reload` to an SSE channel,
 * everything else to a path-traversal-safe lookup under `state.currentDir`.
 * `.html` responses are rewritten on the fly to inject the reload client
 * script. If `state.currentDir` is null and a build error is present, every
 * non-SSE request renders a minimal HTML page that hosts the error overlay.
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

  if (rawPath === RELOAD_PATH) return openSseStream(state)

  const relative = stripBasePath(rawPath, config.base_path)
  if (relative === null) {
    const target = normalizeBasePath(config.base_path)
    return Response.redirect(target, 302)
  }

  if (state.currentDir === null) {
    return new Response(errorBootstrapPage(state), {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  }

  return serveFile(state.currentDir, relative)
}

function openSseStream(state: DevState): Response {
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller
      state.sseClients.add(controller)
      controller.enqueue(new TextEncoder().encode(": connected\n\n"))
      if (state.errorState !== null) {
        const frame = `event: error-detail\ndata: ${serializeError(state.errorState)}\n\n`
        controller.enqueue(new TextEncoder().encode(frame))
      }
    },
    cancel() {
      if (controllerRef !== null) state.sseClients.delete(controllerRef)
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

async function serveFile(distDir: string, pathname: string): Promise<Response> {
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
  if (target.endsWith(".html")) {
    const html = await file.text()
    return new Response(injectReloadScript(html), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  }
  return new Response(file)
}

function injectReloadScript(html: string): string {
  const tag = `<script>${RELOAD_CLIENT_SCRIPT}</script>`
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${tag}</body>`)
  if (/<\/html>/i.test(html)) return html.replace(/<\/html>/i, `${tag}</html>`)
  return `${html}\n${tag}`
}

function stripBasePath(pathname: string, basePath: string): string | null {
  const norm = basePath.endsWith("/") ? basePath : `${basePath}/`
  if (norm === "/") return pathname
  const bare = norm.slice(0, -1)
  if (pathname === bare) return "/"
  if (pathname.startsWith(norm)) return `/${pathname.slice(norm.length)}`
  return null
}

function normalizeBasePath(basePath: string): string {
  return basePath.endsWith("/") ? basePath : `${basePath}/`
}

function errorBootstrapPage(state: DevState): string {
  const message =
    state.errorState === null ? "aid dev: build in progress…" : state.errorState.message
  const file = state.errorState?.file ?? ""
  const stack = state.errorState?.stack ?? ""
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>aid dev: build failed</title></head>
<body style="margin:0;background:#141418;color:#fafafa;font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;padding:32px;">
<div style="font:600 18px/1.3 ui-sans-serif,system-ui,sans-serif;color:#ff6b6b;margin-bottom:12px;">aid: build failed</div>
${file ? `<div style="color:#a1a1aa;margin-bottom:12px;">${escapeHtml(file)}</div>` : ""}
<div style="white-space:pre-wrap;margin-bottom:16px;">${escapeHtml(message)}</div>
${stack ? `<pre style="white-space:pre-wrap;color:#a1a1aa;font-size:12px;">${escapeHtml(stack)}</pre>` : ""}
<script>${RELOAD_CLIENT_SCRIPT}</script>
</body></html>`
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function isAddrInUse(err: unknown): boolean {
  if (err === null || typeof err !== "object") return false
  const code = (err as { code?: unknown }).code
  return code === "EADDRINUSE"
}
