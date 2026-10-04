#!/usr/bin/env bun
import { mkdir, rm } from "node:fs/promises"
import { resolve } from "node:path"

const ROOT = resolve(import.meta.dir, "..")
const DIST = resolve(ROOT, "dist")
const CLI_ENTRY = resolve(ROOT, "src", "cli", "index.ts")

type Target = {
  triple: string
  outSuffix: string
  bufSubpkg: string
  lcssSubpkg: string
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

const cleanDist = async (): Promise<void> => {
  await rm(DIST, { recursive: true, force: true })
  await mkdir(resolve(DIST, "bin"), { recursive: true })
  console.log(`[compile] cleaned ${DIST}`)
}

const copySchema = async (): Promise<void> => {
  const schemaSrc = resolve(ROOT, "schemas", "aid.schema.json")
  const schemaDst = resolve(DIST, "schemas", "aid.schema.json")
  await Bun.write(schemaDst, Bun.file(schemaSrc))
  console.log(`[compile] copied schema -> ${schemaDst}`)
}

// Bun does not dead-code-eliminate `with { type: "file" }` imports. Without the
// `--external` flags every binary would embed all four `@bufbuild/buf-*/bin/buf`
// files (about 200 MB) and all four lightningcss `.node` bindings (about 24 MB).
const compileTarget = async (target: Target): Promise<void> => {
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

const printArtefacts = async (): Promise<void> => {
  console.log("\n[compile] artefacts:")
  const glob = new Bun.Glob("**/*")
  for await (const rel of glob.scan({ cwd: DIST, onlyFiles: true })) {
    console.log(`  dist/${rel}  (${fmtBytes(Bun.file(resolve(DIST, rel)).size)})`)
  }
}

await cleanDist()
await run(["bun", "scripts/emit-schema.ts"], "emit-schema")
await copySchema()
await run(["bun", "scripts/bundle-web.ts"], "bundle-web")
for (const target of TARGETS) {
  await compileTarget(target)
}
await printArtefacts()
