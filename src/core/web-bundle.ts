import path from "node:path"
import type { AssetRegistry } from "./assets"
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
  bundleWebFiles,
  type EmbeddedBundle,
  hasSourceTree,
  requireEmbedded,
  WEB_CSS,
  WEB_JS,
  type WebJsEntry,
} from "./web-entries"

/** Public hrefs of the web bundles. An optional bundle is `null` when no page needs it. */
export type BuildWebBundleResult = {
  baseHref: string
  mermaidHref: string | null
  openapiHref: string | null
  // Scalar ships its UI unstyled without this, with every icon at intrinsic size.
  openapiCssHref: string | null
  protoHref: string | null
  protoCssHref: string | null
}

/**
 * Queue the browser runtime on `registry` and return the public hrefs. The base
 * bundle is always included, each optional bundle only when its `include` flag
 * is set. Output comes from `Bun.build` when the source tree is on disk, and
 * from the bytes embedded in `src/web/_bundled.ts` inside a compiled binary.
 */
export async function buildWebBundle(
  ctx: BuildContext,
  registry: AssetRegistry,
  include: { mermaid: boolean; openapi: boolean; proto: boolean },
): Promise<BuildWebBundleResult> {
  const fromSource = await hasSourceTree()

  const js = async (entry: WebJsEntry, embedded: EmbeddedBundle) => {
    const bundle = fromSource ? await bundleWebFiles(entry) : embedded
    requireEmbedded(entry.name, bundle.entry)
    for (const [file, body] of Object.entries(bundle.files)) {
      registry.write(path.join(ctx.outputDir, file), `<generated:${entry.source}>`, body)
    }
    return path.posix.join(ctx.config.base_path, bundle.entry)
  }
  const css = async (entry: (typeof WEB_CSS)[keyof typeof WEB_CSS], embedded: string) =>
    writeHashed(
      ctx,
      registry,
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
 * Queue `body` on `registry` as `<outputDir>/<name>.<hash>.<ext>` and return its
 * public href joined against `config.base_path`. The xxh64 hash is a content
 * fingerprint for cache-busting, not a security boundary.
 */
export function writeHashed(
  ctx: BuildContext,
  registry: AssetRegistry,
  name: string,
  ext: string,
  body: string,
): string {
  const hash = Bun.hash.xxHash64(body).toString(16).padStart(16, "0").slice(0, 8)
  const filename = `${name}.${hash}.${ext}`
  const outputPath = path.join(ctx.outputDir, filename)
  registry.write(outputPath, `<generated:${name}.${ext}>`, body)
  return path.posix.join(ctx.config.base_path, filename)
}
