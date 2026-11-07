import type { Image, Root as MdastRoot } from "mdast"
import { visit } from "unist-util-visit"
import type { VFile } from "vfile"
import { type AssetRef, type ColocatedAssetsOptions, copyColocated } from "./colocated-assets"

/**
 * The markdown counterpart of `colocatedAssetsPlugin`. It runs on the mdast
 * tree, so both the HTML and the `.md` export get the rewritten href.
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
