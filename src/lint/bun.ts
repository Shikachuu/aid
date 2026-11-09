import { existsSync, realpathSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { stableTempFile } from "../core/internal/extract-embedded"
import { findUserConfig } from "./config-resolve"
import { formatOptions, LINT_CATEGORIES, type LintRule, lintRules } from "./configs/bun.default"
import { type Diagnostic, processFailure, type ToolResult } from "./diagnostics"
import { readSource } from "./source-file"

/** With any of these in the project, `aid lint` uses the project's `bun lint` setup instead of aid's bundled rules. */
export const LINT_CONFIGS = [
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  "eslint.config.mts",
  "eslint.config.cts",
  ".eslintrc",
  ".eslintrc.json",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.yaml",
  ".eslintrc.yml",
  ".oxlintrc.json",
] as const

/** With any of these in the project, `aid fmt` uses the project's `bun fmt` setup instead of aid's bundled options. */
export const FORMAT_CONFIGS = [
  ".prettierrc",
  ".prettierrc.json",
  ".prettierrc.json5",
  ".prettierrc.yaml",
  ".prettierrc.yml",
  ".prettierrc.toml",
  ".prettierrc.js",
  ".prettierrc.cjs",
  ".prettierrc.mjs",
  ".prettierrc.ts",
  "prettier.config.js",
  "prettier.config.cjs",
  "prettier.config.mjs",
  "prettier.config.ts",
  ".oxfmtrc.json",
  ".oxfmtrc.jsonc",
  "oxfmt.config.ts",
  "oxfmt.config.mts",
] as const

/** The parts of a `bunfig.toml` that aid writes for its bundled defaults. */
type Bunfig = {
  lint: { rules: Record<string, LintRule>; ignorePatterns?: readonly string[] }
  fmt?: Record<string, string | number | boolean>
}

const toToml = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(toToml).join(", ")}]`
  }
  if (typeof value === "object" && value !== null) {
    const fields = Object.entries(value).map(([k, v]) => `${JSON.stringify(k)} = ${toToml(v)}`)
    return `{ ${fields.join(", ")} }`
  }
  return JSON.stringify(value)
}

/** Shared by the bundled default bunfig and `gen-bunfig`, so the repo file and the default render the same way. */
export const renderBunfig = (config: Bunfig): string => {
  const lines = ["[lint]"]
  if (config.lint.ignorePatterns !== undefined) {
    lines.push(`ignorePatterns = ${toToml(config.lint.ignorePatterns)}`)
  }
  lines.push("", "[lint.categories]", ...LINT_CATEGORIES.map((c) => `${c} = "off"`))
  lines.push("", "[lint.rules]")
  for (const [name, rule] of Object.entries(config.lint.rules)) {
    lines.push(`${JSON.stringify(name)} = ${toToml(rule)}`)
  }
  if (config.fmt !== undefined) {
    lines.push("", "[fmt]")
    for (const [key, value] of Object.entries(config.fmt)) {
      lines.push(`${key} = ${toToml(value)}`)
    }
  }
  return `${lines.join("\n")}\n`
}

const mayHaveSection = async (bunfig: string, section: "lint" | "fmt"): Promise<boolean> => {
  try {
    return section in (Bun.TOML.parse(await Bun.file(bunfig).text()) as Record<string, unknown>)
  } catch {
    return true
  }
}

const nearestBunfigWithSection = async (
  dir: string,
  section: "lint" | "fmt",
): Promise<string | null> => {
  let from = dir
  for (;;) {
    const path = await findUserConfig(from, ["bunfig.toml"])
    if (path === null) {
      return null
    }
    if (await mayHaveSection(path, section)) {
      return path
    }
    const parent = dirname(dirname(path))
    if (parent === dirname(path) || existsSync(join(dirname(path), ".git"))) {
      return null
    }
    from = parent
  }
}

let defaultBunfig: Promise<string> | null = null

const writeDefaultBunfig = (): Promise<string> =>
  stableTempFile(
    "bunfig",
    "bunfig.toml",
    renderBunfig({ lint: { rules: lintRules }, fmt: formatOptions }),
  )

/**
 * Return the global flags that pick the `bunfig.toml` for `bun lint` or `bun fmt`.
 * Bun reads `bunfig.toml` only from its working directory, so a project
 * bunfig higher up is passed explicitly. With no project config of any kind,
 * the flags point at aid's bundled defaults.
 */
export const configArgs = async (dir: string, tool: "lint" | "fmt"): Promise<string[]> => {
  const bunfig = await nearestBunfigWithSection(dir, tool)
  if (bunfig !== null) {
    return [`-c=${bunfig}`]
  }
  if ((await findUserConfig(dir, tool === "lint" ? LINT_CONFIGS : FORMAT_CONFIGS)) !== null) {
    return []
  }
  defaultBunfig ??= writeDefaultBunfig()
  return [`-c=${await defaultBunfig}`]
}

/** Both output streams of a `bun` subprocess, already stripped of ANSI colors, for the parsers below. */
type BunRun = { stdout: string; stderr: string; exitCode: number }

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g")

/**
 * Run Bun's own CLI with `args` in `cwd`. A compiled aid binary is a Bun
 * runtime, and `BUN_BE_BUN=1` makes it act as `bun` instead of as aid.
 * Bun lets `FORCE_COLOR` win over `NO_COLOR`, so the child gets neither.
 */
export const runBun = async (args: string[], cwd: string): Promise<BunRun> => {
  const env: Record<string, string | undefined> = { ...process.env, BUN_BE_BUN: "1", NO_COLOR: "1" }
  delete env.FORCE_COLOR
  const proc = Bun.spawn([process.execPath, ...args], { cwd, env, stdout: "pipe", stderr: "pipe" })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout: stdout.replace(ANSI, ""), stderr: stderr.replace(ANSI, ""), exitCode }
}

/** Split `paths` into batches that stay well under the OS argument limit. */
export const batches = (paths: string[], size = 500): string[][] => {
  const out: string[][] = []
  for (let i = 0; i < paths.length; i += size) {
    out.push(paths.slice(i, i + size))
  }
  return out
}

/** `path` relative to `dir`, starting with `./` so Bun never reads a file name as a flag. */
export const argPath = (dir: string, path: string): string => `./${relative(dir, path)}`

/** Diagnostics from `error: <message>` lines that `bun` prints to stderr, each followed by `at <file>:<line>:<col>`. */
export const stderrDiagnostics = (stderr: string, dir: string, code: string): Diagnostic[] => {
  const out: Diagnostic[] = []
  const lines = stderr.split("\n")
  for (const [i, line] of lines.entries()) {
    const error = /^error: (.+)$/.exec(line)
    if (error === null) {
      continue
    }
    const at = /^\s+at (.+):(\d+):(\d+)$/.exec(lines[i + 1] ?? "")
    out.push({
      file: at?.[1] === undefined ? dir : resolve(dir, at[1]),
      line: at?.[2] === undefined ? undefined : Number(at[2]),
      col: at?.[3] === undefined ? undefined : Number(at[3]),
      severity: "error",
      code,
      message: error[1] ?? "",
    })
  }
  return out
}

/** Drop repeated diagnostics, because every batch of files reports the same config error again. */
export const dedupe = (diagnostics: Diagnostic[]): Diagnostic[] => {
  const seen = new Set<string>()
  return diagnostics.filter((d) => {
    const key = JSON.stringify([d.file, d.line, d.col, d.code, d.message])
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

type EslintMessage = {
  ruleId: string | null
  fatal?: boolean
  severity: number
  message: string
  line?: number
  column?: number
}

type EslintResult = { filePath: string; messages: EslintMessage[] }

type OxlintDiagnostic = {
  code?: string
  severity: string
  message: string
  filename: string
  labels?: { span: { line: number; column: number } }[]
}

const fromEslint = (file: string, m: EslintMessage): Diagnostic | null => {
  if (m.ruleId === null && m.fatal !== true) {
    return null
  }
  return {
    file,
    line: m.line,
    col: m.column,
    severity: m.severity === 2 ? "error" : "warn",
    code: m.ruleId ?? "syntax-error",
    message: m.message,
  }
}

// With an oxlint config, `bun lint --format json` prints oxlint's report, where
// a rule reads `eslint(no-debugger)` or `typescript(no-explicit-any)`.
const fromOxlint = (file: string, d: OxlintDiagnostic): Diagnostic => {
  const rule = /^([\w-]+)\((.+)\)$/.exec(d.code ?? "")
  const span = d.labels?.[0]?.span
  return {
    file,
    line: span?.line,
    col: span?.column,
    severity: d.severity === "error" ? "error" : "warn",
    code:
      rule === null
        ? (d.code ?? "syntax-error")
        : rule[1] === "eslint"
          ? (rule[2] ?? "")
          : `${rule[1]}/${rule[2]}`,
    message: d.message,
  }
}

const JSONC_FILES =
  /(^|\/)(tsconfig[^/]*|jsconfig[^/]*|\.oxlintrc|\.oxfmtrc|devcontainer|turbo|biome|deno|\.vscode\/[^/]+)\.json$/

const lintJson = async (paths: string[]): Promise<Diagnostic[]> => {
  const out: Diagnostic[] = []
  for (const file of paths) {
    const source = await readSource(file)
    if ("severity" in source) {
      out.push(source)
      continue
    }
    try {
      if (file.endsWith(".jsonc") || JSONC_FILES.test(file)) {
        Bun.JSONC.parse(source.text)
      } else {
        JSON.parse(source.text)
      }
    } catch (error) {
      out.push({
        file,
        severity: "error",
        code: "json-syntax-error",
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return out
}

const isJson = (path: string): boolean => path.endsWith(".json") || path.endsWith(".jsonc")

const realPath = (path: string): string => {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

/**
 * Lint JS and TS files with `bun lint`, and check that JSON files parse.
 * With `opts.fix`, `bun lint` writes its safe fixes back to disk.
 */
export const lintWithBun = async (
  paths: string[],
  dir: string,
  opts: { fix: boolean },
): Promise<ToolResult> => {
  const diagnostics = await lintJson(paths.filter(isJson))
  const code = paths.filter((p) => !isJson(p))
  // `bun lint` reports real paths, such as /private/var/... for /var/... on macOS.
  const byRealPath = new Map(code.map((p) => [realPath(p), p]))
  const config = code.length === 0 ? [] : await configArgs(dir, "lint")
  for (const batch of batches(code.map((p) => argPath(dir, p)))) {
    const fix = opts.fix ? ["--fix"] : []
    const run = await runBun(
      [...config, "lint", "--no-script", "--format", "json", ...fix, ...batch],
      dir,
    )
    const errors = stderrDiagnostics(run.stderr, dir, "bun")
    diagnostics.push(...errors)
    let report: unknown = null
    try {
      report = JSON.parse(run.stdout)
    } catch {
      report = null
    }
    if (Array.isArray(report)) {
      for (const result of report as EslintResult[]) {
        const file = byRealPath.get(result.filePath) ?? result.filePath
        diagnostics.push(...result.messages.flatMap((m) => fromEslint(file, m) ?? []))
      }
    } else if (Array.isArray((report as { diagnostics?: unknown } | null)?.diagnostics)) {
      for (const d of (report as { diagnostics: OxlintDiagnostic[] }).diagnostics) {
        diagnostics.push(fromOxlint(resolve(dir, d.filename), d))
      }
    }
    if (errors.length === 0 && (report === null || run.exitCode > 1)) {
      diagnostics.push(processFailure("bun", run, dir, "bun"))
    }
  }
  const unique = dedupe(diagnostics)
  return { tool: "bun", ok: !unique.some((d) => d.severity === "error"), diagnostics: unique }
}
