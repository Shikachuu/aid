import { realpath } from "node:fs/promises"
import path from "node:path"
import type { AssetRegistry } from "./assets"
import { assertNoSymlinkLoop, assertRealPathInside } from "./internal/paths"
import type { BuildContext } from "./types"

/**
 * Queue a copy of every file in `ctx.staticDir` into `ctx.outputDir` on
 * `registry`. A file that collides with another build output throws. A missing `staticDir` is valid and copies nothing.
 * Symlinks are followed when their real path stays inside `staticDir`; one that leaves it,
 * or a folder symlink that loops back to an ancestor, throws.
 */
export async function copyStaticAssets(ctx: BuildContext, registry: AssetRegistry): Promise<void> {
  if (!(await isDirectory(ctx.staticDir))) {
    return
  }
  const realStaticDir = await realpath(ctx.staticDir)
  const glob = new Bun.Glob("**/*")
  const realDirs = new Map<string, string>()
  for await (const relative of glob.scan({
    cwd: ctx.staticDir,
    onlyFiles: true,
    followSymlinks: true,
  })) {
    const srcPath = path.join(ctx.staticDir, relative)
    await assertNoSymlinkLoop(relative, ctx.staticDir, realStaticDir, "dir.static", realDirs)
    await assertRealPathInside(srcPath, realStaticDir, "dir.static", ctx.staticDir)
    const destPath = path.join(ctx.outputDir, relative)
    registry.write(destPath, srcPath, Bun.file(srcPath))
  }
}

async function isDirectory(p: string): Promise<boolean> {
  try {
    return (await Bun.file(p).stat()).isDirectory()
  } catch {
    return false
  }
}
