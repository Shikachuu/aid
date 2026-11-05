import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

type SchemaObject = Record<string, unknown>

/** Where a field sits in its parent, which decides how the page labels it. */
export type SchemaNodeKind =
  "root" | "definition" | "property" | "pattern" | "additional" | "items" | "option"

/** A `$ref` on a field. `href` is set when the page links to the target instead of expanding it. */
export type SchemaRef = { label: string; href?: string }

/** A `oneOf`, `anyOf`, or unmergeable `allOf` group under one field. */
export type SchemaVariantGroup = { kind: "oneOf" | "anyOf" | "allOf"; options: SchemaNode[] }

/** One field of the rendered page: everything the components need, with `$ref`s already resolved. */
export type SchemaNode = {
  kind: SchemaNodeKind
  label: string
  elementId: string
  /** Dotted path from the schema root, with `[]` after an array field, such as `tags[].name`. */
  path: string
  required: boolean
  /** Declared or inferred types, without `null`. */
  types: string[]
  nullable: boolean
  format?: string
  title?: string
  description?: string
  deprecated: boolean
  readOnly: boolean
  writeOnly: boolean
  enum?: unknown[]
  const?: { value: unknown }
  default?: { value: unknown }
  examples: unknown[]
  /** Every keyword the page does not render elsewhere, in source order. */
  constraints: [string, unknown][]
  properties: SchemaNode[]
  prefixItems: SchemaNode[]
  items?: SchemaNode
  variants: SchemaVariantGroup[]
  ref?: SchemaRef
}

/** A parsed JSON Schema document, ready to render. */
export type SchemaDocument = {
  title?: string
  dialect?: string
  root: SchemaNode
  /** Root `$defs` and `definitions` entries, each with an anchored section. */
  definitions: SchemaNode[]
  /** Root `examples`, or one synthesized example. Empty when nothing can be built. */
  examples: unknown[]
  warnings: string[]
  /** Definition anchors on other schema pages that `$ref`s link to, for the build's anchor check. */
  pageLinks: { file: string; fragment: string; href: string }[]
}

/** Where the schema lives, so relative `$ref`s resolve, and how to link ones that hit other schema pages. */
export type BuildSchemaOptions = {
  /** Absolute path of the source file. Relative `$ref`s resolve against it. */
  sourcePath: string
  /** Page URL of another schema file in the content tree, or undefined when it is not a page. */
  pageUrlForFile?: (absPath: string) => string | undefined
}

const MAX_DEPTH = 32
const DRAFT_04_RE = /json-schema\.org\/draft-0[34]\/schema/
const MAX_NODES = 2000
const MAX_EXAMPLE_DEPTH = 8

const SCHEMA_ARRAY_KEYS = new Set(["allOf", "anyOf", "oneOf", "prefixItems"])
const SCHEMA_MAP_KEYS = new Set([
  "$defs",
  "definitions",
  "properties",
  "patternProperties",
  "dependentSchemas",
  "dependencies",
])
const SCHEMA_VALUE_KEYS = new Set([
  "items",
  "additionalItems",
  "additionalProperties",
  "unevaluatedItems",
  "unevaluatedProperties",
  "contains",
  "propertyNames",
  "not",
  "if",
  "then",
  "else",
])

const CONSUMED = new Set([
  "$schema",
  "$id",
  "$anchor",
  "$dynamicAnchor",
  "$defs",
  "definitions",
  "$ref",
  "title",
  "description",
  "type",
  "format",
  "deprecated",
  "readOnly",
  "writeOnly",
  "nullable",
  "enum",
  "const",
  "default",
  "examples",
  "example",
  "properties",
  "required",
  "patternProperties",
  "prefixItems",
  "oneOf",
  "anyOf",
  "allOf",
])

const CHILD_KEYS = new Set([
  "properties",
  "patternProperties",
  "additionalProperties",
  "items",
  "prefixItems",
  "additionalItems",
  "oneOf",
  "anyOf",
  "allOf",
])

