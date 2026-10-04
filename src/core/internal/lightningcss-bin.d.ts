// biome-ignore-all lint/style/noDefaultExport: Bun file-import attribute exposes path as default.

declare module "*.bin" {
  const path: string
  export default path
}
