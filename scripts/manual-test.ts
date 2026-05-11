#!/usr/bin/env bun

import { extname, resolve } from "node:path"

const ROOT = resolve(import.meta.dir, "..")

const buildBinary = Bun.spawn(["bun", "run", "build"], {
  stdout: "inherit",
  stderr: "inherit",
  cwd: ROOT,
})

const buildExit = await buildBinary.exited

if (buildExit !== 0) {
  console.error(`[build-binary] build failed (exit ${buildExit})`)
  process.exit(buildExit)
}

const OS = process.platform === "darwin" ? "darwin" : "linux"
const ARCH = process.arch === "arm64" ? "arm64" : "x64"
const PLATFORM_BINARY = resolve(ROOT, "dist", "bin", `aid-${OS}-${ARCH}`)
const SAMPLE_PROJECT = resolve(ROOT, "tests", "fixtures", "sample-site")

console.log(`[aid] building sample project: ${SAMPLE_PROJECT}`)

const buildSample = Bun.spawn([PLATFORM_BINARY, "build"], {
  stdout: "inherit",
  stderr: "inherit",
  cwd: SAMPLE_PROJECT,
})

const sampleExit = await buildSample.exited

if (sampleExit !== 0) {
  console.error(`[aid] build failed (exit ${sampleExit})`)
}

console.log(`[server] running static file server for sample project ${SAMPLE_PROJECT}/dist`)

const DIST = resolve(SAMPLE_PROJECT, "dist")

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const pathname = decodeURIComponent(new URL(req.url).pathname)
    // Block path traversal — reject anything that escapes DIST after resolving.
    const candidate = resolve(DIST, `.${pathname}`)
    if (candidate !== DIST && !candidate.startsWith(`${DIST}/`)) {
      return new Response("Bad Request", { status: 400 })
    }
    // Directory-style URLs (`/`, `/api/`, `/api`) serve `index.html`. Files
    // with a known extension (.css, .js, .svg, …) serve the file itself.
    const target =
      pathname === "/" || pathname.endsWith("/") || extname(pathname) === ""
        ? resolve(candidate, "index.html")
        : candidate
    const file = Bun.file(target)
    if (!(await file.exists())) {
      return new Response("Not Found", { status: 404 })
    }
    return new Response(file)
  },
})

console.log(`[server] listening on http://localhost:${server.port}/`)
