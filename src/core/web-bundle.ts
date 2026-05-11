import { mkdir } from "node:fs/promises"
import path from "node:path"
import type { BuildContext } from "./types"

/** Inputs for {@link buildWebBundle}. */
export type BuildWebBundleArgs = {
  ctx: BuildContext
}

/** Result of writing the compiled web bundle to disk. */
export type BuildWebBundleResult = {
  /** Absolute filesystem path the bundle was written to. */
  path: string
  /** Public URL path for use in `<script src>`. Joined against `config.base_path`. */
  href: string
}

const aidProjectRoot = path.join(import.meta.dir, "../..")
const webEntry = path.join(aidProjectRoot, "src/web/index.ts")

/**
 * Bundle `src/web/index.ts` for the browser via `Bun.build`, hash the output
 * with xxh64 (mirroring `writeCss`), and write it to `<outputDir>/aid-web.<hash>.js`.
 * Returns the public href to drop into `<script src>`. The bundle is small —
 * heavyweight runtimes like `mermaid` are pulled in via `await import(…)` and
 * code-split into separate chunks that the browser only fetches on demand.
 */
export async function buildWebBundle(args: BuildWebBundleArgs): Promise<BuildWebBundleResult> {
  const { ctx } = args
  await mkdir(ctx.outputDir, { recursive: true })
  const result = await Bun.build({
    entrypoints: [webEntry],
    outdir: ctx.outputDir,
    target: "browser",
    format: "esm",
    minify: true,
    splitting: true,
    naming: {
      entry: "aid-web.[hash].js",
      chunk: "aid-web.[name].[hash].js",
      asset: "aid-web.[name].[hash][ext]",
    },
  })
  if (!result.success) {
    for (const log of result.logs) console.error(log)
    throw new Error("buildWebBundle: bundle failed")
  }
  const entry = result.outputs.find((o) => o.kind === "entry-point")
  if (!entry) throw new Error("buildWebBundle: no entry-point output")
  const filename = path.basename(entry.path)
  const href = path.posix.join(ctx.config.base_path, filename)
  return { path: entry.path, href }
}
