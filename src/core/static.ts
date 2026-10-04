import path from "node:path"
import type { AssetRegistry } from "./assets"
import type { BuildContext } from "./types"

/**
 * Mirror `ctx.staticDir` into `ctx.outputDir`. A file that collides with another
 * build output makes `registry` throw. A missing `staticDir` is valid and copies nothing.
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
