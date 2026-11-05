#!/usr/bin/env bun
/**
 * Stage native binaries under `vendor/natives/` with a non-`.node` extension.
 *
 * Bun special-cases the `.node` extension: even with `with { type: "file" }`,
 * an `import` of a `.node` file is forced through the Node-API loader instead
 * of returning the path string. That makes the per-platform lightningcss
 * bindings unembeddable via the static-import pattern we use for buf.
 */

import { resolve } from "node:path"
import { lcssNodeFile, TARGETS } from "./natives"

/** Run after install, so `scripts/compile.ts` can embed every target's lightningcss binding from `vendor/natives/`. */
export const stageNatives = async (root: string): Promise<void> => {
  for (const { lcssSubpkg: pkg } of TARGETS) {
    const src = resolve(root, "node_modules", pkg, lcssNodeFile(pkg))
    const srcFile = Bun.file(src)
    if (!(await srcFile.exists())) {
      console.warn(`[stage-natives] skip: ${src} not present`)
      continue
    }
    await Bun.write(resolve(root, "vendor", "natives", `${pkg}.bin`), srcFile)
    console.log(`[stage-natives] ${pkg}.bin (${(srcFile.size / 1024 / 1024).toFixed(1)} MB)`)
  }
}

if (import.meta.main) {
  await stageNatives(resolve(import.meta.dir, ".."))
}
