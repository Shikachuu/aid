import type { RulesetDefinition } from "@stoplight/spectral-core"
import { Document, Spectral } from "@stoplight/spectral-core"
import { Json, Yaml } from "@stoplight/spectral-parsers"
import { oas } from "@stoplight/spectral-rulesets"
import { findUserConfig, parseConfigFile } from "./config-resolve"
import type { Diagnostic, Severity, ToolResult } from "./diagnostics"
import { USER_CONFIGS } from "./discovery"
import { readSource } from "./source-file"

const OAS = oas as unknown as RulesetDefinition

const EXTENDS_MODES = new Set(["all", "recommended", "off"])

const isModeTuple = (entry: unknown[]): boolean =>
  entry.length === 2 && EXTENDS_MODES.has(String(entry[1]))

// The Spectral CLI resolves `extends: spectral:oas` by name; Spectral's core
// only takes ruleset objects.
const withBundledOas = (entry: unknown): unknown =>
  entry === "spectral:oas"
    ? OAS
    : Array.isArray(entry) && isModeTuple(entry) && entry[0] === "spectral:oas"
      ? [OAS, ...entry.slice(1)]
      : entry

const resolveSpectralRuleset = async (dir: string): Promise<RulesetDefinition> => {
  const path = await findUserConfig(dir, USER_CONFIGS.openapi)
  if (path === null) {
    return OAS
  }
  const ruleset = (await parseConfigFile(path)) as { extends?: unknown }
  if (ruleset?.extends === undefined) {
    return ruleset as RulesetDefinition
  }
  const extended =
    Array.isArray(ruleset.extends) && !isModeTuple(ruleset.extends)
      ? ruleset.extends.map(withBundledOas)
      : withBundledOas(ruleset.extends)
  return { ...ruleset, extends: extended } as RulesetDefinition
}

// Spectral throws an AggregateError with an empty message for an invalid rule.
const errorMessage = (err: unknown): string =>
  err instanceof AggregateError
    ? err.errors.map(errorMessage).join("; ")
    : err instanceof Error
      ? err.message
      : String(err)

const mapSeverity = (s: number): Severity => (s === 0 ? "error" : s === 1 ? "warn" : "info")

/** Lint OpenAPI files with Spectral, using the user's `.spectral.*` ruleset or the bundled `spectral:oas`. */
export const lintOpenApi = async (paths: string[], dir: string): Promise<ToolResult> => {
  if (paths.length === 0) {
    return { tool: "openapi", ok: true, diagnostics: [] }
  }
  const spectral = new Spectral()
  try {
    spectral.setRuleset(await resolveSpectralRuleset(dir))
  } catch (err) {
    const file = (await findUserConfig(dir, USER_CONFIGS.openapi)) ?? dir
    return {
      tool: "openapi",
      ok: false,
      diagnostics: [
        {
          file,
          severity: "error",
          code: "openapi/config",
          message: `cannot read config: ${errorMessage(err)}`,
        },
      ],
    }
  }

  const diagnostics: Diagnostic[] = []
  let ok = true
  for (const path of paths) {
    const source = await readSource(path)
    if ("severity" in source) {
      diagnostics.push(source)
      continue
    }
    const doc = path.endsWith(".json")
      ? new Document(source.text, Json, path)
      : new Document(source.text, Yaml, path)
    const results = await spectral.run(doc)
    for (const r of results) {
      const sev = mapSeverity(r.severity)
      if (sev === "error") {
        ok = false
      }
      const startLine = r.range?.start?.line
      const startChar = r.range?.start?.character
      diagnostics.push({
        file: r.source ?? path,
        line: typeof startLine === "number" ? startLine + 1 : undefined,
        col: typeof startChar === "number" ? startChar + 1 : undefined,
        severity: sev,
        code: String(r.code),
        message: r.message,
      })
    }
  }
  return { tool: "openapi", ok, diagnostics }
}
