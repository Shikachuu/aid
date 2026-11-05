import { realpath } from "node:fs/promises"
import path from "node:path"

/** True when `child` sits strictly below `parent`. It compares paths lexically and does not follow symlinks. */
export function isLexicallyInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child)
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel)
}

/**
 * Throw when `file` resolves, through symlinks, to a path outside `realRoot`,
 * the realpath of the dir configured as `key` (`displayRoot` in the message).
 */
export async function assertRealPathInside(
  file: string,
  realRoot: string,
  key: string,
  displayRoot: string,
): Promise<void> {
  const real = await realpath(file)
  if (!isLexicallyInside(real, realRoot)) {
    throw new Error(
      `aid: "${file}" resolves through a symlink to ${real}, outside ${key} (${displayRoot}). Copy the file into ${key} or point the symlink at a file inside it.`,
    )
  }
}

/**
 * Throw when a folder on the path of `relative` (relative to `root`) is a symlink
 * back to `root` or to one of its own ancestors. Bun.Glob follows such a loop
 * once, so every file below it would come back under a second path.
 * `realDirs` caches realpaths across calls, keyed by the relative folder.
 */
export async function assertNoSymlinkLoop(
  relative: string,
  root: string,
  realRoot: string,
  key: string,
  realDirs: Map<string, string>,
): Promise<void> {
  const segments = relative.split(path.sep).slice(0, -1)
  const seen = [realRoot]
  for (let i = 1; i <= segments.length; i++) {
    const dir = segments.slice(0, i).join(path.sep)
    let real = realDirs.get(dir)
    if (real === undefined) {
      real = await realpath(path.join(root, dir))
      realDirs.set(dir, real)
    }
    const target = real
    if (seen.some((prev) => prev === target || isLexicallyInside(prev, target))) {
      throw new Error(
        `aid: "${path.join(root, dir)}" is a symlink to ${target}, which contains it, so ${key} would list its files twice. Remove the symlink.`,
      )
    }
    seen.push(target)
  }
}
