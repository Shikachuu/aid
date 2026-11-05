import path from "node:path"

/** Containment check for the link and output-dir guards. It compares paths lexically and does not follow symlinks. */
export function isLexicallyInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child)
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel)
}
