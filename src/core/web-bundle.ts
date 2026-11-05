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
import {
  AID_ROOT,
  bundleWebEntry,
  hasSourceTree,
  requireEmbedded,
  WEB_CSS,
  WEB_JS,
  type WebJsEntry,
} from "./web-entries"

/** Result of writing the compiled web bundle(s) to disk. */
export type BuildWebBundleResult = {
  /** Public href for the base bundle. Always present; safe to inject on every page. */
  baseHref: string
  /** Public href for the mermaid bundle, or `null` when the site has no diagrams. */
  mermaidHref: string | null
  /** Public href for the Scalar bundle, or `null` when the site has no OpenAPI pages. */
  openapiHref: string | null
  /**
   * Public href for Scalar's stylesheet, or `null` when the site has no OpenAPI pages.
   * Scalar ships its UI unstyled without it, with every icon at intrinsic size.
   */
  openapiCssHref: string | null
  /** Public href for the proto-ui bundle, or `null` when the site has no Proto pages. */
  protoHref: string | null
  /** Public href for the proto-ui stylesheet, or `null` when the site has no Proto pages. */
  protoCssHref: string | null
}

/**
 * Write the browser runtime into `outputDir` and return the public hrefs. The
 * base bundle is always written. Each optional bundle is written only when its
 * `include` flag is set. Output comes from `Bun.build` when the source tree is
 * on disk, and from the bytes embedded in `src/web/_bundled.ts` inside a
 * compiled binary.
 */
export async function buildWebBundle(
  ctx: BuildContext,
  include: { mermaid: boolean; openapi: boolean; proto: boolean },
): Promise<BuildWebBundleResult> {
  const fromSource = await hasSourceTree()

  const js = (entry: WebJsEntry, embedded: string) =>
    fromSource
      ? buildAndWrite(ctx, entry)
      : writeHashed(ctx, entry.name, "js", requireEmbedded(entry.name, embedded))
  const css = async (entry: (typeof WEB_CSS)[keyof typeof WEB_CSS], embedded: string) =>
    writeHashed(
      ctx,
      entry.name,
      "css",
      fromSource
        ? await Bun.file(Bun.resolveSync(entry.specifier, AID_ROOT)).text()
        : requireEmbedded(`${entry.name}.css`, embedded),
    )

  return {
    baseHref: await js(WEB_JS.base, aidWebJs),
    mermaidHref: include.mermaid ? await js(WEB_JS.mermaid, aidMermaidJs) : null,
    openapiHref: include.openapi ? await js(WEB_JS.openapi, aidOpenapiJs) : null,
    openapiCssHref: include.openapi ? await css(WEB_CSS.openapi, aidOpenapiCss) : null,
    protoHref: include.proto ? await js(WEB_JS.proto, aidProtoJs) : null,
    protoCssHref: include.proto ? await css(WEB_CSS.proto, aidProtoCss) : null,
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

async function buildAndWrite(ctx: BuildContext, entry: WebJsEntry): Promise<string> {
  const { name } = entry
  const output = await bundleWebEntry(entry, {
    outdir: ctx.outputDir,
    splitting: true,
    naming: {
      entry: `${name}.[hash].js`,
      chunk: `${name}.[name].[hash].js`,
      asset: `${name}.[name].[hash][ext]`,
    },
  })
  return path.posix.join(ctx.config.base_path, path.basename(output.path))
}
