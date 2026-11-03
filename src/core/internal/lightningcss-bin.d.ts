/* eslint-disable import/no-default-export -- Bun file-import attribute exposes path as default. */

declare module "*.bin" {
  const path: string
  export default path
}
