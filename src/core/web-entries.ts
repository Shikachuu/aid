import path from "node:path"

/** Root of aid's own source tree. Bundled sources and packages resolve against it. */
export const AID_ROOT = path.join(import.meta.dir, "../..")

/**
 * True when aid runs from its source tree. A compiled binary has none and uses
 * the bytes `scripts/bundle-web.ts` embedded in `src/web/_bundled.ts`.
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
      `aid: ${name} has no embedded bytes and no source tree on disk. Run \`bun scripts/bundle-web.ts\` before \`bun run build\`.`,
    )
  }
  return bytes
}

/**
 * Browser bundles. `exportName` is the matching export in `src/web/_bundled.ts`,
 * which `scripts/bundle-web.ts` generates for the compiled binary.
 */
export const WEB_JS = {
  base: { name: "aid-web", source: "src/web/index.ts", exportName: "aidWebJs" },
  mermaid: { name: "aid-mermaid", source: "src/web/mermaid-entry.ts", exportName: "aidMermaidJs" },
  openapi: { name: "aid-openapi", source: "src/web/openapi-entry.ts", exportName: "aidOpenapiJs" },
  proto: { name: "aid-proto", source: "src/web/proto-entry.ts", exportName: "aidProtoJs" },
} as const

/** Prebuilt stylesheets copied verbatim from their packages. */
export const WEB_CSS = {
  openapi: {
    name: "aid-openapi",
    specifier: "@scalar/api-reference/style.css",
    exportName: "aidOpenapiCss",
  },
  proto: { name: "aid-proto", specifier: "@aid/proto-ui/styles.css", exportName: "aidProtoCss" },
} as const

/** One entry of {@link WEB_JS}. */
export type WebJsEntry = (typeof WEB_JS)[keyof typeof WEB_JS]

/** Bundle one browser entry as minified ESM and return its entry-point output. */
export async function bundleWebEntry(
  entry: WebJsEntry,
  options: Partial<Bun.BuildConfig> = {},
): Promise<Bun.BuildArtifact> {
  const result = await Bun.build({
    entrypoints: [path.join(AID_ROOT, entry.source)],
    target: "browser",
    format: "esm",
    minify: true,
    ...options,
  })
  if (!result.success) {
    for (const log of result.logs) {
      console.error(log)
    }
    throw new Error(`failed to bundle ${entry.source}`)
  }
  const output = result.outputs.find((o) => o.kind === "entry-point")
  if (!output) {
    throw new Error(`no entry-point output for ${entry.source}`)
  }
  return output
}
