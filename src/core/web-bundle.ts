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

/** Inputs for {@link buildWebBundle}. */
export type BuildWebBundleArgs = {
  ctx: BuildContext
  /**
   * When `true`, the mermaid runtime bundle is emitted alongside the base one.
   * When `false` (the default), only the base bundle is produced — pages with
   * no diagrams never pay for the mermaid library.
   */
  includeMermaid?: boolean
  /**
   * When `true`, the Scalar `api-reference` runtime bundle is emitted alongside
   * the base one. When `false` (the default), only the base bundle is produced —
   * sites with no OpenAPI pages never pay for the Scalar runtime.
   */
  includeOpenApi?: boolean
  /**
   * When `true`, the `@aid/proto-ui` runtime bundle is emitted alongside the
   * base one. When `false` (the default), only the base bundle is produced —
   * sites with no Proto pages never pay for the proto-ui runtime.
   */
  includeProto?: boolean
}

/** Result of writing the compiled web bundle(s) to disk. */
export type BuildWebBundleResult = {
  /** Public href for the base bundle. Always present; safe to inject on every page. */
  baseHref: string
  /** Public href for the mermaid bundle, or `null` when `includeMermaid` is false. */
  mermaidHref: string | null
  /** Public href for the Scalar bundle, or `null` when `includeOpenApi` is false. */
  openapiHref: string | null
  /**
   * Public href for Scalar's bundled stylesheet, or `null` when `includeOpenApi`
   * is false. Linked from the layout only on OpenAPI pages so prose pages stay
   * lean. Scalar's UI is entirely styled by this file — without it, every icon
   * renders at intrinsic size and the chrome is unstyled.
   */
  openapiCssHref: string | null
  /** Public href for the proto-ui bundle, or `null` when `includeProto` is false. */
  protoHref: string | null
  /** Public href for the proto-ui stylesheet, or `null` when `includeProto` is false. */
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
 * Either way the output is hashed via xxh64 (mirroring {@link writeCss}) so
 * filenames are content-addressable for cache-busting.
 */
export async function buildWebBundle(args: BuildWebBundleArgs): Promise<BuildWebBundleResult> {
  const { ctx, includeMermaid = false, includeOpenApi = false, includeProto = false } = args

  // Prefer the source tree when it is available on disk: in dev mode that's
  // always the case, and `Bun.build` with splitting produces the smaller
  // chunked output. Inside a `bun build --compile` binary the source tree is
  // gone, so we fall back to the bytes embedded at compile time.
  const useSource = await Bun.file(baseEntry).exists()

  const baseHref = useSource
    ? await buildAndWrite(ctx, "aid-web", baseEntry)
    : await writeEmbedded(ctx, "aid-web", requireEmbedded("aid-web", aidWebJs))

  const mermaidHref = includeMermaid
    ? useSource
      ? await buildAndWrite(ctx, "aid-mermaid", mermaidEntry)
      : await writeEmbedded(ctx, "aid-mermaid", requireEmbedded("aid-mermaid", aidMermaidJs))
    : null

  const openapiHref = includeOpenApi
    ? useSource
      ? await buildAndWrite(ctx, "aid-openapi", openapiEntry)
      : await writeEmbedded(ctx, "aid-openapi", requireEmbedded("aid-openapi", aidOpenapiJs))
    : null

  const openapiCssHref = includeOpenApi
    ? useSource
      ? await copyScalarCss(ctx)
      : await writeEmbeddedCss(
          ctx,
          "aid-openapi",
          requireEmbedded("aid-openapi.css", aidOpenapiCss),
        )
    : null

  const protoHref = includeProto
    ? useSource
      ? await buildAndWrite(ctx, "aid-proto", protoEntry)
      : await writeEmbedded(ctx, "aid-proto", requireEmbedded("aid-proto", aidProtoJs))
    : null

  const protoCssHref = includeProto
    ? useSource
      ? await copyProtoUiCss(ctx)
      : await writeEmbeddedCss(ctx, "aid-proto", requireEmbedded("aid-proto.css", aidProtoCss))
    : null

  return { baseHref, mermaidHref, openapiHref, openapiCssHref, protoHref, protoCssHref }
}

function requireEmbedded(name: string, bytes: string): string {
  if (bytes.length === 0) {
    throw new Error(
      `buildWebBundle: ${name} has no embedded bytes and no source tree on disk. Run \`bun scripts/bundle-web.ts\` before \`bun run compile\`.`,
    )
  }
  return bytes
}

async function writeEmbedded(ctx: BuildContext, name: string, source: string): Promise<string> {
  const hash = Bun.hash.xxHash64(source).toString(16).padStart(16, "0").slice(0, 8)
  const filename = `${name}.${hash}.js`
  await Bun.write(path.join(ctx.outputDir, filename), source)
  return path.posix.join(ctx.config.base_path, filename)
}

async function writeEmbeddedCss(ctx: BuildContext, name: string, source: string): Promise<string> {
  const hash = Bun.hash.xxHash64(source).toString(16).padStart(16, "0").slice(0, 8)
  const filename = `${name}.${hash}.css`
  await Bun.write(path.join(ctx.outputDir, filename), source)
  return path.posix.join(ctx.config.base_path, filename)
}

async function copyScalarCss(ctx: BuildContext): Promise<string> {
  const scalarCssEntry = Bun.resolveSync(SCALAR_CSS_SPECIFIER, import.meta.dir)
  const source = await Bun.file(scalarCssEntry).text()
  return writeEmbeddedCss(ctx, "aid-openapi", source)
}

async function copyProtoUiCss(ctx: BuildContext): Promise<string> {
  const protoCssEntry = Bun.resolveSync(PROTO_UI_CSS_SPECIFIER, import.meta.dir)
  const source = await Bun.file(protoCssEntry).text()
  return writeEmbeddedCss(ctx, "aid-proto", source)
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
