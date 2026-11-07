import type { EmbeddedBundle } from "../core/web-entries"

/** Empty here; `scripts/compile.ts` points this module at the generated split bundle of `src/web/index.ts`. */
export const aidWebJs: EmbeddedBundle = { entry: "", files: {} }
/** Empty here; `scripts/compile.ts` points this module at the generated split bundle of `src/web/mermaid-entry.ts`. */
export const aidMermaidJs: EmbeddedBundle = { entry: "", files: {} }
/** Empty here; `scripts/compile.ts` points this module at the generated split bundle of `src/web/openapi-entry.ts`. */
export const aidOpenapiJs: EmbeddedBundle = { entry: "", files: {} }
/** Empty here; `scripts/compile.ts` points this module at the generated split bundle of `src/web/proto-entry.ts`. */
export const aidProtoJs: EmbeddedBundle = { entry: "", files: {} }
/** Empty here; `scripts/compile.ts` points this module at the generated copy of `@scalar/api-reference/style.css`. */
export const aidOpenapiCss = ""
/** Empty here; `scripts/compile.ts` points this module at the generated copy of `@aid/proto-ui/styles.css`. */
export const aidProtoCss = ""
/** Empty here; the compiled binary embeds the theme sources so Tailwind finds their classes. */
export const aidThemeSources = ""
