import type { RulesetDefinition } from "@stoplight/spectral-core"
import { Document, Spectral } from "@stoplight/spectral-core"
import { Json, Yaml } from "@stoplight/spectral-parsers"
import { oas } from "@stoplight/spectral-rulesets"
import { findUserConfig, parseConfigFile } from "./config-resolve"
import type { Diagnostic, Severity, ToolResult } from "./diagnostics"

const USER_CONFIGS = [".spectral.yaml", ".spectral.yml", ".spectral.json"] as const

/** Resolve the active Spectral ruleset: user's `.spectral.*` if present, else the bundled `spectral:oas`. */
export const resolveSpectralRuleset = async (dir: string): Promise<RulesetDefinition> => {
  const path = await findUserConfig(dir, USER_CONFIGS)
  if (path === null) return oas as unknown as RulesetDefinition
  return (await parseConfigFile(path)) as RulesetDefinition
}

const mapSeverity = (s: number): Severity => (s === 0 ? "error" : s === 1 ? "warn" : "info")

/** Lint a list of OpenAPI files (.yaml/.yml/.json) via Spectral. */
export const lintOpenApi = async (paths: string[], dir: string): Promise<ToolResult> => {
  if (paths.length === 0) return { tool: "openapi", ok: true, diagnostics: [] }
  const ruleset = await resolveSpectralRuleset(dir)
  const spectral = new Spectral()
  spectral.setRuleset(ruleset)

  const diagnostics: Diagnostic[] = []
  let ok = true
  for (const path of paths) {
    const text = await Bun.file(path).text()
    const doc = path.endsWith(".json")
      ? new Document(text, Json, path)
      : new Document(text, Yaml, path)
    const results = await spectral.run(doc)
    for (const r of results) {
      const sev = mapSeverity(r.severity)
      if (sev === "error") ok = false
      const startLine = r.range?.start?.line
      const startChar = r.range?.start?.character
      diagnostics.push({
        file: path,
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
