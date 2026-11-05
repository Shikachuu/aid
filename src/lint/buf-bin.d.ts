/* eslint-disable import/no-default-export -- Bun file-import attribute exposes path as default. */

declare module "@bufbuild/buf-*/bin/buf" {
  const path: string
  export default path
}
