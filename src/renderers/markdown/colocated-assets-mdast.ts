import type { Image, Root as MdastRoot } from "mdast"
import { visit } from "unist-util-visit"
import type { VFile } from "vfile"
import { type AssetRef, type ColocatedAssetsOptions, copyColocated } from "./colocated-assets"

/**
 * Remark plugin that rewrites mdast `image` node URLs pointing at files next
 * to the markdown source (relative paths like `./hero.png` or
 * `../diagrams/x.svg`) by delegating the copy to the supplied
 * {@link ColocatedAssetsOptions.copyAsset} callback. Runs once at the mdast
 * stage so both the HTML and `.md` outputs see the rewritten public href.
 * Absolute URLs, fragments, and scheme-prefixed sources pass through.
 */
export function colocatedAssetsMdastPlugin(opts: ColocatedAssetsOptions) {
  return async (tree: MdastRoot, file: VFile): Promise<void> => {
    const refs: AssetRef[] = []
    visit(tree, "image", (node: Image) => {
      refs.push({ src: node.url, place: node.position, set: (href) => (node.url = href) })
    })
    await copyColocated(opts, file, refs)
  }
}
