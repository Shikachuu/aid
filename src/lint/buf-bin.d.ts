// biome-ignore-all lint/style/noDefaultExport: Bun file-import attribute exposes path as default.

declare module "@bufbuild/buf-*/bin/buf" {
  const path: string
  export default path
}
