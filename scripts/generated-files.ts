import path from "node:path"

/** A file a generator script owns, with its path relative to the repo root. */
export type GeneratedFile = { path: string; content: string }

/** Return the paths whose file under `root` is missing or differs from its generated content. */
export const driftedFiles = async (root: string, files: GeneratedFile[]): Promise<string[]> => {
  const drifted = await Promise.all(
    files.map(async (file) => {
      const target = Bun.file(path.join(root, file.path))
      return (await target.exists()) && (await target.text()) === file.content ? null : file.path
    }),
  )
  return drifted.filter((p): p is string => p !== null)
}

/** Return the files under `dir` that no generator owns, so a renamed or dropped page does not linger. */
export const orphanedFiles = async (
  root: string,
  dir: string,
  files: GeneratedFile[],
): Promise<string[]> => {
  const owned = new Set(files.map((f) => f.path))
  const present = await Array.fromAsync(
    new Bun.Glob("**/*").scan({ cwd: path.join(root, dir), dot: true }),
  ).catch((err: NodeJS.ErrnoException) => {
    if (err.code === "ENOENT") {
      return []
    }
    throw err
  })
  return present
    .map((rel) => path.posix.join(dir, rel.split(path.sep).join("/")))
    .filter((p) => !owned.has(p))
    .sort()
}
