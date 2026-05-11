import path from "node:path"
import type { Element as HastElement, Root as HastRoot } from "hast"
import { visit } from "unist-util-visit"
import type { VFile } from "vfile"

/**
 * Callback invoked once per relative `<img src>` discovered in a rendered
 * page. Implementations copy the file to its destination, returning the
 * public href to substitute. Returning `null` means "no such file" — the
 * plugin then attaches a warning to the VFile and leaves the src untouched.
 */
export type CopyAsset = (absoluteSource: string) => Promise<string | null>

/** Inputs for {@link colocatedAssetsPlugin}. */
export type ColocatedAssetsOptions = {
  /** Absolute directory of the markdown source — relative srcs resolve against this. */
  sourceDir: string
  /** Per-asset copy callback supplied by the pipeline. */
  copyAsset: CopyAsset
}

/**
 * Rehype plugin that detects `<img src>` values pointing at files **next to**
 * the markdown source (relative paths like `./hero.png` or `../diagrams/x.svg`)
 * and delegates the actual copy to {@link CopyAsset}. The returned public href
 * replaces the original src. Absolute URLs, fragment links, and scheme-prefixed
 * sources (`https:`, `data:`, …) pass through untouched.
 */
export function colocatedAssetsPlugin(opts: ColocatedAssetsOptions) {
  return async (tree: HastRoot, file: VFile): Promise<void> => {
    const tasks: Promise<void>[] = []
    visit(tree, "element", (node: HastElement) => {
      if (node.tagName !== "img") return
      const src = node.properties?.src
      if (typeof src !== "string" || !isRelative(src)) return
      const absSrc = path.resolve(opts.sourceDir, src)
      tasks.push(
        (async () => {
          const href = await opts.copyAsset(absSrc)
          if (href == null) {
            file.message(`colocated image not found: ${src}`, { place: node.position })
            return
          }
          node.properties.src = href
        })(),
      )
    })
    await Promise.all(tasks)
  }
}

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i

/**
 * `true` for paths the plugin should rewrite: not absolute, not URL-like, not a
 * fragment. Matches `./foo.png`, `../bar/baz.svg`, and bare `foo.png` alike.
 */
export function isRelative(src: string): boolean {
  if (src.length === 0) return false
  if (src.startsWith("/")) return false
  if (src.startsWith("#")) return false
  if (SCHEME_RE.test(src)) return false
  return true
}
