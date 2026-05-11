// biome-ignore-all lint/style/noDefaultExport: Bun text-import attribute exposes file content as default.

declare module "*.css" {
  const text: string
  export default text
}
