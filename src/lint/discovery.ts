import { resolve as resolvePath } from "node:path"
import { FORMAT_CONFIGS, LINT_CONFIGS } from "./bun"
import { KNOWN_TOOLS, type Report, type Tool, type ToolResult } from "./diagnostics"

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

/**
 * Walk `dir` for files matching any of `patterns`. Returns sorted, deduped
 * absolute paths, skipping `node_modules`, `dist` and the other build folders.
 */
export const discover = async (dir: string, patterns: readonly string[]): Promise<string[]> => {
  const root = resolvePath(dir)
  const files = new Set<string>()
  for (const pattern of patterns) {
    for await (const rel of new Bun.Glob(pattern).scan({ cwd: root, onlyFiles: true })) {
      if (!rel.split(/[\\/]/).some((seg) => DEFAULT_IGNORES.has(seg))) {
        files.add(resolvePath(root, rel))
      }
    }
  }
  return [...files].sort()
}

/**
 * Discover each tool's files under `dir` and run, in parallel, the tools that
 * `filter` allows and `run` has a runner for.
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
  const results = await Promise.all(
    selected.map(async ({ tool, runner }) => runner(await discover(dir, PATTERNS[tool]))),
  )
  return { ok: results.every((r) => r.ok), results }
}
