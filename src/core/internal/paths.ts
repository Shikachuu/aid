import path from "node:path"

/** True when `child` sits strictly below `parent`. It compares paths lexically and does not follow symlinks. */
export function isLexicallyInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child)
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel)
}
