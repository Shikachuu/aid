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
