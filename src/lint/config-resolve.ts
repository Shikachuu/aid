import { existsSync } from "node:fs"
import { dirname, join, resolve as resolvePath } from "node:path"

/**
 * Walk from `startDir` upward and return the first path where any of
 * `candidates` exists. The walk stops after the first directory that contains
 * `.git`, so it never picks up a config from outside the repo. Returns `null`
 * when no candidate is found.
 */
export const findUserConfig = async (
  startDir: string,
  candidates: readonly string[],
): Promise<string | null> => {
  let dir = resolvePath(startDir)
  for (;;) {
    for (const name of candidates) {
      const full = join(dir, name)
      if (await Bun.file(full).exists()) {
        return full
      }
    }
    const parent = dirname(dir)
    if (parent === dir) {
      return null
    }
    if (existsSync(join(dir, ".git"))) {
      return null
    }
    dir = parent
  }
}

/** Parse a config file by extension: `.json` and `.jsonc` as JSONC, `.yaml` and `.yml` as YAML. */
export const parseConfigFile = async (path: string): Promise<unknown> => {
  const text = await Bun.file(path).text()
  if (path.endsWith(".json") || path.endsWith(".jsonc")) {
    return Bun.JSONC.parse(text)
  }
  if (path.endsWith(".yaml") || path.endsWith(".yml")) {
    return Bun.YAML.parse(text)
  }
  throw new Error(`Unsupported config format: ${path}`)
}