const FORMAT_SAMPLES: Record<string, string> = {
  "date-time": "2024-01-01T00:00:00Z",
  date: "2024-01-01",
  time: "12:00:00Z",
  email: "user@example.com",
  uri: "https://example.com",
  url: "https://example.com",
  hostname: "example.com",
  uuid: "123e4567-e89b-12d3-a456-426614174000",
  ipv4: "192.0.2.1",
  ipv6: "2001:db8::1",
}

type Resolved =
  | { kind: "local"; target: unknown; base: string; label: string }
  | { kind: "external"; file: string; fragment: string; label: string }
  | { kind: "missing"; label: string }

type NodeInfo = {
  kind: SchemaNodeKind
  label: string
  elementId: string
  path: string
  required: boolean
}

const isObject = (v: unknown): v is SchemaObject =>
  typeof v === "object" && v !== null && !Array.isArray(v)

/**
 * Turn a parsed JSON Schema into the tree the page renders. Local `$ref`s
 * expand inline. A `$ref` back into a schema already on the current path, or
 * past the depth and size caps, stops expanding, so recursive schemas
 * terminate; it links to the definition section when the target is a root
 * definition. `$ref`s to other schema pages link there. A `$ref` that does not
 * resolve keeps its name and adds a warning.
 */
export function buildSchemaDocument(raw: unknown, opts: BuildSchemaOptions): SchemaDocument {
  if (!isObject(raw) && typeof raw !== "boolean") {
    throw new Error(
      `aid: failed to parse JSON Schema at ${opts.sourcePath}: the root is not an object or boolean schema`,
    )
  }
  return new Builder(raw, opts).document()
}

class Builder {
  private readonly ids = new Map<string, unknown>()
  private readonly anchors = new Map<string, unknown>()
  private readonly baseOf = new Map<unknown, string>()
  private readonly defAnchor = new Map<unknown, string>()
  private readonly usedIds = new Set<string>()
  private readonly stack = new Set<unknown>()
  private readonly warnings = new Set<string>()
  private readonly pageLinks: SchemaDocument["pageLinks"] = []
  private readonly fileBase: string
  private readonly legacyIds: boolean
  private depth = 0
  private nodes = 0
  private exampleNodes = 0

  constructor(
    private readonly root: SchemaObject | boolean,
    private readonly opts: BuildSchemaOptions,
  ) {
    this.fileBase = pathToFileURL(opts.sourcePath).href
    this.legacyIds =
      isObject(root) && typeof root.$schema === "string" && DRAFT_04_RE.test(root.$schema)
    this.ids.set(this.fileBase, root)
    this.collect(root, this.fileBase)
  }

  document(): SchemaDocument {
    const root = this.root
    const defs = isObject(root) ? this.definitionEntries(root) : []
    const defIds = defs.map(([name, schema]) => {
      const id = this.uniqueId(`def-${slug(name)}`)
      if (isObject(schema) && !this.defAnchor.has(schema)) {
        this.defAnchor.set(schema, id)
      }
      return id
    })
    this.stack.add(root)
    const rootNode = this.node(
      root,
      { kind: "root", label: "", elementId: "", path: "", required: false },
      this.baseOf.get(root) ?? this.fileBase,
    )
    this.stack.delete(root)
    const definitions = defs.map(([name, schema], i) => {
      const id = defIds[i] ?? ""
      this.stack.add(schema)
      const node = this.node(
        schema,
        { kind: "definition", label: name, elementId: id, path: name, required: false },
        this.baseOf.get(schema) ?? this.fileBase,
      )
      this.stack.delete(schema)
      return node
    })
    return {
      title: (isObject(root) ? stringOr(root.title) : undefined) ?? rootNode.title,
      dialect: isObject(root) && typeof root.$schema === "string" ? root.$schema : undefined,
      root: rootNode,
      definitions,
      examples: this.documentExamples(root),
      warnings: [...this.warnings],
      pageLinks: this.pageLinks,
    }
  }

  private definitionEntries(root: SchemaObject): [string, unknown][] {
    return ["$defs", "definitions"].flatMap((key) => {
      const map = root[key]
      return isObject(map) ? Object.entries(map) : []
    })
  }

