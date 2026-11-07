import { realpath } from "node:fs/promises"
import path from "node:path"
import type { AssetRegistry } from "./assets"
import { assertRealPathInside } from "./internal/paths"
import type { BuildContext } from "./types"

/**
 * Mirror `ctx.staticDir` into `ctx.outputDir`. A file that collides with another
 * build output makes `registry` throw. A missing `staticDir` is valid and copies nothing.
 * Symlinks are followed when their real path stays inside `staticDir`; one that leaves it throws.
 */
export async function copyStaticAssets(ctx: BuildContext, registry: AssetRegistry): Promise<void> {
  if (!(await isDirectory(ctx.staticDir))) {
    return
  }
  const realStaticDir = await realpath(ctx.staticDir)
  const glob = new Bun.Glob("**/*")
  for await (const relative of glob.scan({
    cwd: ctx.staticDir,
    onlyFiles: true,
    followSymlinks: true,
  })) {
    const srcPath = path.join(ctx.staticDir, relative)
    await assertRealPathInside(srcPath, realStaticDir, "dir.static", ctx.staticDir)
    const destPath = path.join(ctx.outputDir, relative)
    registry.register(destPath, srcPath)
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
