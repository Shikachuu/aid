import path from "node:path"
import type { Diagnostic } from "../lint/diagnostics"
import { NavMetaSchema } from "../renderers/markdown/frontmatter"
import { titleCase } from "../renderers/shared"
import type { BuildContext, NavNode, RenderedPage } from "./types"

/** Sidebar tree plus problems found in `_meta.yaml` files. */
export type NavResult = { tree: NavNode[]; diagnostics: Diagnostic[] }

type Meta = Record<string, { label?: string; order?: number }>

type Folder = {
  segments: string[]
  page?: RenderedPage
  children: Map<string, Folder>
}

type Sortable = { node: NavNode; order: number | undefined; key: string; first: boolean }

const META_FILE = "_meta.yaml"
const ROOT_KEY = "index"

/**
 * Build the sidebar from the rendered pages. Folders become groups, a folder's
 * `index` page (or a sibling page with the folder's name) becomes the group
 * link, and a folder holding only that page renders as a plain link. Labels
 * and order come from the folder's `_meta.yaml`, then page frontmatter
 * `sidebar`, then the page title.
 */
export async function buildNav(ctx: BuildContext, pages: RenderedPage[]): Promise<NavResult> {
  const root: Folder = { segments: [], children: new Map() }
  for (const page of pages) {
    let folder = root
    for (const segment of page.route.path.split("/").filter(Boolean)) {
      let child = folder.children.get(segment)
      if (!child) {
        child = { segments: [...folder.segments, segment], children: new Map() }
        folder.children.set(segment, child)
      }
      folder = child
    }
    folder.page = page
  }
  const diagnostics: Diagnostic[] = []
  const tree = await folderItems(root, ctx, diagnostics)
  return { tree, diagnostics }
}

async function folderItems(
  folder: Folder,
  ctx: BuildContext,
  diagnostics: Diagnostic[],
): Promise<NavNode[]> {
  const isRoot = folder.segments.length === 0
  const metaPath = path.join(ctx.contentDir, ...folder.segments, META_FILE)
  const meta = await readMeta(metaPath)
  for (const key of Object.keys(meta)) {
    if (!folder.children.has(key) && !(isRoot && key === ROOT_KEY && folder.page)) {
      diagnostics.push({
        file: metaPath,
        severity: "error",
        code: "nav/unknown-entry",
        message: `entry "${key}" matches no page or folder next to ${META_FILE}`,
      })
    }
  }

  const items: Sortable[] = []
  if (isRoot && folder.page) {
    items.push(sortable(ROOT_KEY, meta[ROOT_KEY], folder.page, true))
  }
  for (const [segment, child] of folder.children) {
    const item = sortable(segment, meta[segment], child.page, false)
    if (child.children.size > 0) {
      item.node.children = await folderItems(child, ctx, diagnostics)
    }
    items.push(item)
  }
  return items.toSorted(compareItems).map((item) => item.node)
}

function sortable(
  key: string,
  entry: Meta[string] | undefined,
  page: RenderedPage | undefined,
  first: boolean,
): Sortable {
  const sidebar = page?.route.frontmatter?.sidebar
  const label = entry?.label ?? sidebar?.label ?? page?.searchTokens.title ?? titleCase(key)
  const node: NavNode = page ? { label, path: page.route.path } : { label }
  return { node, order: entry?.order ?? sidebar?.order, key, first }
}

function compareItems(a: Sortable, b: Sortable): number {
  if (a.order !== b.order) {
    if (a.order === undefined) {
      return 1
    }
    if (b.order === undefined) {
      return -1
    }
    return a.order - b.order
  }
  if (a.first !== b.first) {
    return a.first ? -1 : 1
  }
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
}

async function readMeta(file: string): Promise<Meta> {
  const handle = Bun.file(file)
  if (!(await handle.exists())) {
    return {}
  }
  try {
    return NavMetaSchema.parse(Bun.YAML.parse(await handle.text()) ?? {})
  } catch (err) {
    throw new Error(`aid: invalid ${file}: ${(err as Error).message}`)
  }
}
