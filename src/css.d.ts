/* eslint-disable import/no-default-export -- Bun text-import attribute exposes file content as default. */

declare module "*.css" {
  const text: string
  export default text
}
