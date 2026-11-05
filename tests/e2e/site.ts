import { cp, mkdir, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { Server } from "bun"
import { type Browser, type BrowserContext, chromium, type Page } from "playwright"
import { loadBuildContext } from "../../src/core/config"
import { build } from "../../src/core/pipeline"
import { serveFile } from "../../src/dev/server"

export const E2E = process.env.AID_E2E === "1"

if (!E2E) {
  console.log("[e2e] skipped: run `bun run test:e2e` for the Playwright browser tests")
}

export const BASE_PATH = "/e2e"

// Mermaid first inserts an empty measuring svg, so wait for a rendered node.
export const MERMAID_NODE = "pre.mermaid svg g.node, div.mermaid svg g.node"

export const SCREENSHOT_DIR = path.join(import.meta.dir, "__screenshots__")

export const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 375, height: 812 },
} as const

export type ViewportName = keyof typeof VIEWPORTS
export type Scheme = "light" | "dark"

const FIXTURE_DIR = path.join(import.meta.dir, "../fixtures/sample-site")

const MANUAL_DARK_CSS = `
@media (prefers-color-scheme: dark) {
  :root {
    --color-aid-bg: oklch(18% 0.01 250);
    --color-aid-text: oklch(92% 0 0);
    --color-aid-muted: oklch(65% 0 0);
    --color-aid-border: oklch(30% 0 0);
    --color-aid-accent: oklch(75% 0.13 175);
  }
}
`

export type DarkMode = "auto" | "manual" | "off"

export type BuiltSite = {
  origin: string
  url: (route: string) => string
  close: () => Promise<void>
}

export async function buildSite(darkMode: DarkMode): Promise<BuiltSite> {
  const cwd = await mkdtemp(path.join(tmpdir(), `aid-e2e-${darkMode}-`))
  await cp(FIXTURE_DIR, cwd, { recursive: true, filter: (src) => path.basename(src) !== "dist" })
  const configPath = path.join(cwd, "aid.yaml")
  const config = await Bun.file(configPath).text()
  await Bun.write(
    configPath,
    `${config}\nbase_path: "${BASE_PATH}"\ntheme:\n  dark_mode: ${darkMode}\n`,
  )
  if (darkMode === "manual") {
    const cssPath = path.join(cwd, "main.css")
    await Bun.write(cssPath, `${await Bun.file(cssPath).text()}${MANUAL_DARK_CSS}`)
  }

  const ctx = await loadBuildContext(cwd, "aid.yaml")
  await build(ctx)
  const server = serveDir(ctx.outputDir)
  const origin = `http://127.0.0.1:${server.port}`
  return {
    origin,
    url: (route) => `${origin}${BASE_PATH}/${route}`,
    close: async () => {
      await server.stop(true)
      await rm(cwd, { recursive: true, force: true })
    },
  }
}

function serveDir(distDir: string): Server<undefined> {
  return Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: (req) => {
      const pathname = decodeURIComponent(new URL(req.url).pathname)
      if (pathname !== BASE_PATH && !pathname.startsWith(`${BASE_PATH}/`)) {
        return new Response("Not Found", { status: 404 })
      }
      return serveFile(distDir, pathname.slice(BASE_PATH.length) || "/")
    },
  })
}

export function launchBrowser(): Promise<Browser> {
  return chromium.launch()
}

export async function openPage(
  browser: Browser,
  viewport: ViewportName,
  scheme: Scheme,
): Promise<{ context: BrowserContext; page: Page; errors: Error[] }> {
  const context = await browser.newContext({ viewport: VIEWPORTS[viewport], colorScheme: scheme })
  const page = await context.newPage()
  const errors: Error[] = []
  page.on("pageerror", (err) => errors.push(err))
  return { context, page, errors }
}

export async function screenshot(page: Page, name: string): Promise<void> {
  await mkdir(SCREENSHOT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true })
}

export function computedColor(
  page: Page,
  selector: string,
  property: "backgroundColor" | "fill" | "color",
): Promise<[number, number, number]> {
  return page.evaluate(
    ([sel, prop]) => {
      const el = document.querySelector(sel)
      const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
      if (!el || !probe) {
        throw new Error(`no element for ${sel} or no 2d canvas context`)
      }
      probe.fillStyle = getComputedStyle(el)[prop]
      probe.fillRect(0, 0, 1, 1)
      const [r = 0, g = 0, b = 0] = probe.getImageData(0, 0, 1, 1).data
      return [r, g, b] as [number, number, number]
    },
    [selector, property] as const,
  )
}

export const luminance = ([r, g, b]: [number, number, number]): number =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
