import path from "node:path"
import type { AssetRegistry } from "./assets"
import type { BuildContext } from "./types"

/** Inputs for {@link copyStaticAssets}. */
export type CopyStaticAssetsArgs = {
  ctx: BuildContext
  /** Shared registry tracking every output write across the build. */
  registry: AssetRegistry
}

/** Result of a static-asset copy pass. */
export type CopyStaticAssetsResult = {
  /** Number of files copied. `0` when the static directory doesn't exist. */
  copied: number
}

/**
 * Mirror `ctx.staticDir` into `ctx.outputDir`, preserving the directory
 * structure. Files clobber any existing entries at the same path — the user
 * authored them, so they win over any aid-generated counterpart with the same
 * name. Silently no-ops when `staticDir` does not exist; an absent `static/`
 * is a valid project shape.
 */
export async function copyStaticAssets(
  args: CopyStaticAssetsArgs,
): Promise<CopyStaticAssetsResult> {
  const { ctx, registry } = args
  if (!(await isDirectory(ctx.staticDir))) return { copied: 0 }
  const glob = new Bun.Glob("**/*")
  let copied = 0
  for await (const relative of glob.scan({ cwd: ctx.staticDir, onlyFiles: true })) {
    const srcPath = path.join(ctx.staticDir, relative)
    const destPath = path.join(ctx.outputDir, relative)
    registry.register(destPath, srcPath)
    // Bun.write auto-creates parent dirs; no explicit mkdir needed.
    await Bun.write(destPath, Bun.file(srcPath))
    copied++
  }
  return { copied }
}

async function isDirectory(p: string): Promise<boolean> {
  try {
    const s = await Bun.file(p).stat()
    return s.isDirectory()
  } catch {
    return false
  }
}
