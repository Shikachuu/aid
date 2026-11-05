import { rm } from "node:fs/promises"
import path from "node:path"
import { parseArgs } from "node:util"
import { compile } from "@tailwindcss/node"
import { Scanner } from "@tailwindcss/oxide"

const PACKAGE_ROOT = path.resolve(import.meta.dir, "..")
const SRC = path.join(PACKAGE_ROOT, "src")
const { values: args } = parseArgs({ options: { outdir: { type: "string" } } })
const DIST = path.resolve(args.outdir ?? path.join(PACKAGE_ROOT, "dist"))
const TAILWIND_ENTRY = path.join(SRC, "tailwind-entry.css")

const REACT_EXTERNALS = ["react", "react-dom", "react-dom/client", "react/jsx-runtime"]

const run = async (label: string, fn: () => Promise<unknown>): Promise<void> => {
  const start = performance.now()
  process.stdout.write(`[build] ${label}...`)
  try {
    await fn()
    process.stdout.write(` ${Math.round(performance.now() - start)}ms\n`)
  } catch (err) {
    process.stdout.write(" FAILED\n")
    throw err
  }
}

const bundleEntry = async (
  entry: string,
  outfile: string,
  externals: string[],
  target: "browser" | "node" = "browser",
): Promise<void> => {
  const result = await Bun.build({
    entrypoints: [entry],
    outdir: path.dirname(outfile),
    naming: path.basename(outfile),
    target,
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
  await Bun.$`bun x tsc --emitDeclarationOnly --outDir ${DIST} --project .`.cwd(PACKAGE_ROOT)
}

const main = async (): Promise<void> => {
  await rm(DIST, { recursive: true, force: true })

  await run("bundle index.js", () =>
    bundleEntry(path.join(SRC, "index.ts"), path.join(DIST, "index.js"), REACT_EXTERNALS),
  )
  await run("bundle hydrate.js", () =>
    bundleEntry(path.join(SRC, "hydrate.tsx"), path.join(DIST, "hydrate.js"), REACT_EXTERNALS),
  )
  await run("bundle parser.js", () =>
    bundleEntry(path.join(SRC, "parser.ts"), path.join(DIST, "parser.js"), ["protobufjs"], "node"),
  )
  await run("compile styles.css", compileStyles)
  await run("emit .d.ts", emitTypes)
}

await main()