  private collect(schema: unknown, base: string): void {
    if (!isObject(schema)) {
      return
    }
    let here = base
    const id = this.idOf(schema)
    if (id?.startsWith("#")) {
      this.anchors.set(`${base}${id}`, schema)
    } else if (id !== undefined) {
      const resolved = tryUrl(id, base)
      if (resolved) {
        here = stripHash(resolved)
        this.ids.set(here, schema)
      }
    }
    this.baseOf.set(schema, here)
    for (const key of ["$anchor", "$dynamicAnchor"]) {
      const anchor = schema[key]
      if (typeof anchor === "string") {
        this.anchors.set(`${here}#${anchor}`, schema)
      }
    }
    for (const [key, value] of Object.entries(schema)) {
      if (SCHEMA_VALUE_KEYS.has(key)) {
        if (Array.isArray(value)) {
          for (const v of value) {
            this.collect(v, here)
          }
        } else {
          this.collect(value, here)
        }
      } else if (SCHEMA_ARRAY_KEYS.has(key) && Array.isArray(value)) {
        for (const v of value) {
          this.collect(v, here)
        }
      } else if (SCHEMA_MAP_KEYS.has(key) && isObject(value)) {
        for (const v of Object.values(value)) {
          this.collect(v, here)
        }
      }
    }
  }

  private idOf(schema: SchemaObject): string | undefined {
    const id = schema.$id ?? (this.legacyIds ? schema.id : undefined)
    return typeof id === "string" ? id : undefined
  }

  private resolve(ref: string, base: string): Resolved {
    const url = tryUrl(ref, base)
    const fallbackLabel = refLabel(ref)
    if (!url) {
      return { kind: "missing", label: fallbackLabel }
    }
    const hashAt = url.indexOf("#")
    const docUrl = hashAt === -1 ? url : url.slice(0, hashAt)
    const fragment = hashAt === -1 ? "" : url.slice(hashAt + 1)
    const doc = this.ids.get(docUrl)
    if (doc === undefined) {
      const file = this.externalFile(ref, docUrl)
      return file
        ? { kind: "external", file, fragment, label: fallbackLabel }
        : { kind: "missing", label: fallbackLabel }
    }
    const target =
      fragment === ""
        ? doc
        : fragment.startsWith("/")
          ? pointer(doc, fragment)
          : this.anchors.get(`${docUrl}#${safeDecode(fragment)}`)
    if (target === undefined) {
      return { kind: "missing", label: fallbackLabel }
    }
    const label =
      target === this.root
        ? (stringOr(isObject(target) ? target.title : undefined) ?? "root")
        : fallbackLabel
    return { kind: "local", target, base: this.baseOf.get(target) ?? docUrl, label }
  }

  private externalFile(ref: string, docUrl: string): string | undefined {
    if (docUrl.startsWith("file:")) {
      return fileURLToPath(docUrl)
    }
    const refPath = ref.split("#", 1)[0] ?? ""
    if (refPath !== "" && !/^[a-z][a-z0-9+.-]*:/i.test(refPath)) {
      return path.resolve(path.dirname(this.opts.sourcePath), safeDecode(refPath))
    }
    return undefined
  }

  private node(schema: unknown, info: NodeInfo, base: string): SchemaNode {
    this.nodes++
    if (!isObject(schema)) {
      return emptyNode(info, schema === false ? ["never"] : [])
    }
    if (typeof schema.$ref === "string") {
      return this.refNode(schema, schema.$ref, info, base)
    }
    const here = this.baseOf.get(schema) ?? base
    return this.withMergedAllOf(schema, here, (merged) =>
      this.plainNode(merged ?? schema, info, here),
    )
  }

  private withMergedAllOf<T>(
    schema: SchemaObject,
    base: string,
    use: (merged: SchemaObject | null) => T,
  ): T {
    const inlined: unknown[] = []
    const merged = Array.isArray(schema.allOf)
      ? this.mergeAllOf(schema, base, new Set(), inlined)
      : null
    const entered = merged ? inlined.filter((target) => !this.stack.has(target)) : []
    for (const target of entered) {
      this.stack.add(target)
    }
    try {
      return use(merged)
    } finally {
      for (const target of entered) {
        this.stack.delete(target)
      }
    }
  }

