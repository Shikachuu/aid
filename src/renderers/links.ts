import type { Element as HastElement, Root as HastRoot } from "hast"
import type { Definition, Link, Root as MdastRoot } from "mdast"
import type { Position } from "unist"
import { visit } from "unist-util-visit"
import type { VFile } from "vfile"
import type { ResolveLink } from "../core/links"
import type { AnchorRef } from "../core/types"

/** One href in a tree, with its source position and a setter for the rewritten value. */
export type LinkRef = { href: string; place?: Position; set: (href: string) => void }

/** Link and definition nodes of a markdown tree, so reference-style links rewrite too. */
export function linkRefsFromMdast(tree: MdastRoot): LinkRef[] {
  const refs: LinkRef[] = []
  visit(tree, ["link", "definition"], (node) => {
    const target = node as Link | Definition
    refs.push({ href: target.url, place: target.position, set: (href) => (target.url = href) })
  })
  return refs
}

/** `<a href>` elements of an HTML tree. */
export function linkRefsFromHast(tree: HastRoot): LinkRef[] {
  const refs: LinkRef[] = []
  visit(tree, "element", (node: HastElement) => {
    const href = node.properties?.href
    if (node.tagName === "a" && typeof href === "string") {
      refs.push({ href, place: node.position, set: (value) => (node.properties.href = value) })
    }
  })
  return refs
}

/**
 * Rewrite every ref through `resolve`. Broken refs stay as written and become
 * VFile messages with an `aid` source. Page links that carry a fragment are
 * returned for the anchor check, which can only run once every page has rendered.
 */
export async function rewriteLinks(
  refs: LinkRef[],
  resolve: ResolveLink,
  file: VFile,
): Promise<AnchorRef[]> {
  const anchorRefs: AnchorRef[] = []
  await Promise.all(
    refs.map(async (ref) => {
      const resolved = await resolve(ref.href)
      switch (resolved.kind) {
        case "skip":
          return
        case "broken":
          file.message(resolved.reason, { place: ref.place, ruleId: resolved.code, source: "aid" })
          return
        case "asset":
          ref.set(resolved.href)
          return
        case "page":
          ref.set(resolved.href)
          if (resolved.fragment !== "") {
            anchorRefs.push({
              routePath: resolved.routePath,
              fragment: resolved.fragment,
              href: ref.href,
              line: ref.place?.start.line,
              col: ref.place?.start.column,
            })
          }
      }
    }),
  )
  return anchorRefs
}
