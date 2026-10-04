import path from "node:path"
import type { AssetRegistry } from "./assets"
import type { BuildContext } from "./types"

/**
 * Mirror `ctx.staticDir` into `ctx.outputDir`, preserving the directory
 * structure. Files clobber any existing entries at the same path — the user
 * authored them, so they win over any aid-generated counterpart with the same
 * name. Silently no-ops when `staticDir` does not exist; an absent `static/`
 * is a valid project shape.
 */
export async function copyStaticAssets(ctx: BuildContext, registry: AssetRegistry): Promise<void> {
  if (!(await isDirectory(ctx.staticDir))) {
    return
  }
  const glob = new Bun.Glob("**/*")
  for await (const relative of glob.scan({ cwd: ctx.staticDir, onlyFiles: true })) {
    const srcPath = path.join(ctx.staticDir, relative)
    const destPath = path.join(ctx.outputDir, relative)
    registry.register(destPath, srcPath)
    // Bun.write auto-creates parent dirs; no explicit mkdir needed.
    await Bun.write(destPath, Bun.file(srcPath))
  }
}

async function isDirectory(p: string): Promise<boolean> {
  try {
    return (await Bun.file(p).stat()).isDirectory()
  } catch {
    return false
  }
}
