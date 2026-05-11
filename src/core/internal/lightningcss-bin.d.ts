// biome-ignore-all lint/style/noDefaultExport: Bun file-import attribute exposes path as default.

// Staged lightningcss `.node` bindings, renamed to `.bin` by
// `scripts/stage-natives.ts` so Bun treats them as plain files (the `.node`
// extension is special-cased by the loader even with `with { type: "file" }`).

declare module "*.bin" {
  const path: string
  export default path
}