  private refNode(schema: SchemaObject, ref: string, info: NodeInfo, base: string): SchemaNode {
    const { $ref: _, ...siblings } = schema
    const res = this.resolve(ref, base)
    if (res.kind === "local" && !this.mustCollapse(res.target)) {
      const target = res.target
      const isObj = isObject(target)
      if (isObj) {
        this.stack.add(target)
      }
      this.depth++
      const node = this.node(isObj ? overlayRefSiblings(target, siblings) : target, info, res.base)
      this.depth--
      if (isObj) {
        this.stack.delete(target)
      }
      node.ref = { label: res.label }
      return node
    }
    const node = this.node(siblings, info, base)
    node.ref = { label: res.label, href: this.refHref(ref, res) }
    return node
  }

  private mustCollapse(target: unknown): boolean {
    return (
      (isObject(target) && this.stack.has(target)) ||
      this.depth >= MAX_DEPTH ||
      this.nodes >= MAX_NODES
    )
  }

  private refHref(ref: string, res: Resolved): string | undefined {
    if (res.kind === "local") {
      const def = this.defAnchor.get(res.target)
      return def ? `#${def}` : res.target === this.root ? "#top" : undefined
    }
    const page = res.kind === "external" ? this.opts.pageUrlForFile?.(res.file) : undefined
    if (res.kind === "external" && page) {
      const def = /^\/(?:\$defs|definitions)\/([^/]+)$/.exec(res.fragment)?.[1]
      if (def === undefined) {
        return page
      }
      const fragment = `def-${slug(pointerSegment(def))}`
      this.pageLinks.push({ file: res.file, fragment, href: ref })
      return `${page}#${fragment}`
    }
    this.warnings.add(`unresolved $ref "${ref}"`)
    return /^https?:\/\//i.test(ref) ? ref : undefined
  }

  private plainNode(s: SchemaObject, info: NodeInfo, base: string): SchemaNode {
    const node = emptyNode(info, [])
    const types = declaredTypes(s)
    const onlyNull = types.length === 1 && types[0] === "null"
    node.types = onlyNull ? types : types.filter((t) => t !== "null")
    node.nullable = !onlyNull && (types.includes("null") || s.nullable === true)
    node.format = stringOr(s.format)
    node.title = stringOr(s.title)
    node.description = stringOr(s.description)
    node.deprecated = s.deprecated === true
    node.readOnly = s.readOnly === true
    node.writeOnly = s.writeOnly === true
    node.required = info.required || s.required === true
    if (Array.isArray(s.enum) && s.enum.length > 0) {
      node.enum = s.enum
    }
    if ("const" in s) {
      node.const = { value: s.const }
    }
    if ("default" in s) {
      node.default = { value: s.default }
    }
    node.examples = [
      ...(Array.isArray(s.examples) ? s.examples : []),
      ...("example" in s ? [s.example] : []),
    ]

    this.depth++
    const truncated = this.depth >= MAX_DEPTH
    if (!truncated) {
      this.children(s, node, base)
    }
    this.depth--

    const unshownRequired = !Array.isArray(s.required)
      ? []
      : truncated
        ? s.required
        : s.required.filter(
            (name) => !(isObject(s.properties) && Object.hasOwn(s.properties, name)),
          )
    if (unshownRequired.length > 0) {
      node.constraints.push(["required", unshownRequired])
    }
    for (const [key, value] of Object.entries(s)) {
      if (truncated && CHILD_KEYS.has(key)) {
        node.constraints.push([key, value])
        continue
      }
      if (CONSUMED.has(key) || (key === "id" && this.legacyIds)) {
        continue
      }
      if ((key === "additionalProperties" || key === "items") && isObject(value)) {
        continue
      }
      if (key === "items" && Array.isArray(value)) {
        continue
      }
      if (key === "additionalItems" && Array.isArray(s.items) && isObject(value)) {
        continue
      }
      node.constraints.push([key, value])
    }
    return node
  }

