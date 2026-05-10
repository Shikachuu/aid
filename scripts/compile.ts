#!/usr/bin/env bun
/**
 * Per-target compile: bun build --compile across all 6 release targets.
 *
 * Stub — fills out once the CLI is feature-complete enough to compile.
 */

const TARGETS = [
  "bun-darwin-x64",
  "bun-darwin-arm64",
  "bun-linux-x64",
  "bun-linux-arm64",
  "bun-windows-x64",
  "bun-windows-arm64",
] as const

for (const target of TARGETS) {
  const outname = target.replace(/^bun-/, "aid-") + (target.includes("windows") ? ".exe" : "")
  console.log(`[compile] would build ${target} → dist/bin/${outname}`)
  // Real impl:
  //   await Bun.$`bun build --compile --target=${target} --outfile=dist/bin/${outname} ./src/cli/index.ts`;
}
