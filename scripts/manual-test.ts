#!/usr/bin/env bun

import { resolve } from "node:path"
import { serveFile } from "../src/dev/server"

const ROOT = resolve(import.meta.dir, "..")

const buildBinary = Bun.spawn([process.execPath, "run", "build"], {
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
  process.exit(sampleExit)
}

console.log(`[server] running static file server for sample project ${SAMPLE_PROJECT}/dist`)

const DIST = resolve(SAMPLE_PROJECT, "dist")

const server = Bun.serve({
  port: 3000,
  fetch: (req) => serveFile(DIST, decodeURIComponent(new URL(req.url).pathname)),
})

console.log(`[server] listening on http://localhost:${server.port}/`)
