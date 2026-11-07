#!/usr/bin/env bun
import { mkdir, rm } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { checkStaged, collectStaged } from "./check-binaries"
import { TARGETS, type Target } from "./natives"

const ROOT = resolve(import.meta.dir, "..")
const DIST = resolve(ROOT, "dist")
const CLI_ENTRY = resolve(ROOT, "src", "cli", "index.ts")
/** Where `scripts/bundle-web.ts` writes the browser bundles by default. */
export const BUNDLED_OUT = resolve(ROOT, ".aid-build", "_bundled.ts")

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

// jsonc-parser's `main` is a UMD build whose `require` calls go through the
// factory argument, so `--compile` never bundles `./impl/*`. Point every
// importer at its own copy's ESM build instead.
const jsoncEsm: Bun.BunPlugin = {
  name: "jsonc-parser-esm",
  setup(build) {
    build.onResolve({ filter: /^jsonc-parser$/ }, ({ importer }) => {
      const pkgJson = Bun.resolveSync("jsonc-parser/package.json", dirname(importer))
      return { path: resolve(dirname(pkgJson), "lib", "esm", "main.js") }
    })
  },
}

/**
 * Plugin that swaps every other target's native binary import for an empty
 * string. Bun does not drop unused `with { type: "file" }` imports, so without
 * it each binary would embed all four buf binaries and all four lightningcss
 * bindings. Marking them `external` instead keeps a runtime import that fails
 * on any machine without aid's node_modules.
 */
export const nativeStubs = (target: Target): Bun.BunPlugin => {
  const offTarget = [
    ...BUF_SUBPKGS.filter((pkg) => pkg !== target.bufSubpkg).map((pkg) => `${pkg}/bin/buf`),
    ...LCSS_SUBPKGS.filter((pkg) => pkg !== target.lcssSubpkg).map((pkg) => `/${pkg}.bin`),
  ]
  return {
    name: "aid-native-stubs",
    setup(build) {
      build.onResolve({ filter: /(\/bin\/buf|\.bin)$/ }, ({ path }) =>
        offTarget.some((suffix) => path.endsWith(suffix))
          ? { path, namespace: "aid-native-stub" }
          : undefined,
      )
      build.onLoad({ filter: /.*/, namespace: "aid-native-stub" }, () => ({
        contents: `export default ""`,
        loader: "js",
      }))
    },
  }
}

const redirectBundled = (file: string): Bun.BunPlugin => ({
  name: "aid-redirect-bundled",
  setup(build) {
    build.onResolve({ filter: /\/web\/_bundled(\.ts)?$/ }, () => ({ path: file }))
  },
})

/** Release binary for `target`. Throws when `bundled` is missing, so no binary ships empty browser bundles. */
export const compileTarget = async (
  target: Target,
  outfile: string,
  { bundled = BUNDLED_OUT }: { bundled?: string } = {},
): Promise<void> => {
  if (!(await Bun.file(bundled).exists())) {
    throw new Error(`[compile] ${bundled} is missing. Run \`bun scripts/bundle-web.ts\` first.`)
  }
  const started = performance.now()
  await Bun.build({
    entrypoints: [CLI_ENTRY],
    compile: {
      target: target.triple,
      outfile,
      executablePath: resolve(ROOT, "node_modules", target.bunSubpkg, "bin", "bun"),
    },
    define: {
      "process.platform": JSON.stringify(target.platform),
      "process.arch": JSON.stringify(target.arch),
    },
    plugins: [jsoncEsm, nativeStubs(target), redirectBundled(bundled)],
  })
  const elapsed = ((performance.now() - started) / 1000).toFixed(2)
  console.log(`[compile] compile ${target.triple} done in ${elapsed}s`)
}

const printArtefacts = async (): Promise<void> => {
  console.log("\n[compile] artefacts:")
  const glob = new Bun.Glob("**/*")
  for await (const rel of glob.scan({ cwd: DIST, onlyFiles: true })) {
    console.log(`  dist/${rel}  (${fmtBytes(Bun.file(resolve(DIST, rel)).size)})`)
  }
}

if (import.meta.main) {
  await cleanDist()
  await run([process.execPath, "scripts/emit-schema.ts"], "emit-schema")
  await copySchema()
  await run([process.execPath, "scripts/bundle-web.ts"], "bundle-web")
  const drift = checkStaged(await collectStaged(ROOT))
  if (drift.length > 0) {
    console.error(`[compile] vendor/natives is out of sync:\n  - ${drift.join("\n  - ")}`)
    process.exit(1)
  }
  for (const target of TARGETS) {
    await compileTarget(target, resolve(DIST, "bin", `aid-${target.outSuffix}`))
  }
  await printArtefacts()
}
