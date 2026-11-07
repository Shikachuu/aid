import type { Dirent } from "node:fs"
import { readdir } from "node:fs/promises"
import { join, resolve as resolvePath } from "node:path"
import { FORMAT_CONFIGS, LINT_CONFIGS } from "./bun"
import {
  type Diagnostic,
  KNOWN_TOOLS,
  type Report,
  type Tool,
  type ToolResult,
} from "./diagnostics"

/** Directory names discovery never walks into, whatever the tool. */
export const DEFAULT_IGNORES = new Set([
  "node_modules",
  "dist",
  ".bun",
  ".git",
  ".turbo",
  "build",
  "coverage",
  ".next",
  ".cache",
  ".vercel",
  ".aid",
])

/**
 * Glob patterns each tool walks. OpenAPI specs share extensions with other
 * YAML and JSON files, so only `openapi.*`, `*.openapi.*` and files under an
 * `openapi/` directory count.
 */
export const PATTERNS: Record<Tool, readonly string[]> = {
  md: ["**/*.md", "**/*.markdown"],
  openapi: [
    "**/openapi.{yaml,yml,json}",
    "**/*.openapi.{yaml,yml,json}",
    "**/openapi/**/*.{yaml,yml,json}",
  ],
  bun: ["**/*.{ts,tsx,js,jsx,mjs,cjs,json,jsonc,css}"],
  css: ["**/*.css"],
  proto: ["**/*.proto"],
}

/**
 * Config file names each tool looks for, nearest first. The search walks up
 * from the target directory and stops at the first directory holding `.git`.
 */
export const USER_CONFIGS: Record<Tool, readonly string[]> = {
  md: [".markdownlint.json", ".markdownlint.jsonc", ".markdownlint.yaml", ".markdownlint.yml"],
  openapi: [".spectral.yaml", ".spectral.yml", ".spectral.json"],
  bun: [...LINT_CONFIGS, ...FORMAT_CONFIGS, "bunfig.toml"],
  css: [],
  proto: ["buf.yaml"],
}

const errorCode = (err: unknown): string =>
  err instanceof Error && "code" in err ? String(err.code) : String(err)

/**
 * List every regular file under `root`, relative to it, without entering a
 * `DEFAULT_IGNORES` directory. A subdirectory that cannot be read becomes a
 * `read-error` warning instead of aborting the run; an unreadable `root` throws.
 */
export const listFiles = async (
  root: string,
): Promise<{ files: string[]; errors: Diagnostic[] }> => {
  const files: string[] = []
  const errors: Diagnostic[] = []
  const walk = async (rel: string): Promise<void> => {
    let entries: Dirent[]
    try {
      entries = await readdir(join(root, rel), { withFileTypes: true })
    } catch (err) {
      if (rel === "") {
        throw new Error(`aid: cannot read directory ${root} (${errorCode(err)})`, { cause: err })
      }
      errors.push({
        file: join(root, rel),
        severity: "warn",
        code: "read-error",
        message: `directory skipped, it cannot be read (${errorCode(err)})`,
      })
      return
    }
    for (const entry of entries) {
      const child = rel === "" ? entry.name : `${rel}/${entry.name}`
      if (entry.isDirectory()) {
        if (!DEFAULT_IGNORES.has(entry.name)) {
          await walk(child)
        }
      } else if (entry.isFile()) {
        files.push(child)
      }
    }
  }
  await walk("")
  return { files: files.sort(), errors }
}

/** Keep the relative `files` that match any of `patterns`, as absolute paths under `root` in the order of `files`. */
export const matchFiles = (
  root: string,
  files: readonly string[],
  patterns: readonly string[],
): string[] => {
  const globs = patterns.map((pattern) => new Bun.Glob(pattern))
  return files.filter((rel) => globs.some((g) => g.match(rel))).map((rel) => resolvePath(root, rel))
}

/**
 * Discover each tool's files under `dir` and run, in parallel, the tools that
 * `filter` allows and `run` has a runner for. Directories discovery could not
 * read are reported on the first tool's result.
 */
export const runTools = async (
  dir: string,
  filter: Set<Tool> | null,
  run: Partial<Record<Tool, (paths: string[]) => Promise<ToolResult>>>,
): Promise<Report> => {
  const selected = KNOWN_TOOLS.flatMap((tool) => {
    const runner = run[tool]
    return runner !== undefined && (filter === null || filter.has(tool)) ? [{ tool, runner }] : []
  })
  const root = resolvePath(dir)
  const { files, errors } = await listFiles(root)
  const results = await Promise.all(
    selected.map(({ tool, runner }) => runner(matchFiles(root, files, PATTERNS[tool]))),
  )
  const [first] = results
  if (first !== undefined && errors.length > 0) {
    results[0] = { ...first, diagnostics: [...errors, ...first.diagnostics] }
  }
  return { ok: results.every((r) => r.ok), results }
}