  private children(s: SchemaObject, node: SchemaNode, base: string): void {
    const required = new Set(
      Array.isArray(s.required) ? s.required.filter((r) => typeof r === "string") : [],
    )
    if (isObject(s.properties)) {
      for (const [name, sub] of Object.entries(s.properties)) {
        node.properties.push(
          this.child(sub, node, "property", name, name, required.has(name), base),
        )
      }
    }
    if (isObject(s.patternProperties)) {
      for (const [pattern, sub] of Object.entries(s.patternProperties)) {
        node.properties.push(this.child(sub, node, "pattern", pattern, pattern, false, base))
      }
    }
    if (isObject(s.additionalProperties)) {
      node.properties.push(
        this.child(s.additionalProperties, node, "additional", "*", "*", false, base),
      )
    }
    const tuple = Array.isArray(s.prefixItems)
      ? s.prefixItems
      : Array.isArray(s.items)
        ? s.items
        : []
    tuple.forEach((sub, i) => {
      node.prefixItems.push(this.child(sub, node, "items", `[${i}]`, `[${i}]`, false, base))
    })
    const rest = Array.isArray(s.items) ? s.additionalItems : s.items
    if (isObject(rest)) {
      node.items = this.child(rest, node, "items", "[]", "[]", false, base)
    }
    for (const kind of ["oneOf", "anyOf", "allOf"] as const) {
      const list = s[kind]
      if (!Array.isArray(list) || list.length === 0) {
        continue
      }
      const options = list.map((sub, i) => {
        const option = this.child(
          sub,
          node,
          "option",
          `Option ${i + 1}`,
          `${kind}${i}`,
          false,
          base,
        )
        option.label = option.title ?? option.ref?.label ?? option.label
        return option
      })
      node.variants.push({ kind, options })
    }
  }

  private child(
    sub: unknown,
    parent: SchemaNode,
    kind: SchemaNodeKind,
    label: string,
    segment: string,
    required: boolean,
    base: string,
  ): SchemaNode {
    const pathSeg = kind === "option" ? "" : segment
    const childPath =
      parent.path === "" ? pathSeg : pathSeg === "" ? parent.path : joinPath(parent.path, pathSeg)
    const idSeg = kind === "items" ? segment.slice(1, -1) || "items" : segment
    const idBase =
      parent.kind === "root" ? `prop-${slug(idSeg)}` : `${parent.elementId}.${slug(idSeg)}`
    return this.node(
      sub,
      { kind, label, elementId: this.uniqueId(idBase), path: childPath, required },
      base,
    )
  }

  private mergeAllOf(
    s: SchemaObject,
    base: string,
    seen = new Set<unknown>(),
    inlined: unknown[] = [],
  ): SchemaObject | null {
    const members: SchemaObject[] = []
    for (const m of s.allOf as unknown[]) {
      const member = this.derefForMerge(m, base, seen, inlined)
      if (!member) {
        return null
      }
      members.push(member)
    }
    const { allOf: _, ...own } = s
    const merged: SchemaObject = {}
    const properties: SchemaObject = Object.create(null)
    const required: unknown[] = []
    for (const part of [...members, own]) {
      for (const [key, value] of Object.entries(part)) {
        if (key === "properties" && isObject(value)) {
          mergePropertyDeclarations(properties, value)
        } else if (key === "required" && Array.isArray(value)) {
          required.push(...value)
        } else if (key === "title" || key === "description" || key === "$comment") {
          merged[key] = value
        } else if (key in merged && JSON.stringify(merged[key]) !== JSON.stringify(value)) {
          return null
        } else {
          merged[key] = value
        }
      }
    }
    if (Object.keys(properties).length > 0) {
      merged.properties = properties
    }
    if (required.length > 0) {
      merged.required = [...new Set(required)]
    }
    return merged
  }

