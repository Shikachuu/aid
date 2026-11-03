/** One release binary: its Bun compile triple and the platform packages it embeds. */
export type Target = {
  triple: Bun.Build.CompileTarget
  outSuffix: string
  platform: "darwin" | "linux"
  arch: "arm64" | "x64"
  bufSubpkg: string
  lcssSubpkg: string
  oxideSubpkg: string
}

/** Every platform aid ships a binary for. */
export const TARGETS: readonly Target[] = [
  {
    triple: "bun-darwin-arm64",
    outSuffix: "darwin-arm64",
    platform: "darwin",
    arch: "arm64",
    bufSubpkg: "@bufbuild/buf-darwin-arm64",
    lcssSubpkg: "lightningcss-darwin-arm64",
    oxideSubpkg: "@tailwindcss/oxide-darwin-arm64",
  },
  {
    triple: "bun-darwin-x64",
    outSuffix: "darwin-x64",
    platform: "darwin",
    arch: "x64",
    bufSubpkg: "@bufbuild/buf-darwin-x64",
    lcssSubpkg: "lightningcss-darwin-x64",
    oxideSubpkg: "@tailwindcss/oxide-darwin-x64",
  },
  {
    triple: "bun-linux-arm64",
    outSuffix: "linux-arm64",
    platform: "linux",
    arch: "arm64",
    bufSubpkg: "@bufbuild/buf-linux-aarch64",
    lcssSubpkg: "lightningcss-linux-arm64-gnu",
    oxideSubpkg: "@tailwindcss/oxide-linux-arm64-gnu",
  },
  {
    triple: "bun-linux-x64",
    outSuffix: "linux-x64",
    platform: "linux",
    arch: "x64",
    bufSubpkg: "@bufbuild/buf-linux-x64",
    lcssSubpkg: "lightningcss-linux-x64-gnu",
    oxideSubpkg: "@tailwindcss/oxide-linux-x64-gnu",
  },
]

/** File name of the `.node` binding inside a `lightningcss-<platform>` package. */
export const lcssNodeFile = (subpkg: string): string =>
  `lightningcss.${subpkg.slice("lightningcss-".length)}.node`
