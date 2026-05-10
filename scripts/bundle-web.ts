#!/usr/bin/env bun
/**
 * Bundle the browser-side glue (`src/web/`) into a single ESM module emitted
 * to `dist/web/aid-web.js`. The compiled-binary build picks this up via a
 * `with { type: "file" }` import and serves it from the in-binary FS.
 *
 * Stub. Real impl lands once the browser code is non-trivial.
 */
const result = await Bun.build({
  entrypoints: ["src/web/index.ts"],
  outdir: "dist/web",
  target: "browser",
  format: "esm",
  minify: true,
  naming: "aid-web.[ext]",
})

if (!result.success) {
  console.error("[bundle-web] build failed")
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

console.log("[bundle-web] wrote dist/web/aid-web.js")

export {}
