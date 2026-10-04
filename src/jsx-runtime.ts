const RAW = Symbol.for("aid.jsx.raw")

/** Marker type for `<>...</>`. It renders only its children. */
export const Fragment = Symbol.for("aid.jsx.fragment")

/** Anything a component may return or take as children. `null`, `undefined` and booleans render as nothing. */
export type Child = string | number | bigint | boolean | null | undefined | Element | Child[]

/**
 * Any function component. The parameter is `never` because function parameters
 * are contravariant, so a component with a stricter props type still fits.
 */
export type Component = (_: never) => Child

/** A node built by `jsx()`. `render` turns it into HTML. */
export type Element = {
  readonly __aid_jsx: true
  readonly type: string | Component | typeof Fragment | typeof RAW
  readonly props: Props
}

/** Props passed to an intrinsic tag or a component. */
export type Props = Record<string, unknown> & { children?: Child }

/** JSX factory the TypeScript `react-jsx` transform calls. The `key` argument is ignored. */
export function jsx(type: Element["type"], props: Props, _key?: unknown): Element {
  return { __aid_jsx: true, type, props: props ?? {} }
}

/** Factory for elements with static children. Same as {@link jsx}. */
export const jsxs = jsx
/** Dev-mode factory from `jsx-dev-runtime`. Same as {@link jsx}. */
export const jsxDEV = jsx

/** Insert `html` without escaping. Only pass trusted or already-sanitized markup. */
export function RawHtml({ html }: { html: string }): Element {
  return { __aid_jsx: true, type: RAW, props: { html } }
}

/**
 * Render a node tree to an HTML string. Text and attribute values are escaped.
 * `RawHtml` and `dangerouslySetInnerHTML` content are emitted as-is.
 */
export function render(node: Child): string {
  if (node == null || node === false || node === true) {
    return ""
  }
  if (typeof node === "string") {
    return Bun.escapeHTML(node)
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

/** Render a full page, with the `<!doctype html>` prefix. */
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
    if (key === "key") {
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
    out += ` ${name}="${Bun.escapeHTML(String(value))}"`
  }
  return out
}

const ATTR_REWRITE: Record<string, string> = {
  className: "class",
  htmlFor: "for",
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

/** Types TypeScript reads to check JSX against this runtime. Any tag and attribute is allowed. */
export namespace JSX {
  export type Element = import("./jsx-runtime").Element
  export type IntrinsicAttributes = {
    key?: string | number
  }
  export type ElementChildrenAttribute = {
    children: Record<string, never>
  }
  export type IntrinsicElements = {
    [tag: string]: Record<string, unknown>
  }
}
