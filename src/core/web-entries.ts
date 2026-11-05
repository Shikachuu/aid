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

/** For the build pipeline, which writes and registers every chunk and asset. Throws naming the entry when the bundle fails. */
export async function bundleWebOutputs(
  entry: WebJsEntry,
  options: Partial<Bun.BuildConfig> = {},
): Promise<Bun.BuildArtifact[]> {
  const result = await Bun.build({
    entrypoints: [path.join(AID_ROOT, entry.source)],
    target: "browser",
    format: "esm",
    minify: true,
    ...options,
    throw: false,
  })
  if (!result.success) {
    for (const log of result.logs) {
      console.error(log)
    }
    throw new Error(`failed to bundle ${entry.source}`)
  }
  return result.outputs
}

/** For callers that need only the entry-point file, such as the compiled-binary embedding. */
export async function bundleWebEntry(
  entry: WebJsEntry,
  options: Partial<Bun.BuildConfig> = {},
): Promise<Bun.BuildArtifact> {
  return entryPointOf(entry, await bundleWebOutputs(entry, options))
}

/** The entry-point artifact among `outputs`. Throws when the build produced none. */
export function entryPointOf(entry: WebJsEntry, outputs: Bun.BuildArtifact[]): Bun.BuildArtifact {
  const output = outputs.find((o) => o.kind === "entry-point")
  if (!output) {
    throw new Error(`no entry-point output for ${entry.source}`)
  }
  return output
}