  private derefForMerge(
    m: unknown,
    base: string,
    seen: Set<unknown>,
    inlined: unknown[],
  ): SchemaObject | null {
    if (!isObject(m)) {
      return m === true ? {} : null
    }
    const onPath: unknown[] = []
    try {
      let current: SchemaObject = m
      let currentBase = base
      while (typeof current.$ref === "string") {
        const res = this.resolve(current.$ref, currentBase)
        if (
          res.kind !== "local" ||
          res.base !== base ||
          !isObject(res.target) ||
          this.mustCollapse(res.target) ||
          seen.has(res.target)
        ) {
          return null
        }
        seen.add(res.target)
        onPath.push(res.target)
        inlined.push(res.target)
        const { $ref: _, ...siblings } = current
        current = overlayRefSiblings(res.target, siblings)
        currentBase = res.base
      }
      if (["oneOf", "anyOf", "not", "if"].some((k) => k in current)) {
        return null
      }
      return Array.isArray(current.allOf)
        ? this.mergeAllOf(current, currentBase, seen, inlined)
        : current
    } finally {
      for (const target of onPath) {
        seen.delete(target)
      }
    }
  }

  private documentExamples(root: SchemaObject | boolean): unknown[] {
    if (isObject(root) && Array.isArray(root.examples) && root.examples.length > 0) {
      return root.examples
    }
    this.stack.add(root)
    const example = this.example(root, this.baseOf.get(root) ?? this.fileBase, 0)
    this.stack.delete(root)
    return example === undefined ? [] : [example]
  }

  private example(schema: unknown, base: string, depth: number): unknown {
    if (!isObject(schema) || depth > MAX_EXAMPLE_DEPTH || ++this.exampleNodes > MAX_NODES) {
      return undefined
    }
    if (Array.isArray(schema.examples) && schema.examples.length > 0) {
      return schema.examples[0]
    }
    for (const key of ["example", "default", "const"]) {
      if (key in schema) {
        return schema[key]
      }
    }
    if (Array.isArray(schema.enum) && schema.enum.length > 0) {
      return schema.enum[0]
    }
    if (typeof schema.$ref === "string") {
      const res = this.resolve(schema.$ref, base)
      if (res.kind !== "local" || !isObject(res.target) || this.stack.has(res.target)) {
        return undefined
      }
      const { $ref: _, ...siblings } = schema
      this.stack.add(res.target)
      const value = this.example(overlayRefSiblings(res.target, siblings), res.base, depth + 1)
      this.stack.delete(res.target)
      return value
    }
    if (Array.isArray(schema.allOf)) {
      const merged = this.withMergedAllOf(schema, base, (m) =>
        m ? { value: this.example(m, base, depth) } : null,
      )
      if (merged) {
        return merged.value
      }
      const parts = schema.allOf.map((m) => this.example(m, base, depth + 1))
      return parts.every(isObject)
        ? Object.assign(Object.create(null), ...parts)
        : parts.find((p) => p !== undefined)
    }
    for (const key of ["oneOf", "anyOf"]) {
      const list = schema[key]
      if (Array.isArray(list) && list.length > 0) {
        return this.example(list[0], base, depth + 1)
      }
    }
    const types = declaredTypes(schema)
    switch (types.find((t) => t !== "null") ?? types[0]) {
      case "object":
        return this.objectExample(schema, base, depth)
      case "array":
        return this.arrayExample(schema, base, depth)
      case "string":
        return Object.hasOwn(FORMAT_SAMPLES, schema.format as string)
          ? FORMAT_SAMPLES[schema.format as string]
          : stringExample(schema)
      case "number":
      case "integer":
        return numberExample(schema, types.includes("integer"))
      case "boolean":
        return true
      case "null":
        return null
      default:
        return undefined
    }
  }

  private objectExample(schema: SchemaObject, base: string, depth: number): SchemaObject {
    const out: SchemaObject = Object.create(null)
    if (isObject(schema.properties)) {
      for (const [key, sub] of Object.entries(schema.properties)) {
        const value = this.example(sub, base, depth + 1)
        if (value !== undefined) {
          out[key] = value
        }
      }
    }
    return out
  }

