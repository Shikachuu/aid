import path from "node:path"
import { compile } from "@tailwindcss/node"
import { Scanner } from "@tailwindcss/oxide"

const PACKAGE_ROOT = path.resolve(import.meta.dir, "..")
const SRC = path.join(PACKAGE_ROOT, "src")
const DIST = path.join(PACKAGE_ROOT, "dist")
const TAILWIND_ENTRY = path.join(SRC, "tailwind-entry.css")

const REACT_EXTERNALS = ["react", "react-dom", "react-dom/client", "react/jsx-runtime"]

// `@typescript/native-preview` ships the tsgo Go binary in platform-specific
// subpackages; its `./sync` / `./async` JS exports are LSP-style snapshot APIs,
// not a CLI-style emit entrypoint. Resolve the matching native binary and
// spawn it directly — skips the bin/tsgo.js Node shim and a `bunx` lookup.
const TSGO_EXE = ((): string => {
  const subpkg = `@typescript/native-preview-${process.platform}-${process.arch}`
  const pkgJson = Bun.resolveSync(`${subpkg}/package.json`, PACKAGE_ROOT)
  const exe = path.join(path.dirname(pkgJson), "lib", "tsgo")
  return process.platform === "win32" ? `${exe}.exe` : exe
})()

const run = async (label: string, fn: () => Promise<unknown>): Promise<void> => {
  const start = performance.now()
  process.stdout.write(`[build] ${label}…`)
  try {
    await fn()
    process.stdout.write(` ${Math.round(performance.now() - start)}ms\n`)
  } catch (err) {
    process.stdout.write(" FAILED\n")
    throw err
  }
}

const bundleEntry = async (entry: string, outfile: string, externals: string[]): Promise<void> => {
  const result = await Bun.build({
    entrypoints: [entry],
    outdir: path.dirname(outfile),
    naming: path.basename(outfile),
    target: "browser",
    format: "esm",
    minify: false,
    external: externals,
    sourcemap: "linked",
  })
  if (!result.success) {
    for (const log of result.logs) {
      console.error(log)
    }
    throw new Error(`Bun.build failed for ${entry}`)
  }
}

const bundleParser = async (): Promise<void> => {
  const result = await Bun.build({
    entrypoints: [path.join(SRC, "parser.ts")],
    outdir: DIST,
    naming: "parser.js",
    target: "node",
    format: "esm",
    minify: false,
    external: ["protobufjs"],
    sourcemap: "linked",
  })
  if (!result.success) {
    for (const log of result.logs) {
      console.error(log)
    }
    throw new Error("Bun.build failed for parser.ts")
  }
}

const compileStyles = async (): Promise<void> => {
  const source = await Bun.file(TAILWIND_ENTRY).text()
  const tailwindEntry = Bun.resolveSync("tailwindcss/index.css", PACKAGE_ROOT)
  const compiled = await compile(source, {
    base: path.dirname(TAILWIND_ENTRY),
    from: TAILWIND_ENTRY,
    onDependency: () => {},
    customCssResolver: async (id) => {
      if (id === "tailwindcss") {
        return tailwindEntry
      }
      if (id.startsWith("tailwindcss/")) {
        return Bun.resolveSync(id, PACKAGE_ROOT)
      }
      return undefined
    },
  })
  const scanner = new Scanner({ sources: compiled.sources })
  const candidates = scanner.scan()
  const css = compiled.build(candidates)
  await Bun.write(path.join(DIST, "styles.css"), css)
}

const emitTypes = async (): Promise<void> => {
  const proc = Bun.spawn(
    [TSGO_EXE, "--emitDeclarationOnly", "--outDir", "dist", "--project", "."],
    { cwd: PACKAGE_ROOT, stdout: "pipe", stderr: "pipe" },
  )
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const code = await proc.exited
  if (code !== 0) {
    console.error(stdout)
    console.error(stderr)
    throw new Error(`tsgo exited with code ${code}`)
  }
}

const main = async (): Promise<void> => {
  await Bun.$`rm -rf ${DIST}`.quiet()

  await run("bundle index.js", () =>
    bundleEntry(path.join(SRC, "index.ts"), path.join(DIST, "index.js"), REACT_EXTERNALS),
  )
  await run("bundle hydrate.js", () =>
    bundleEntry(path.join(SRC, "hydrate.tsx"), path.join(DIST, "hydrate.js"), REACT_EXTERNALS),
  )
  await run("bundle parser.js", bundleParser)
  await run("compile styles.css", compileStyles)
  await run("emit .d.ts", emitTypes)
}

await main()
