import path from "node:path"
import {
  aidMermaidJs,
  aidOpenapiCss,
  aidOpenapiJs,
  aidProtoCss,
  aidProtoJs,
  aidWebJs,
} from "../web/_bundled"
import type { BuildContext } from "./types"

/**
 * Subpath of Scalar's stylesheet inside `node_modules`. Resolved lazily —
 * inside a `bun build --compile` binary there is no node_modules to resolve
 * against, and we take the embedded-bytes path instead, so eager resolution
 * at module load would throw before we ever reach the branch decision.
 */
const SCALAR_CSS_SPECIFIER = "@scalar/api-reference/style.css"
const PROTO_UI_CSS_SPECIFIER = "@aid/proto-ui/styles.css"

/** Result of writing the compiled web bundle(s) to disk. */
export type BuildWebBundleResult = {
  /** Public href for the base bundle. Always present; safe to inject on every page. */
  baseHref: string
  /** Public href for the mermaid bundle, or `null` when the site has no diagrams. */
  mermaidHref: string | null
  /** Public href for the Scalar bundle, or `null` when the site has no OpenAPI pages. */
  openapiHref: string | null
  /**
   * Public href for Scalar's bundled stylesheet, or `null` when the site has no
   * OpenAPI pages. Linked from the layout only on OpenAPI pages so prose pages stay
   * lean. Scalar's UI is entirely styled by this file — without it, every icon
   * renders at intrinsic size and the chrome is unstyled.
   */
  openapiCssHref: string | null
  /** Public href for the proto-ui bundle, or `null` when the site has no Proto pages. */
  protoHref: string | null
  /** Public href for the proto-ui stylesheet, or `null` when the site has no Proto pages. */
  protoCssHref: string | null
}

const aidProjectRoot = path.join(import.meta.dir, "../..")
const baseEntry = path.join(aidProjectRoot, "src/web/index.ts")
const mermaidEntry = path.join(aidProjectRoot, "src/web/mermaid-entry.ts")
const openapiEntry = path.join(aidProjectRoot, "src/web/openapi-entry.ts")
const protoEntry = path.join(aidProjectRoot, "src/web/proto-entry.ts")

/**
 * Materialise the browser-side runtime into `outputDir`. There are two
 * entrypoints: the always-on base bundle (dark-mode toggle, search, AI
 * buttons) and an optional mermaid bundle that lazy-imports the diagram
 * library on `DOMContentLoaded`. We split them so prose-only pages never
 * fetch the mermaid library (or its diagram-type chunks) at all.
 *
 * Two source-resolution modes:
 *
 * - **Dev mode** (the repo is on disk): each entry is compiled via
 *   `Bun.build` with `splitting: true`. Mermaid's internal `await import(…)`
 *   calls produce a constellation of small chunks the browser only fetches
 *   when a `<pre class="mermaid">` actually appears.
 * - **Compiled binary** (`bun build --compile` output): there is no source
 *   tree, so we read pre-bundled bytes embedded at compile time via
 *   `src/web/_bundled.ts`, which `scripts/bundle-web.ts` populates.
 *
 * Either way the output is hashed via xxh64 (see {@link writeHashed}) so
 * filenames are content-addressable for cache-busting. Each optional bundle is
 * emitted only when its `include*` flag is set, so sites without diagrams,
 * OpenAPI, or Proto pages never pay for those runtimes.
 */
export async function buildWebBundle(
  ctx: BuildContext,
  include: { mermaid: boolean; openapi: boolean; proto: boolean },
): Promise<BuildWebBundleResult> {
  // Inside a `bun build --compile` binary the source tree is gone, so fall
  // back to the bytes embedded at compile time.
  const useSource = await Bun.file(baseEntry).exists()

  const js = (name: string, entry: string, embedded: string) =>
    useSource
      ? buildAndWrite(ctx, name, entry)
      : writeHashed(ctx, name, "js", requireEmbedded(name, embedded))
  const css = async (name: string, specifier: string, embedded: string) =>
    writeHashed(
      ctx,
      name,
      "css",
      useSource
        ? await Bun.file(Bun.resolveSync(specifier, import.meta.dir)).text()
        : requireEmbedded(`${name}.css`, embedded),
    )

  return {
    baseHref: await js("aid-web", baseEntry, aidWebJs),
    mermaidHref: include.mermaid ? await js("aid-mermaid", mermaidEntry, aidMermaidJs) : null,
    openapiHref: include.openapi ? await js("aid-openapi", openapiEntry, aidOpenapiJs) : null,
    openapiCssHref: include.openapi
      ? await css("aid-openapi", SCALAR_CSS_SPECIFIER, aidOpenapiCss)
      : null,
    protoHref: include.proto ? await js("aid-proto", protoEntry, aidProtoJs) : null,
    protoCssHref: include.proto
      ? await css("aid-proto", PROTO_UI_CSS_SPECIFIER, aidProtoCss)
      : null,
  }
}

/**
 * Write `body` to `<outputDir>/<name>.<hash>.<ext>` and return its public href
 * joined against `config.base_path`. The xxh64 hash is a content fingerprint
 * for cache-busting, not a security boundary.
 */
export async function writeHashed(
  ctx: BuildContext,
  name: string,
  ext: string,
  body: string,
): Promise<string> {
  const hash = Bun.hash.xxHash64(body).toString(16).padStart(16, "0").slice(0, 8)
  const filename = `${name}.${hash}.${ext}`
  await Bun.write(path.join(ctx.outputDir, filename), body)
  return path.posix.join(ctx.config.base_path, filename)
}

function requireEmbedded(name: string, bytes: string): string {
  if (bytes.length === 0) {
    throw new Error(
      `buildWebBundle: ${name} has no embedded bytes and no source tree on disk. Run \`bun scripts/bundle-web.ts\` before \`bun run build\`.`,
    )
  }
  return bytes
}

async function buildAndWrite(ctx: BuildContext, name: string, entry: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [entry],
    outdir: ctx.outputDir,
    target: "browser",
    format: "esm",
    minify: true,
    splitting: true,
    naming: {
      entry: `${name}.[hash].js`,
      chunk: `${name}.[name].[hash].js`,
      asset: `${name}.[name].[hash][ext]`,
    },
  })
  if (!result.success) {
    for (const log of result.logs) {
      console.error(log)
    }
    throw new Error(`buildWebBundle: ${name} bundle failed`)
  }
  const entryOutput = result.outputs.find((o) => o.kind === "entry-point")
  if (!entryOutput) {
    throw new Error(`buildWebBundle: no entry-point output for ${name}`)
  }
  const filename = path.basename(entryOutput.path)
  return path.posix.join(ctx.config.base_path, filename)
}
