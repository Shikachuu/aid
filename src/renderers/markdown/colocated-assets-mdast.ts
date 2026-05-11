import path from "node:path"
import type { Image, Root as MdastRoot } from "mdast"
import { visit } from "unist-util-visit"
import type { VFile } from "vfile"
import { type ColocatedAssetsOptions, isRelative } from "./colocated-assets"

/**
 * Remark plugin that rewrites mdast `image` node URLs pointing at files **next
 * to** the markdown source (relative paths like `./hero.png` or
 * `../diagrams/x.svg`) by delegating the copy to the supplied
 * {@link ColocatedAssetsOptions.copyAsset} callback. Runs once at the mdast
 * stage so both the HTML and `.md` outputs see the rewritten public href.
 * Absolute URLs, fragments, and scheme-prefixed sources pass through.
 */
export function colocatedAssetsMdastPlugin(opts: ColocatedAssetsOptions) {
  return async (tree: MdastRoot, file: VFile): Promise<void> => {
    const tasks: Promise<void>[] = []
    visit(tree, "image", (node: Image) => {
      const src = node.url
      if (typeof src !== "string" || !isRelative(src)) return
      const absSrc = path.resolve(opts.sourceDir, src)
      tasks.push(
        (async () => {
          const href = await opts.copyAsset(absSrc)
          if (href == null) {
            file.message(`colocated image not found: ${src}`, { place: node.position })
            return
          }
          node.url = href
        })(),
      )
    })
    await Promise.all(tasks)
  }
}
