#!/usr/bin/env bun
/**
 * Per-target release pipeline. Wipes `dist/`, regenerates the JSON schema,
 * bundles the browser glue, then cross-compiles the `aid` CLI for every
 * supported target. The compiled binary embeds the matching platform's
 * `@bufbuild/buf` and `@tailwindcss/oxide` native deps.
 */

import { resolve } from "node:path"

const ROOT = resolve(import.meta.dir, "..")
const DIST = resolve(ROOT, "dist")
const CLI_ENTRY = resolve(ROOT, "src", "cli", "index.ts")

type Target = {
  /** `bun build --target=` triple. */
  triple: string
  /** Output suffix appended to `aid-`. */
  outSuffix: string
  /** `@bufbuild/buf` subpackage embedded in the binary (matches a `with { type: "file" }` import). */
  bufSubpkg: string
  /** `lightningcss-*` subpackage whose `.node` is embedded for this target. */
  lcssSubpkg: string
  /** Values bun injects for build-time constant folding. */
  platform: "darwin" | "linux"
  arch: "arm64" | "x64"
}

const TARGETS: readonly Target[] = [
  {
    triple: "bun-darwin-arm64",
    outSuffix: "darwin-arm64",
    bufSubpkg: "@bufbuild/buf-darwin-arm64",
    lcssSubpkg: "lightningcss-darwin-arm64",
    platform: "darwin",
    arch: "arm64",
  },
  {
    triple: "bun-darwin-x64",
    outSuffix: "darwin-x64",
    bufSubpkg: "@bufbuild/buf-darwin-x64",
    lcssSubpkg: "lightningcss-darwin-x64",
    platform: "darwin",
    arch: "x64",
  },
  {
    triple: "bun-linux-arm64",
    outSuffix: "linux-arm64",
    bufSubpkg: "@bufbuild/buf-linux-aarch64",
    lcssSubpkg: "lightningcss-linux-arm64-gnu",
    platform: "linux",
    arch: "arm64",
  },
  {
    triple: "bun-linux-x64",
    outSuffix: "linux-x64",
    bufSubpkg: "@bufbuild/buf-linux-x64",
    lcssSubpkg: "lightningcss-linux-x64-gnu",
    platform: "linux",
    arch: "x64",
  },
  // Windows targets are derived later — re-enable once @bufbuild/buf-win32-*
  // and @tailwindcss/oxide-win32-* are pinned and proto.ts handles win32.
]

const BUF_SUBPKGS = TARGETS.map((t) => t.bufSubpkg)
const LCSS_SUBPKGS = TARGETS.map((t) => t.lcssSubpkg)

const fmtBytes = (n: number): string => {
  const units = ["B", "KB", "MB", "GB"]
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

const run = async (cmd: string[], label: string): Promise<void> => {
  const started = performance.now()
  const proc = Bun.spawn(cmd, { stdout: "inherit", stderr: "inherit", cwd: ROOT })
  const code = await proc.exited
  const elapsed = ((performance.now() - started) / 1000).toFixed(2)
  if (code !== 0) {
    console.error(`[compile] ${label} failed (exit ${code})`)
    process.exit(code)
  }
  console.log(`[compile] ${label} done in ${elapsed}s`)
}

// 1. Clean dist tree.
await Bun.$`rm -rf ${DIST}`.quiet()
await Bun.$`mkdir -p ${DIST}/bin ${DIST}/schemas ${DIST}/web`.quiet()
console.log(`[compile] cleaned ${DIST}`)

// 2. Schema — emit-schema.ts writes schemas/aid.schema.json; copy into dist/schemas.
await run(["bun", "scripts/emit-schema.ts"], "emit-schema")
const schemaSrc = resolve(ROOT, "schemas", "aid.schema.json")
const schemaDst = resolve(DIST, "schemas", "aid.schema.json")
await Bun.write(schemaDst, Bun.file(schemaSrc))
console.log(`[compile] copied schema → ${schemaDst}`)

// 3. Web glue.
await run(["bun", "scripts/bundle-web.ts"], "bundle-web")

// 4. Cross-compile binaries.
//
// `with { type: "file" }` imports are NOT eliminated by dead-code analysis —
// without help, every target embeds all four `@bufbuild/buf-*/bin/buf` files
// (4× ~50 MB bloat) and all four `lightningcss-*/lightningcss.*.node` bindings
// (~24 MB bloat). The `--external` flags below exclude every non-matching
// platform's buf and lightningcss paths so each binary only carries its own.
// `--define` is added for symmetry / future runtime branches; the externals do
// the heavy lifting.
for (const target of TARGETS) {
  const outfile = resolve(DIST, "bin", `aid-${target.outSuffix}`)
  const bufExternals = BUF_SUBPKGS.filter((pkg) => pkg !== target.bufSubpkg).flatMap((pkg) => [
    "--external",
    `${pkg}/bin/buf`,
  ])
  const lcssExternals = LCSS_SUBPKGS.filter((pkg) => pkg !== target.lcssSubpkg).flatMap((pkg) => [
    "--external",
    `${pkg}/*`,
  ])
  await run(
    [
      "bun",
      "build",
      "--compile",
      `--target=${target.triple}`,
      ...bufExternals,
      ...lcssExternals,
      "--define",
      `process.platform="${target.platform}"`,
      "--define",
      `process.arch="${target.arch}"`,
      `--outfile=${outfile}`,
      CLI_ENTRY,
    ],
    `compile ${target.triple}`,
  )
}

// 5. Summary.
console.log("\n[compile] artefacts:")
const glob = new Bun.Glob("**/*")
for await (const rel of glob.scan({ cwd: DIST, onlyFiles: true })) {
  const abs = resolve(DIST, rel)
  const size = (await Bun.file(abs).stat()).size
  console.log(`  dist/${rel}  (${fmtBytes(size)})`)
}
