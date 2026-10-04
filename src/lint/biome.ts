import type { Diagnostic as BiomeDiagnostic, Configuration } from "@biomejs/js-api/nodejs"
import { Biome } from "@biomejs/js-api/nodejs"
import { findUserConfig, parseConfigFile } from "./config-resolve"
import { biomeDefault } from "./configs/biome.default"
import type { Diagnostic, Severity, ToolResult } from "./diagnostics"

const USER_CONFIGS = ["biome.json", "biome.jsonc"] as const

type ProjectKey = ReturnType<Biome["openProject"]>["projectKey"]

/** Resolve the active Biome configuration: user's `biome.json[c]` if present, else the bundled default. */
const resolveBiomeConfig = async (dir: string): Promise<Configuration> => {
  const path = await findUserConfig(dir, USER_CONFIGS)
  if (path === null) {
    return biomeDefault as unknown as Configuration
  }
  return (await parseConfigFile(path)) as Configuration
}

/** Open a Biome project for `dir` with the resolved config, run `fn`, and always shut Biome down. */
export const withBiome = async <T>(
  dir: string,
  fn: (biome: Biome, projectKey: ProjectKey) => Promise<T>,
): Promise<T> => {
  const config = await resolveBiomeConfig(dir)
  const biome = new Biome()
  try {
    const { projectKey } = biome.openProject(dir)
    biome.applyConfiguration(projectKey, config)
    return await fn(biome, projectKey)
  } finally {
    biome.shutdown()
  }
}

const offsetToLineCol = (source: string, byteOffset: number): { line: number; col: number } => {
  const bytes = new TextEncoder().encode(source)
  const limit = Math.min(byteOffset, bytes.length)
  let line = 1
  let col = 1
  for (let i = 0; i < limit; i++) {
    if (bytes[i] === 0x0a) {
      line++
      col = 1
    } else {
      col++
    }
  }
  return { line, col }
}

const mapBiomeSeverity = (s: BiomeDiagnostic["severity"]): Severity => {
  if (s === "error" || s === "fatal") {
    return "error"
  }
  if (s === "warning") {
    return "warn"
  }
  return "info"
}

const toDiagnostic = (d: BiomeDiagnostic, file: string, source: string): Diagnostic => {
  const span = d.location.span
  const pos = span ? offsetToLineCol(source, span[0]) : undefined
  return {
    file,
    line: pos?.line,
    col: pos?.col,
    severity: mapBiomeSeverity(d.severity),
    code: d.category ?? "biome",
    message: d.description,
  }
}

/**
 * Lint code via Biome's WASM JS API. Supports CSS/JSON/JS/TS files; the
 * orchestrator's glob already pre-filters supported extensions.
 */
export const lintWithBiome = async (
  paths: string[],
  dir: string,
  opts: { fix: boolean },
): Promise<ToolResult> => {
  if (paths.length === 0) {
    return { tool: "biome", ok: true, diagnostics: [] }
  }
  return withBiome(dir, async (biome, projectKey) => {
    const diagnostics: Diagnostic[] = []
    let ok = true
    for (const file of paths) {
      const content = await Bun.file(file).text()
      const res = biome.lintContent(projectKey, content, {
        filePath: file,
        fixFileMode: opts.fix ? "safeFixes" : undefined,
      })
      if (opts.fix && res.content !== content) {
        await Bun.write(file, res.content)
      }
      for (const d of res.diagnostics) {
        const mapped = toDiagnostic(d, file, content)
        diagnostics.push(mapped)
        if (mapped.severity === "error") {
          ok = false
        }
      }
    }
    return { tool: "biome", ok, diagnostics }
  })
}
