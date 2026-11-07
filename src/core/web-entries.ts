import path from "node:path"

/** Root of aid's own source tree. Bundled sources and packages resolve against it. */
export const AID_ROOT = path.join(import.meta.dir, "../..")

/**
 * True when aid runs from its source tree. A compiled binary has none and uses
 * the bytes that `scripts/compile.ts` swaps in for `src/web/_bundled.ts`.
 */
export const hasSourceTree = (): Promise<boolean> =>
  Bun.file(path.join(AID_ROOT, "src/web/index.ts")).exists()

/**
 * Guard for a binary compiled without running `bundle-web.ts`: the user gets
 * the command to fix it instead of an empty bundle or stylesheet.
 */
export function requireEmbedded(name: string, bytes: string): string {
  if (bytes.length === 0) {
    throw new Error(
      `aid: ${name} has no embedded bytes and no source tree on disk. Build the binary with \`bun run build\`, which runs \`scripts/bundle-web.ts\` first.`,
    )
  }
  return bytes
}

type BundledExport = { name: string; exportName: keyof typeof import("../web/_bundled") } & (
  { source: string } | { specifier: string }
)

/** Browser bundles that `scripts/bundle-web.ts` embeds for the compiled binary. */
export const WEB_JS = {
  base: { name: "aid-web", source: "src/web/index.ts", exportName: "aidWebJs" },
  mermaid: { name: "aid-mermaid", source: "src/web/mermaid-entry.ts", exportName: "aidMermaidJs" },
  openapi: { name: "aid-openapi", source: "src/web/openapi-entry.ts", exportName: "aidOpenapiJs" },
  proto: { name: "aid-proto", source: "src/web/proto-entry.ts", exportName: "aidProtoJs" },
} as const satisfies Record<string, BundledExport>

/** Prebuilt stylesheets copied verbatim from their packages. */
export const WEB_CSS = {
  openapi: {
    name: "aid-openapi",
    specifier: "@scalar/api-reference/style.css",
    exportName: "aidOpenapiCss",
  },
  proto: { name: "aid-proto", specifier: "@aid/proto-ui/styles.css", exportName: "aidProtoCss" },
} as const satisfies Record<string, BundledExport>

/** One entry of {@link WEB_JS}. */
export type WebJsEntry = (typeof WEB_JS)[keyof typeof WEB_JS]

/**
 * Bundle `entry` with code splitting, so a page loads only the chunks it uses, such as
 * one mermaid diagram type. Source runs and the compiled binary write the same files.
 * Throws naming the entry when the bundle fails.
 */
export async function bundleWebFiles(entry: WebJsEntry): Promise<EmbeddedBundle> {
  const { name } = entry
  const result = await Bun.build({
    entrypoints: [path.join(AID_ROOT, entry.source)],
    target: "browser",
    format: "esm",
    minify: true,
    splitting: true,
    naming: {
      entry: `${name}.[hash].js`,
      chunk: `${name}.[name].[hash].js`,
      asset: `${name}.[name].[hash][ext]`,
    },
    throw: false,
  })
  if (!result.success) {
    for (const log of result.logs) {
      console.error(log)
    }
    throw new Error(`failed to bundle ${entry.source}`)
  }
  const files = await Promise.all(
    result.outputs.map(
      async (output) => [path.basename(output.path), await output.text()] as const,
    ),
  )
  return {
    entry: path.basename(entryPointOf(entry, result.outputs).path),
    files: Object.fromEntries(files),
  }
}

/** A split browser bundle: the entry-point file name and every output file by name. */
export type EmbeddedBundle = { entry: string; files: Record<string, string> }

/** The entry-point artifact among `outputs`. Throws when the build produced none. */
export function entryPointOf(entry: WebJsEntry, outputs: Bun.BuildArtifact[]): Bun.BuildArtifact {
  const output = outputs.find((o) => o.kind === "entry-point")
  if (!output) {
    throw new Error(`no entry-point output for ${entry.source}`)
  }
  return output
}
