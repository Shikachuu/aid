import path from "node:path"
import type { Element as HastElement, Root as HastRoot } from "hast"
import { visit } from "unist-util-visit"
import type { VFile } from "vfile"
import { splitHref } from "../../core/links"

/**
 * Callback invoked once per relative `<img src>` discovered in a rendered
 * page. Implementations copy the file and return the public href to
 * substitute. Returning `null` means the file does not exist: the plugin then
 * adds an `image/missing` message to the VFile and leaves the src untouched.
 */
export type CopyAsset = (absoluteSource: string) => Promise<string | null>

/** Where relative srcs resolve and what copies them; shared by the HTML and markdown plugins. */
export type ColocatedAssetsOptions = {
  /** Absolute directory of the source file. */
  sourceDir: string
  copyAsset: CopyAsset
}

/**
 * Rehype plugin that detects `<img src>` values pointing at files next to the
 * source file (relative paths like `./hero.png` or `../diagrams/x.svg`)
 * and delegates the actual copy to {@link CopyAsset}. The returned public href
 * replaces the original src. Absolute URLs, fragment links, and scheme-prefixed
 * sources such as `https:` and `data:` pass through untouched.
 */
export function colocatedAssetsPlugin(opts: ColocatedAssetsOptions) {
  return async (tree: HastRoot, file: VFile): Promise<void> => {
    const refs: AssetRef[] = []
    visit(tree, "element", (node: HastElement) => {
      const src = node.properties?.src
      if (node.tagName === "img" && typeof src === "string") {
        refs.push({ src, place: node.position, set: (href) => (node.properties.src = href) })
      }
    })
    await copyColocated(opts, file, refs)
  }
}

/** An asset reference in either tree kind, so {@link copyColocated} serves hast and mdast alike. */
export type AssetRef = { src: string; place?: HastElement["position"]; set: (href: string) => void }

/**
 * Copy every relative `ref` through `opts.copyAsset` and point it at the
 * returned public href. The path is percent-decoded before the lookup, and a
 * query or fragment carries over to the new href. A missing asset leaves the
 * ref untouched and adds an `image/missing` message to `file`.
 */
export async function copyColocated(
  opts: ColocatedAssetsOptions,
  file: VFile,
  refs: AssetRef[],
): Promise<void> {
  await Promise.all(
    refs
      .filter((ref) => isRelativeUrl(ref.src))
      .map(async (ref) => {
        const { pathPart, query, fragment } = splitHref(ref.src)
        const href = await opts.copyAsset(path.resolve(opts.sourceDir, safeDecodeUri(pathPart)))
        if (href == null) {
          file.message(`colocated image not found: ${ref.src}`, {
            place: ref.place,
            ruleId: "image/missing",
            source: "aid",
          })
        } else {
          ref.set(`${href}${query}${fragment === "" ? "" : `#${fragment}`}`)
        }
      }),
  )
}

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i

/** A URL that resolves against the page's source folder: no scheme, no leading `/`, not only a fragment. */
export const isRelativeUrl = (url: string): boolean =>
  splitHref(url).pathPart.length > 0 && !url.startsWith("/") && !SCHEME_RE.test(url)

function safeDecodeUri(value: string): string {
  try {
    return decodeURI(value)
  } catch {
    return value
  }
}
