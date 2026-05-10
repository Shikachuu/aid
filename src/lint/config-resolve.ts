import { existsSync } from "node:fs"
import { dirname, isAbsolute, join, resolve as resolvePath } from "node:path"

/**
 * Walk from `startDir` upward to the filesystem root, returning the first path
 * where any of `candidates` exists. Stops early when a `.git/` directory is
 * found at the same level as a candidate (so config-resolution doesn't escape
 * the repo). Returns `null` if no candidate is found.
 */
export const findUserConfig = async (
  startDir: string,
  candidates: readonly string[],
): Promise<string | null> => {
  let dir = isAbsolute(startDir) ? startDir : resolvePath(startDir)
  for (;;) {
    for (const name of candidates) {
      const full = join(dir, name)
      if (await Bun.file(full).exists()) return full
    }
    const parent = dirname(dir)
    if (parent === dir) return null
    if (existsSync(join(dir, ".git"))) return null
    dir = parent
  }
}

/** Parse the contents of a config file by extension. Supports `.json`, `.yaml`, `.yml`. */
export const parseConfigFile = async (path: string): Promise<unknown> => {
  const text = await Bun.file(path).text()
  if (path.endsWith(".json") || path.endsWith(".jsonc")) {
    return JSON.parse(stripJsonComments(text))
  }
  if (path.endsWith(".yaml") || path.endsWith(".yml")) {
    return Bun.YAML.parse(text)
  }
  throw new Error(`Unsupported config format: ${path}`)
}

const stripJsonComments = (input: string): string => {
  let out = ""
  let i = 0
  let inString = false
  let stringChar = ""
  while (i < input.length) {
    const c = input[i]
    const n = input[i + 1]
    if (inString) {
      out += c
      if (c === "\\" && n !== undefined) {
        out += n
        i += 2
        continue
      }
      if (c === stringChar) inString = false
      i++
      continue
    }
    if (c === '"' || c === "'") {
      inString = true
      stringChar = c as string
      out += c
      i++
      continue
    }
    if (c === "/" && n === "/") {
      while (i < input.length && input[i] !== "\n") i++
      continue
    }
    if (c === "/" && n === "*") {
      i += 2
      while (i < input.length && !(input[i] === "*" && input[i + 1] === "/")) i++
      i += 2
      continue
    }
    out += c
    i++
  }
  return out
}