  private arrayExample(schema: SchemaObject, base: string, depth: number): unknown[] {
    const tuple = Array.isArray(schema.prefixItems)
      ? schema.prefixItems
      : Array.isArray(schema.items)
        ? schema.items
        : null
    if (tuple) {
      return tuple.map((sub) => this.example(sub, base, depth + 1)).filter((v) => v !== undefined)
    }
    const item = this.example(schema.items, base, depth + 1)
    return item === undefined ? [] : [item]
  }

  private uniqueId(candidate: string): string {
    let id = candidate
    for (let n = 2; this.usedIds.has(id); n++) {
      id = `${candidate}-${n}`
    }
    this.usedIds.add(id)
    return id
  }
}

function overlayRefSiblings(target: SchemaObject, siblings: SchemaObject): SchemaObject {
  const out: SchemaObject = { ...target, ...siblings }
  if (isObject(target.properties) && isObject(siblings.properties)) {
    const properties: SchemaObject = Object.create(null)
    mergePropertyDeclarations(properties, target.properties)
    mergePropertyDeclarations(properties, siblings.properties)
    out.properties = properties
  }
  if (Array.isArray(target.required) && Array.isArray(siblings.required)) {
    out.required = [...new Set([...target.required, ...siblings.required])]
  }
  if (Array.isArray(target.allOf) && Array.isArray(siblings.allOf)) {
    out.allOf = [...target.allOf, ...siblings.allOf]
  }
  return out
}

function mergePropertyDeclarations(into: SchemaObject, more: SchemaObject): void {
  for (const [name, schema] of Object.entries(more)) {
    into[name] = Object.hasOwn(into, name) ? { allOf: [into[name], schema] } : schema
  }
}

function emptyNode(info: NodeInfo, types: string[]): SchemaNode {
  return {
    ...info,
    types,
    nullable: false,
    deprecated: false,
    readOnly: false,
    writeOnly: false,
    examples: [],
    constraints: [],
    properties: [],
    prefixItems: [],
    variants: [],
  }
}

function declaredTypes(s: SchemaObject): string[] {
  if (typeof s.type === "string") {
    return [s.type]
  }
  if (Array.isArray(s.type)) {
    return s.type.filter((t): t is string => typeof t === "string")
  }
  if (isObject(s.properties) || isObject(s.patternProperties) || isObject(s.additionalProperties)) {
    return ["object"]
  }
  if ("items" in s || Array.isArray(s.prefixItems)) {
    return ["array"]
  }
  const values = Array.isArray(s.enum) ? s.enum : "const" in s ? [s.const] : []
  return [...new Set(values.map(jsonType))]
}

function stringExample(s: SchemaObject): string {
  const sample = "string"
  if (typeof s.minLength === "number" && s.minLength > sample.length) {
    return sample.padEnd(s.minLength, "x")
  }
  return typeof s.maxLength === "number" ? sample.slice(0, Math.max(0, s.maxLength)) : sample
}

type Bound = { value: number; exclusive: boolean }

/**
 * The tightest of an inclusive and an exclusive bound. Draft-04 writes an
 * exclusive bound as `minimum` plus `exclusiveMinimum: true`, later drafts as a
 * numeric `exclusiveMinimum`.
 */
function tightestBound(
  s: SchemaObject,
  inclusiveKey: string,
  exclusiveKey: string,
  lower: boolean,
): Bound | undefined {
  const inclusive = s[inclusiveKey]
  const exclusive = s[exclusiveKey]
  const bounds: Bound[] = []
  if (typeof inclusive === "number") {
    bounds.push({ value: inclusive, exclusive: exclusive === true })
  }
  if (typeof exclusive === "number") {
    bounds.push({ value: exclusive, exclusive: true })
  }
  return bounds.reduce<Bound | undefined>((best, b) => {
    if (!best) {
      return b
    }
    const tighter = lower ? b.value > best.value : b.value < best.value
    return tighter || (b.value === best.value && b.exclusive) ? b : best
  }, undefined)
}

