const RAW = Symbol.for("aid.jsx.raw")

export const Fragment = Symbol.for("aid.jsx.fragment")

export type Child = string | number | bigint | boolean | null | undefined | Element | Child[]

// Components may declare any specific Props shape — at the dispatcher boundary
// we type-erase to a permissive callable. Variance bites here: a stricter prop
// type cannot be assigned to a function expecting `Props`. `(_: never) => Child`
// is the canonical "accepts any function returning Child" type.
export type Component = (_: never) => Child

export type Element = {
  readonly __aid_jsx: true
  readonly type: string | Component | typeof Fragment | typeof RAW
  readonly props: Props
}

export type Props = Record<string, unknown> & { children?: Child }

export function jsx(type: Element["type"], props: Props, _key?: unknown): Element {
  return { __aid_jsx: true, type, props: props ?? {} }
}

export const jsxs = jsx
export const jsxDEV = jsx

export function RawHtml({ html }: { html: string }): Element {
  return { __aid_jsx: true, type: RAW, props: { html } }
}

export function render(node: Child): string {
  if (node == null || node === false || node === true) {
    return ""
  }
  if (typeof node === "string") {
    return escapeHtml(node)
  }
  if (typeof node === "number" || typeof node === "bigint") {
    return String(node)
  }
  if (Array.isArray(node)) {
    let out = ""
    for (const child of node) {
      out += render(child)
    }
    return out
  }
  if (typeof node === "object" && (node as Element).__aid_jsx) {
    const el = node as Element
    if (el.type === Fragment) {
      return render(el.props.children)
    }
    if (el.type === RAW) {
      return String((el.props as { html: string }).html)
    }
    if (typeof el.type === "function") {
      return render((el.type as (props: Props) => Child)(el.props))
    }
    if (typeof el.type === "string") {
      return renderIntrinsic(el.type, el.props)
    }
  }
  return ""
}

export function renderDocument(node: Child): string {
  return `<!doctype html>${render(node)}`
}

function renderIntrinsic(tag: string, props: Props): string {
  const { children, dangerouslySetInnerHTML, ...rest } = props as Props & {
    dangerouslySetInnerHTML?: { __html: string }
  }
  const attrs = renderAttrs(rest)
  if (VOID_ELEMENTS.has(tag)) {
    return `<${tag}${attrs}>`
  }
  if (dangerouslySetInnerHTML) {
    return `<${tag}${attrs}>${dangerouslySetInnerHTML.__html}</${tag}>`
  }
  return `<${tag}${attrs}>${render(children)}</${tag}>`
}

function renderAttrs(attrs: Record<string, unknown>): string {
  let out = ""
  for (const key in attrs) {
    if (key === "children" || key === "key" || key === "ref") {
      continue
    }
    const value = attrs[key]
    if (value == null || value === false) {
      continue
    }
    const name = ATTR_REWRITE[key] ?? key
    if (value === true) {
      out += ` ${name}`
      continue
    }
    if (key === "style" && typeof value === "object") {
      out += ` ${name}="${escapeAttr(serializeStyle(value as Record<string, string | number>))}"`
      continue
    }
    out += ` ${name}="${escapeAttr(String(value))}"`
  }
  return out
}

function serializeStyle(style: Record<string, string | number>): string {
  let out = ""
  for (const k in style) {
    const v = style[k]
    if (v == null) {
      continue
    }
    out += `${kebab(k)}:${typeof v === "number" ? `${v}px` : v};`
  }
  return out
}

function kebab(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
}

const ATTR_REWRITE: Record<string, string> = {
  className: "class",
  htmlFor: "for",
  acceptCharset: "accept-charset",
  httpEquiv: "http-equiv",
}

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
])

const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c] ?? c)
}

function escapeAttr(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c] ?? c)
}

export namespace JSX {
  export type Element = {
    readonly __aid_jsx: true
    readonly type: unknown
    readonly props: Props
  }
  export type ElementChildrenAttribute = {
    children: Record<string, never>
  }
  export type IntrinsicElements = {
    [tag: string]: Record<string, unknown>
  }
}
