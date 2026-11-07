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
