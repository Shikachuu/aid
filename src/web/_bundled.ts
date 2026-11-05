import type { EmbeddedBundle } from "../core/web-entries"

/** Split minified ESM of `src/web/index.ts`, embedded in the compiled binary. */
export const aidWebJs: EmbeddedBundle = { entry: "", files: {} }
/** Split minified ESM of `src/web/mermaid-entry.ts`, embedded in the compiled binary. */
export const aidMermaidJs: EmbeddedBundle = { entry: "", files: {} }
/** Split minified ESM of `src/web/openapi-entry.ts`, embedded in the compiled binary. */
export const aidOpenapiJs: EmbeddedBundle = { entry: "", files: {} }
/** Split minified ESM of `src/web/proto-entry.ts`, embedded in the compiled binary. */
export const aidProtoJs: EmbeddedBundle = { entry: "", files: {} }
/** Stylesheet `@scalar/api-reference/style.css`, embedded in the compiled binary. */
export const aidOpenapiCss = ""
/** Stylesheet `@aid/proto-ui/styles.css`, embedded in the compiled binary. */
export const aidProtoCss = ""
/** Theme component sources, embedded so Tailwind finds their classes in the compiled binary. */
export const aidThemeSources = ""
