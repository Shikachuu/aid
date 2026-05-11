#!/usr/bin/env bun
/**
 * Stage native binaries under `vendor/natives/` with a non-`.node` extension.
 *
 * Bun special-cases the `.node` extension: even with `with { type: "file" }`,
 * an `import` of a `.node` file is forced through the Node-API loader instead
 * of returning the path string. That makes the per-platform lightningcss
 * bindings unembeddable via the static-import pattern we use for buf.
 *
 * Workaround: copy each platform's `.node` to a sibling `.bin` file under
 * `vendor/natives/`. Code in `src/core/internal/lightningcss-native.ts`
 * imports those `.bin` paths via `with { type: "file" }`, gets path strings
 * in dev, and gets embedded bytes inside the compiled binary. At runtime we
 * write the bytes back out as a real `.node` file and `process.dlopen` it.
 *
 * Wired into the `mise install` postinstall hook so dev runs and
 * cross-compilation see the same staged tree.
 */

import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"

const ROOT = resolve(import.meta.dir, "..")
const VENDOR = resolve(ROOT, "vendor", "natives")

type Stage = {
  /** lightningcss subpackage name (also the staged filename stem). */
  pkg: string
  /** Source file inside the subpackage relative to its root. */
  nodeFile: string
}

const STAGES: readonly Stage[] = [
  { pkg: "lightningcss-darwin-arm64", nodeFile: "lightningcss.darwin-arm64.node" },
  { pkg: "lightningcss-darwin-x64", nodeFile: "lightningcss.darwin-x64.node" },
  { pkg: "lightningcss-linux-arm64-gnu", nodeFile: "lightningcss.linux-arm64-gnu.node" },
  { pkg: "lightningcss-linux-x64-gnu", nodeFile: "lightningcss.linux-x64-gnu.node" },
]

await mkdir(VENDOR, { recursive: true })

for (const stage of STAGES) {
  const src = resolve(ROOT, "node_modules", stage.pkg, stage.nodeFile)
  const dst = resolve(VENDOR, `${stage.pkg}.bin`)
  const srcFile = Bun.file(src)
  if (!(await srcFile.exists())) {
    console.warn(`[stage-natives] skip: ${src} not present`)
    continue
  }
  await Bun.write(dst, srcFile)
  const size = (await srcFile.stat()).size
  console.log(`[stage-natives] ${stage.pkg}.bin (${(size / 1024 / 1024).toFixed(1)} MB)`)
}
