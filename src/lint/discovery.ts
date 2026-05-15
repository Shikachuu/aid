import { resolve as resolvePath, sep } from "node:path"

const DEFAULT_IGNORES = [
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
] as const

/** Glob patterns matched by the markdown lint/fmt dispatcher. */
export const MD_PATTERNS = ["**/*.md", "**/*.markdown"] as const

/** Glob patterns the OpenAPI dispatcher walks; convention-based. */
export const OAPI_PATTERNS = [
  "**/openapi.{yaml,yml,json}",
  "**/*.openapi.{yaml,yml,json}",
  "**/openapi/**/*.{yaml,yml,json}",
] as const

/** File extensions Biome's WASM API can lint and format. */
export const BIOME_PATTERNS = ["**/*.{ts,tsx,js,jsx,mjs,cjs,json,jsonc,css}"] as const

/** Protobuf files for `buf` lint/format. */
export const PROTO_PATTERNS = ["**/*.proto"] as const

const isIgnored = (relPath: string): boolean => {
  const segments = relPath.split(/[\\/]/)
  return segments.some((seg) => (DEFAULT_IGNORES as readonly string[]).includes(seg))
}

/**
 * Walk `dir` for files matching any of `patterns`. Returns absolute paths,
 * deduped, with the standard ignore list (`node_modules`, `dist`, etc.) applied.
 */
export const discover = async (dir: string, patterns: readonly string[]): Promise<string[]> => {
  const root = resolvePath(dir)
  const seen = new Set<string>()
  const lists = await Promise.all(
    patterns.map(async (pattern) => {
      const glob = new Bun.Glob(pattern)
      const matches: string[] = []
      for await (const match of glob.scan({ cwd: root, absolute: true, onlyFiles: true })) {
        const rel = match.startsWith(root + sep) ? match.slice(root.length + 1) : match
        if (!isIgnored(rel)) {
          matches.push(match)
        }
      }
      return matches
    }),
  )
  for (const list of lists) {
    for (const m of list) {
      seen.add(m)
    }
  }
  return Array.from(seen).sort()
}
