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
 */

import { resolve } from "node:path"

const ROOT = resolve(import.meta.dir, "..")
const VENDOR = resolve(ROOT, "vendor", "natives")

const PKGS = [
  "lightningcss-darwin-arm64",
  "lightningcss-darwin-x64",
  "lightningcss-linux-arm64-gnu",
  "lightningcss-linux-x64-gnu",
]

for (const pkg of PKGS) {
  const src = resolve(
    ROOT,
    "node_modules",
    pkg,
    `lightningcss.${pkg.slice("lightningcss-".length)}.node`,
  )
  const dst = resolve(VENDOR, `${pkg}.bin`)
  const srcFile = Bun.file(src)
  if (!(await srcFile.exists())) {
    console.warn(`[stage-natives] skip: ${src} not present`)
    continue
  }
  await Bun.write(dst, srcFile)
  console.log(`[stage-natives] ${pkg}.bin (${(srcFile.size / 1024 / 1024).toFixed(1)} MB)`)
}