function numberExample(s: SchemaObject, integer: boolean): number {
  const lo = tightestBound(s, "minimum", "exclusiveMinimum", true)
  const hi = tightestBound(s, "maximum", "exclusiveMaximum", false)
  const low =
    lo &&
    (integer
      ? lo.exclusive
        ? Math.floor(lo.value) + 1
        : Math.ceil(lo.value)
      : lo.value + (lo.exclusive ? 1 : 0))
  const high =
    hi &&
    (integer
      ? hi.exclusive
        ? Math.ceil(hi.value) - 1
        : Math.floor(hi.value)
      : hi.value - (hi.exclusive ? 1 : 0))
  if (lo && hi && low !== undefined && high !== undefined && low > high) {
    return integer ? low : (lo.value + hi.value) / 2
  }
  return low ?? (high !== undefined && high < 0 ? high : 0)
}

function jsonType(v: unknown): string {
  if (v === null) {
    return "null"
  }
  if (Array.isArray(v)) {
    return "array"
  }
  if (typeof v === "number") {
    return Number.isInteger(v) ? "integer" : "number"
  }
  return typeof v
}

/**
 * The type a field shows, such as `string`, `array<Address>`, `[string, ...integer]`,
 * or `Base & (string | integer)`.
 * A `$ref` shows its target name. A field with no type shows `any`.
 */
export function typeLabel(node: SchemaNode): string {
  if (node.ref) {
    return node.ref.label
  }
  const parts = node.types.map((t) => {
    if (t !== "array") {
      return t
    }
    if (node.prefixItems.length > 0) {
      const rest = node.items ? [`...${typeLabel(node.items)}`] : []
      return `[${[...node.prefixItems.map(typeLabel), ...rest].join(", ")}]`
    }
    return node.items ? `array<${typeLabel(node.items)}>` : "array"
  })
  if (parts.length > 0) {
    return parts.join(" | ")
  }
  if (node.variants.length > 0) {
    return node.variants
      .map((g) => g.options.map(groupedLabel).join(g.kind === "allOf" ? " & " : " | "))
      .join(" & ")
  }
  return "any"
}

function groupedLabel(node: SchemaNode): string {
  const label = typeLabel(node)
  return / [|&] /.test(label) ? `(${label})` : label
}

function refLabel(ref: string): string {
  const hashAt = ref.indexOf("#")
  const fragment = hashAt === -1 ? "" : ref.slice(hashAt + 1)
  if (fragment !== "") {
    const last = fragment.split("/").pop() ?? fragment
    return unescapePointer(safeDecode(last)) || ref
  }
  const file = path.posix.basename(hashAt === -1 ? ref : ref.slice(0, hashAt))
  return file.replace(/(\.schema)?\.(json|ya?ml)$/i, "") || ref
}

function pointer(doc: unknown, fragment: string): unknown {
  let current = doc
  for (const raw of fragment.slice(1).split("/")) {
    const key = pointerSegment(raw)
    if (Array.isArray(current)) {
      if (!/^\d+$/.test(key)) {
        return undefined
      }
      current = current[Number(key)]
    } else if (isObject(current) && Object.hasOwn(current, key)) {
      current = current[key]
    } else {
      return undefined
    }
    if (current === undefined) {
      return undefined
    }
  }
  return current
}

const unescapePointer = (s: string): string => s.replaceAll("~1", "/").replaceAll("~0", "~")

/** Decode one segment of a URI-fragment JSON pointer, so `a%2Fb` stays one key. */
const pointerSegment = (raw: string): string => unescapePointer(safeDecode(raw))

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

function tryUrl(ref: string, base: string): string | undefined {
  try {
    return new URL(ref, base).href
  } catch {
    return undefined
  }
}

const stripHash = (url: string): string => url.split("#", 1)[0] ?? url

const stringOr = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined)

const joinPath = (parent: string, seg: string): string =>
  seg.startsWith("[") ? `${parent}${seg}` : `${parent}.${seg}`

/** Element-id-safe form of a property name or definition name. */
export function slug(s: string): string {
  return s.replace(/[^\p{L}\p{M}\p{N}_~-]+/gu, "-") || "-"
}
