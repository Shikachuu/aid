import type { ElementContent, Element as HastElement, Root as HastRoot } from "hast"
import rehypeParse from "rehype-parse"
import { unified } from "unified"
import { visit } from "unist-util-visit"
import type { VFile } from "vfile"
import type { Diagnostic } from "../lint/diagnostics"

/** Concatenated text of a hast node and all its descendants, untrimmed. */
export function hastText(node: HastElement | ElementContent): string {
  if (node.type === "text") {
    return node.value
  }
  return node.type === "element" ? node.children.map(hastText).join("") : ""
}

/** Display label for a slug such as `getting-started`, used where a folder has no page title. */
export function titleCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter((s) => s.length > 0)
    .map((s) => s[0]?.toUpperCase() + s.slice(1))
    .join(" ")
}

/** Copy of `buckets` without its empty lists, so search extras carry only real fields. */
export function nonEmpty(buckets: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(buckets).filter(([, list]) => list.length > 0))
}

/** First paragraph of `text` on one line, used as the llms.txt description of a page. */
export function firstParagraph(text: string | null | undefined): string | undefined {
  const para = text?.split(/\r?\n\s*\r?\n/, 1)[0]?.trim()
  return para ? para.replace(/\s+/g, " ") : undefined
}

/**
 * Every `id` and `name` attribute value in a rendered tree. Raw HTML nodes,
 * which markdown leaves for authored HTML, are parsed as fragments, so an
 * `id=x` in prose or code is not an anchor.
 */
export function collectAnchors(tree: HastRoot): string[] {
  const anchors: string[] = []
  visit(tree, (node) => {
    if (node.type === "element") {
      for (const value of [node.properties.id, node.properties.name]) {
        if (typeof value === "string" && value.length > 0) {
          anchors.push(value)
        }
      }
    } else if (node.type === "raw") {
      anchors.push(...collectAnchors(parseHtmlFragment(node.value)))
    }
  })
  return anchors
}

/** Use for HTML without `<html>` or `<body>`, such as a raw node, so rehype adds no wrapper elements. */
export function parseHtmlFragment(html: string): HastRoot {
  return unified().use(rehypeParse, { fragment: true }).parse(html)
}

/** Text of every h1 to h6 in `tree`, in document order, for the search index. */
export function headingTexts(tree: HastRoot): string[] {
  const headings: string[] = []
  visit(tree, "element", (node) => {
    if (HEADING_TAGS.has(node.tagName) && !isFootnoteLabel(node)) {
      headings.push(hastText(node))
    }
  })
  return headings
}

/** The screen-reader-only "Footnotes" h2 that remark-rehype adds, which is not a page heading. */
export function isFootnoteLabel(node: HastElement): boolean {
  return node.properties.id === "footnote-label"
}

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"])

/**
 * Turn the `aid` messages a renderer left on `file` into diagnostics for
 * `sourcePath`. `file.info` messages become warnings and every other message
 * an error. `lineOffset` maps body positions back to the source when
 * frontmatter was stripped before parsing.
 */
export function vfileDiagnostics(file: VFile, sourcePath: string, lineOffset = 0): Diagnostic[] {
  return file.messages
    .filter((m) => m.source === "aid")
    .map((m) => ({
      file: sourcePath,
      line: m.line === undefined ? undefined : m.line + lineOffset,
      col: m.column,
      severity: m.fatal === undefined ? "warn" : "error",
      code: m.ruleId ?? "aid",
      message: m.reason,
    }))
}

/**
 * A `$ref` that did not resolve. The page still renders, so the diagnostic is
 * a warning: the build report lists it without failing the build.
 */
export function refWarning(file: string, code: string, message: string): Diagnostic {
  return { file, severity: "warn", code, message }
}

/**
 * Throw when a parsed YAML document refers to its own ancestor through an
 * alias. `Bun.YAML` and the OpenAPI parser build a cyclic object from one, and
 * the renderers would recurse until the stack overflows.
 */
export function assertAcyclic(value: unknown, what: string): void {
  const ancestors = new Set<object>()
  const done = new Set<object>()
  const walk = (v: unknown): void => {
    if (typeof v !== "object" || v === null || done.has(v)) {
      return
    }
    if (ancestors.has(v)) {
      throw new Error(`aid: failed to parse ${what}: a YAML alias refers to its own ancestor`)
    }
    ancestors.add(v)
    for (const child of Object.values(v)) {
      walk(child)
    }
    ancestors.delete(v)
    done.add(v)
  }
  walk(value)
}
