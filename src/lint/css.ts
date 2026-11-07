import type {
  Declaration,
  FontFaceRule,
  KeyframesRule,
  MediaCondition,
  MediaQuery,
  Rule,
  StyleRule,
  TokenOrValue,
  Warning,
} from "lightningcss"
import { type Blanked, blankStringsAndComments, findMatchingBrace } from "../core/internal/css-scan"
import { installLightningcssShim } from "../core/internal/lightningcss-native"
import { validateTailwindStylesheet } from "../core/tailwind"
import data from "./css-data.json" with { type: "json" }
import type { Diagnostic, Severity, ToolResult } from "./diagnostics"

/**
 * Every check the `css` tool runs. Codes reuse the name of the Stylelint rule
 * with the same intent, so users can look the rule up.
 */
export const CSS_RULES = {
  "css-syntax-error": {
    severity: "error",
    description:
      "CSS that lightningcss cannot parse, and comments or blocks that are never closed.",
  },
  "at-rule-no-unknown": {
    severity: "error",
    description: "At-rules that no CSS spec and no Tailwind directive defines.",
  },
  "selector-no-invalid": { severity: "error", description: "Selectors that do not parse." },
  "selector-pseudo-class-no-unknown": {
    severity: "error",
    description: "Pseudo-classes that no CSS spec defines.",
  },
  "selector-pseudo-element-no-unknown": {
    severity: "error",
    description: "Pseudo-elements that no CSS spec defines.",
  },
  "selector-type-no-unknown": {
    severity: "error",
    description: "Type selectors that name no HTML, SVG, or MathML element. Custom elements pass.",
  },
  "no-invalid-position-at-import-rule": {
    severity: "error",
    description: "`@import` after any rule other than `@charset` or `@layer`.",
  },
  "string-no-newline": { severity: "error", description: "Strings that a newline cuts off." },
  "property-no-unknown": {
    severity: "error",
    description: "Properties that no CSS spec defines. Custom and vendor-prefixed properties pass.",
  },
  "declaration-property-value-no-unknown": {
    severity: "error",
    description:
      "Values that do not parse for their property and use a keyword or unit that no CSS spec defines.",
  },
  "custom-property-no-missing-var-function": {
    severity: "error",
    description: "A custom property declared in the file and used as a value without `var()`.",
  },
  "media-feature-name-no-unknown": {
    severity: "error",
    description: "Media features that no CSS spec defines.",
  },
  "at-rule-descriptor-no-unknown": {
    severity: "error",
    description: "`@font-face` descriptors that no CSS spec defines.",
  },
  "declaration-block-no-duplicate-properties": {
    severity: "warn",
    description:
      "A property declared twice in one block. Two consecutive declarations with different kinds of value pass as a browser fallback, for example `#fff` then `oklch(...)`.",
  },
  "declaration-block-no-duplicate-custom-properties": {
    severity: "warn",
    description: "A custom property declared twice in one block.",
  },
  "declaration-block-no-shorthand-property-overrides": {
    severity: "warn",
    description: "A shorthand that resets a longhand declared before it in the same block.",
  },
  "font-family-no-duplicate-names": {
    severity: "warn",
    description: "A font family listed twice in one `font-family` or `font` value.",
  },
  "font-family-no-missing-generic-family-keyword": {
    severity: "warn",
    description: "A font family list without a generic family such as `sans-serif`.",
  },
  "keyframe-block-no-duplicate-selectors": {
    severity: "warn",
    description: "A keyframe selector used twice in one `@keyframes`.",
  },
  "keyframe-declaration-no-important": {
    severity: "warn",
    description: "`!important` inside `@keyframes`, which browsers ignore.",
  },
  "no-duplicate-at-import-rules": { severity: "warn", description: "The same `@import` twice." },
  "no-duplicate-selectors": {
    severity: "warn",
    description: "The same selector list twice in one scope.",
  },
  "block-no-empty": { severity: "warn", description: "Style rules with an empty block." },
  "comment-no-empty": { severity: "warn", description: "Empty comments." },
  "no-empty-source": { severity: "warn", description: "Files that hold only whitespace." },
  "no-irregular-whitespace": {
    severity: "warn",
    description: "Whitespace characters other than space, tab, and newline.",
  },
  tailwind: {
    severity: "error",
    description:
      "The first error Tailwind reports when it compiles a stylesheet that imports `tailwindcss` or `aid/theme`: an unknown utility in `@apply`, an unknown variant, an unresolved `--theme()` value, or an invalid `@utility` name.",
  },
} as const satisfies Record<string, { severity: Severity; description: string }>

type Code = keyof typeof CSS_RULES

const TAILWIND_AT_RULES = new Set([
  "apply",
  "config",
  "custom-variant",
  "plugin",
  "reference",
  "source",
  "tailwind",
  "theme",
  "utility",
  "variant",
])

const CSS_WIDE = new Set(["inherit", "initial", "unset", "revert", "revert-layer"])

const GENERIC_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "math",
  "emoji",
  "fangsong",
])

const UNITS = new Set(
  (
    "px cm mm q in pt pc em rem ex rex cap rcap ch rch ic ric lh rlh vw vh vi vb vmin vmax " +
    "svw svh svi svb svmin svmax lvw lvh lvi lvb lvmin lvmax dvw dvh dvi dvb dvmin dvmax " +
    "cqw cqh cqi cqb cqmin cqmax deg grad rad turn s ms hz khz dpi dpcm dppx x fr"
  ).split(" "),
)

const sides = (prefix: string, suffix = ""): string[] =>
  ["top", "right", "bottom", "left"].map((side) => `${prefix}-${side}${suffix}`)

const SHORTHANDS: Record<string, readonly string[]> = {
  margin: sides("margin"),
  padding: sides("padding"),
  inset: ["top", "right", "bottom", "left"],
  "margin-block": ["margin-block-start", "margin-block-end"],
  "margin-inline": ["margin-inline-start", "margin-inline-end"],
  "padding-block": ["padding-block-start", "padding-block-end"],
  "padding-inline": ["padding-inline-start", "padding-inline-end"],
  "inset-block": ["inset-block-start", "inset-block-end"],
  "inset-inline": ["inset-inline-start", "inset-inline-end"],
  border: [
    ...sides("border"),
    "border-width",
    "border-style",
    "border-color",
    ...sides("border", "-width"),
    ...sides("border", "-style"),
    ...sides("border", "-color"),
  ],
  "border-width": sides("border", "-width"),
  "border-style": sides("border", "-style"),
  "border-color": sides("border", "-color"),
  "border-top": ["border-top-width", "border-top-style", "border-top-color"],
  "border-right": ["border-right-width", "border-right-style", "border-right-color"],
  "border-bottom": ["border-bottom-width", "border-bottom-style", "border-bottom-color"],
  "border-left": ["border-left-width", "border-left-style", "border-left-color"],
  "border-radius": [
    "border-top-left-radius",
    "border-top-right-radius",
    "border-bottom-right-radius",
    "border-bottom-left-radius",
  ],
  background: [
    "background-color",
    "background-image",
    "background-repeat",
    "background-attachment",
    "background-position",
    "background-position-x",
    "background-position-y",
    "background-size",
    "background-origin",
    "background-clip",
  ],
  font: [
    "font-style",
    "font-variant",
    "font-weight",
    "font-stretch",
    "font-size",
    "line-height",
    "font-family",
  ],
  flex: ["flex-grow", "flex-shrink", "flex-basis"],
  "flex-flow": ["flex-direction", "flex-wrap"],
  "grid-template": ["grid-template-columns", "grid-template-rows", "grid-template-areas"],
  grid: [
    "grid-template-columns",
    "grid-template-rows",
    "grid-template-areas",
    "grid-auto-columns",
    "grid-auto-rows",
    "grid-auto-flow",
  ],
  "grid-area": ["grid-row-start", "grid-column-start", "grid-row-end", "grid-column-end"],
  "grid-row": ["grid-row-start", "grid-row-end"],
  "grid-column": ["grid-column-start", "grid-column-end"],
  gap: ["row-gap", "column-gap"],
  "place-items": ["align-items", "justify-items"],
  "place-content": ["align-content", "justify-content"],
  "place-self": ["align-self", "justify-self"],
  overflow: ["overflow-x", "overflow-y"],
  outline: ["outline-color", "outline-style", "outline-width"],
  "list-style": ["list-style-type", "list-style-position", "list-style-image"],
  transition: [
    "transition-property",
    "transition-duration",
    "transition-timing-function",
    "transition-delay",
  ],
  animation: [
    "animation-name",
    "animation-duration",
    "animation-timing-function",
    "animation-delay",
    "animation-iteration-count",
    "animation-direction",
    "animation-fill-mode",
    "animation-play-state",
  ],
  "text-decoration": [
    "text-decoration-line",
    "text-decoration-style",
    "text-decoration-color",
    "text-decoration-thickness",
  ],
  columns: ["column-width", "column-count"],
  "column-rule": ["column-rule-width", "column-rule-style", "column-rule-color"],
  "scroll-margin": sides("scroll-margin"),
  "scroll-padding": sides("scroll-padding"),
  container: ["container-name", "container-type"],
}

const PROPERTIES = new Set(data.properties)
const IDENT_PROPERTIES = new Set(data.identProperties)
const KEYWORDS = new Set(data.keywords)
const MEDIA_FEATURES = new Set(data.mediaFeatures)
const AT_RULES = new Set(data.atRules)
const FONT_FACE_DESCRIPTORS = new Set(data.fontFaceDescriptors)
const PSEUDO_CLASSES = new Set(data.pseudoClasses)
const PSEUDO_ELEMENTS = new Set(data.pseudoElements)
const ELEMENTS = new Set(data.elements)

const VENDOR_PREFIX = /^-[a-z]+-/
const TAILWIND_ENTRY = /@import\s+(?:url\(\s*)?["'](?:tailwindcss|aid\/theme)["']/
const IRREGULAR_CODE_POINTS = [
  0x0b, 0x0c, 0x85, 0xa0, 0x1680, 0x180e, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006,
  0x2007, 0x2008, 0x2009, 0x200a, 0x200b, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
]
const IRREGULAR_WHITESPACE = new RegExp(
  `[${IRREGULAR_CODE_POINTS.map((c) => `\\u{${c.toString(16)}}`).join("")}]`,
  "gu",
)

type Position = { line: number; col: number }
type Location = { line: number; column: number }

type FileContext = {
  file: string
  text: string
  code: string
  lineStarts: number[]
  declaredCustomProperties: Set<string>
  out: Diagnostic[]
}

const report = (ctx: FileContext, code: Code, message: string, pos?: Position): void => {
  ctx.out.push({
    file: ctx.file,
    line: pos?.line,
    col: pos?.col,
    severity: CSS_RULES[code].severity,
    code,
    message,
  })
}

const positionAt = (ctx: FileContext, offset: number): Position => {
  let lo = 0
  let hi = ctx.lineStarts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if ((ctx.lineStarts[mid] ?? 0) <= offset) {
      lo = mid
    } else {
      hi = mid - 1
    }
  }
  return { line: lo + 1, col: offset - (ctx.lineStarts[lo] ?? 0) + 1 }
}

// lightningcss rule locations have a 0-based line and a 1-based column.
const ruleOffset = (ctx: FileContext, loc: Location): number =>
  (ctx.lineStarts[loc.line] ?? 0) + loc.column - 1

const rulePosition = (loc: Location): Position => ({ line: loc.line + 1, col: loc.column })

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// lightningcss keeps no position for declarations, so search the source from the rule start.
const findAfter = (
  ctx: FileContext,
  from: number,
  pattern: RegExp,
  occurrence = 1,
): Position | undefined => {
  const re = new RegExp(pattern.source, "gi")
  re.lastIndex = from
  let match: RegExpExecArray | null = null
  for (let i = 0; i < occurrence; i++) {
    match = re.exec(ctx.code)
    if (match === null) {
      return undefined
    }
  }
  return match === null ? undefined : positionAt(ctx, match.index)
}

const declarationPattern = (name: string): RegExp =>
  new RegExp(`(?<![\\w-])${escapeRegExp(name)}\\s*:`)

const declarationName = (d: Declaration): string => {
  if (d.property === "custom") {
    return d.value.name
  }
  if (d.property === "unparsed") {
    const id = d.value.propertyId
    const prefix = "vendorPrefix" in id && id.vendorPrefix?.[0] ? `-${id.vendorPrefix[0]}-` : ""
    return prefix + id.property
  }
  const prefix = "vendorPrefix" in d && d.vendorPrefix?.[0] ? `-${d.vendorPrefix[0]}-` : ""
  return prefix + d.property
}

const hasDynamicValue = (tokens: TokenOrValue[]): boolean =>
  /"type":"(var|env|function)"/.test(JSON.stringify(tokens))

const isKnownValue = (tokens: TokenOrValue[], acceptsIdents: boolean): boolean =>
  tokens.every((t) => {
    if (t.type === "dashed-ident") {
      return false
    }
    if (t.type !== "token") {
      return true
    }
    const token = t.value
    switch (token.type) {
      case "ident": {
        const word = token.value.toLowerCase()
        return acceptsIdents || VENDOR_PREFIX.test(word) || KEYWORDS.has(word) || CSS_WIDE.has(word)
      }
      case "dimension":
        return UNITS.has(token.unit.toLowerCase())
      case "number":
      case "percentage":
      case "white-space":
      case "comma":
      case "delim":
        return true
      default:
        return false
    }
  })

const checkFontFamilies = (
  ctx: FileContext,
  families: string[],
  pos: Position | undefined,
): void => {
  if (families.length === 0 || families.some((f) => CSS_WIDE.has(f.toLowerCase()))) {
    return
  }
  const seen = new Set<string>()
  for (const family of families) {
    const key = family.toLowerCase()
    if (seen.has(key)) {
      report(ctx, "font-family-no-duplicate-names", `Font family "${family}" is listed twice`, pos)
    }
    seen.add(key)
  }
  if (!families.some((f) => GENERIC_FAMILIES.has(f.toLowerCase()))) {
    report(
      ctx,
      "font-family-no-missing-generic-family-keyword",
      `Add a generic family such as "sans-serif" after "${families.at(-1)}"`,
      pos,
    )
  }
}

const valueShapeWithoutLiterals = (node: unknown): unknown => {
  if (Array.isArray(node)) {
    return node.map(valueShapeWithoutLiterals)
  }
  if (typeof node === "object" && node !== null) {
    return Object.fromEntries(
      Object.entries(node).map(([k, v]) => [k, k === "type" ? v : valueShapeWithoutLiterals(v)]),
    )
  }
  return 0
}

const fallbackShape = (d: Declaration): string =>
  JSON.stringify(valueShapeWithoutLiterals("value" in d ? d.value : null))

const checkDeclarations = (
  ctx: FileContext,
  declarations: Declaration[],
  start: number,
  fallback: Position,
): void => {
  const occurrences = new Map<string, number>()
  const seen = new Map<string, { index: number; shape: string }>()
  const longhandsSoFar = new Set<string>()
  declarations.forEach((d, index) => {
    const name = declarationName(d)
    const key = name.toLowerCase()
    const occurrence = (occurrences.get(key) ?? 0) + 1
    occurrences.set(key, occurrence)
    const pos = findAfter(ctx, start, declarationPattern(name), occurrence) ?? fallback
    const shape = fallbackShape(d)

    const previous = seen.get(key)
    if (previous !== undefined) {
      if (key.startsWith("--")) {
        report(
          ctx,
          "declaration-block-no-duplicate-custom-properties",
          `Custom property "${name}" is declared twice`,
          pos,
        )
      } else if (previous.index !== index - 1 || previous.shape === shape) {
        report(
          ctx,
          "declaration-block-no-duplicate-properties",
          `Property "${name}" is declared twice`,
          pos,
        )
      }
    }
    seen.set(key, { index, shape })

    const overridden = (SHORTHANDS[key] ?? []).find((longhand) => longhandsSoFar.has(longhand))
    if (overridden !== undefined) {
      report(
        ctx,
        "declaration-block-no-shorthand-property-overrides",
        `Shorthand "${name}" resets "${overridden}" declared before it`,
        pos,
      )
    }
    longhandsSoFar.add(key)

    if (d.property === "font-family") {
      checkFontFamilies(ctx, d.value, pos)
    } else if (d.property === "font") {
      checkFontFamilies(ctx, d.value.family, pos)
    }

    if (d.property !== "custom" && d.property !== "unparsed") {
      return
    }
    if (key.startsWith("--")) {
      return
    }
    if (d.property === "custom" && !VENDOR_PREFIX.test(key) && !PROPERTIES.has(key)) {
      report(ctx, "property-no-unknown", `Unknown property "${name}"`, pos)
      return
    }
    const tokens = d.value.value
    const missingVar = IDENT_PROPERTIES.has(key)
      ? undefined
      : tokens.find(
          (t): t is { type: "dashed-ident"; value: string } =>
            t.type === "dashed-ident" && ctx.declaredCustomProperties.has(t.value),
        )
    if (missingVar !== undefined) {
      report(
        ctx,
        "custom-property-no-missing-var-function",
        `Use var(${missingVar.value}) to read the custom property`,
        pos,
      )
      return
    }
    if (
      d.property === "unparsed" &&
      !hasDynamicValue(tokens) &&
      !isKnownValue(tokens, IDENT_PROPERTIES.has(key))
    ) {
      report(ctx, "declaration-property-value-no-unknown", `Invalid value for "${name}"`, pos)
    }
  })
}

const collectTypeSelectors = (node: unknown, out: string[]): void => {
  if (Array.isArray(node)) {
    for (const child of node) {
      collectTypeSelectors(child, out)
    }
  } else if (typeof node === "object" && node !== null) {
    const record = node as Record<string, unknown>
    if (record.type === "type" && typeof record.name === "string") {
      out.push(record.name)
    }
    for (const value of Object.values(record)) {
      collectTypeSelectors(value, out)
    }
  }
}

const selectorText = (ctx: FileContext, start: number): string => {
  const end = ctx.code.indexOf("{", start)
  return ctx.text
    .slice(start, end === -1 ? undefined : end)
    .trim()
    .replace(/\s+/g, " ")
}

const checkStyleRule = (
  ctx: FileContext,
  rule: StyleRule,
  selectorsInScope: Map<string, number>,
): void => {
  const start = ruleOffset(ctx, rule.loc)
  const pos = rulePosition(rule.loc)
  const selector = selectorText(ctx, start)

  const key = rule.selectors
    .map((s) => JSON.stringify(s))
    .sort()
    .join(",")
  const firstLine = selectorsInScope.get(key)
  if (firstLine !== undefined) {
    report(
      ctx,
      "no-duplicate-selectors",
      `Selector "${selector}" is already used at line ${firstLine}`,
      pos,
    )
  } else {
    selectorsInScope.set(key, pos.line)
  }

  const types: string[] = []
  collectTypeSelectors(rule.selectors, types)
  for (const type of new Set(types)) {
    if (!type.includes("-") && !ELEMENTS.has(type.toLowerCase())) {
      report(ctx, "selector-type-no-unknown", `Unknown type selector "${type}"`, pos)
    }
  }

  const open = ctx.code.indexOf("{", start)
  const close = open === -1 ? -1 : findMatchingBrace(ctx.code, open)
  if (close !== -1 && ctx.code.slice(open + 1, close).trim() === "") {
    report(ctx, "block-no-empty", `Selector "${selector}" has an empty block`, pos)
  }

  checkDeclarations(
    ctx,
    [
      ...(rule.declarations?.declarations ?? []),
      ...(rule.declarations?.importantDeclarations ?? []),
    ],
    start,
    pos,
  )
  walkRules(ctx, rule.rules ?? [])
}

const featureNames = (condition: MediaCondition | null | undefined, out: string[]): void => {
  if (!condition) {
    return
  }
  if (condition.type === "feature") {
    out.push(String(condition.value.name))
  } else if (condition.type === "not") {
    featureNames(condition.value, out)
  } else if (condition.type === "operation") {
    for (const child of condition.conditions) {
      featureNames(child, out)
    }
  }
}

const checkMediaQueries = (ctx: FileContext, queries: MediaQuery[], loc: Location): void => {
  const names: string[] = []
  for (const query of queries) {
    featureNames(query.condition, names)
  }
  for (const name of new Set(names)) {
    const base = name.replace(/^(min|max)-/, "")
    if (
      name.startsWith("--") ||
      VENDOR_PREFIX.test(name) ||
      MEDIA_FEATURES.has(name) ||
      MEDIA_FEATURES.has(base)
    ) {
      continue
    }
    const pos =
      findAfter(ctx, ruleOffset(ctx, loc), new RegExp(escapeRegExp(name))) ?? rulePosition(loc)
    report(ctx, "media-feature-name-no-unknown", `Unknown media feature "${name}"`, pos)
  }
}

const checkKeyframes = (ctx: FileContext, rule: KeyframesRule): void => {
  const pos = rulePosition(rule.loc)
  const seen = new Set<string>()
  for (const keyframe of rule.keyframes) {
    for (const selector of keyframe.selectors) {
      const key = JSON.stringify(selector)
      if (seen.has(key)) {
        const label = selector.type === "percentage" ? `${selector.value * 100}%` : selector.type
        report(
          ctx,
          "keyframe-block-no-duplicate-selectors",
          `Keyframe "${label}" is used twice`,
          pos,
        )
      }
      seen.add(key)
    }
    if ((keyframe.declarations.importantDeclarations ?? []).length > 0) {
      const at = findAfter(ctx, ruleOffset(ctx, rule.loc), /!\s*important/) ?? pos
      report(
        ctx,
        "keyframe-declaration-no-important",
        "Browsers ignore !important in @keyframes",
        at,
      )
    }
  }
}

const checkFontFace = (ctx: FileContext, rule: FontFaceRule): void => {
  for (const property of rule.properties) {
    if (property.type !== "custom") {
      continue
    }
    const name = property.value.name
    if (!VENDOR_PREFIX.test(name) && !FONT_FACE_DESCRIPTORS.has(name.toLowerCase())) {
      const pos =
        findAfter(ctx, ruleOffset(ctx, rule.loc), declarationPattern(name)) ??
        rulePosition(rule.loc)
      report(ctx, "at-rule-descriptor-no-unknown", `Unknown @font-face descriptor "${name}"`, pos)
    }
  }
}

function walkRules(ctx: FileContext, rules: Rule[]): void {
  const selectorsInScope = new Map<string, number>()
  const imports = new Set<string>()
  for (const rule of rules) {
    switch (rule.type) {
      case "style":
        checkStyleRule(ctx, rule.value, selectorsInScope)
        break
      case "nesting":
        checkStyleRule(ctx, rule.value.style, selectorsInScope)
        break
      case "nested-declarations": {
        const { declarations, loc } = rule.value
        checkDeclarations(
          ctx,
          [...(declarations.declarations ?? []), ...(declarations.importantDeclarations ?? [])],
          ctx.lineStarts[loc.line] ?? 0,
          rulePosition(loc),
        )
        break
      }
      case "media":
        checkMediaQueries(ctx, rule.value.query.mediaQueries, rule.value.loc)
        walkRules(ctx, rule.value.rules)
        break
      case "supports":
      case "layer-block":
      case "container":
      case "scope":
      case "starting-style":
        walkRules(ctx, rule.value.rules)
        break
      case "keyframes":
        checkKeyframes(ctx, rule.value)
        break
      case "font-face":
        checkFontFace(ctx, rule.value)
        break
      case "import": {
        const { url, layer, supports, media, loc } = rule.value
        const key = JSON.stringify([url, layer, supports, media])
        if (imports.has(key)) {
          report(
            ctx,
            "no-duplicate-at-import-rules",
            `"${url}" is imported twice`,
            rulePosition(loc),
          )
        }
        imports.add(key)
        break
      }
    }
  }
}

const reportWarning = (ctx: FileContext, warning: Warning): void => {
  const pos = { line: warning.loc.line, col: warning.loc.column }
  const message = warning.message
  const atRule = /^Unknown at rule: @([\w-]+)/.exec(message)
  if (atRule) {
    const name = (atRule[1] ?? "").toLowerCase()
    if (!AT_RULES.has(name) && !TAILWIND_AT_RULES.has(name)) {
      report(ctx, "at-rule-no-unknown", `Unknown at-rule "@${name}"`, pos)
    }
    return
  }
  const pseudo = /^'([^']+)' is not recognized as a valid pseudo-(class|element)/.exec(message)
  if (pseudo) {
    const name = (pseudo[1] ?? "").toLowerCase()
    if (pseudo[2] === "class" && !PSEUDO_CLASSES.has(name)) {
      report(ctx, "selector-pseudo-class-no-unknown", `Unknown pseudo-class ":${name}"`, pos)
    } else if (pseudo[2] === "element" && !PSEUDO_ELEMENTS.has(name)) {
      report(ctx, "selector-pseudo-element-no-unknown", `Unknown pseudo-element "::${name}"`, pos)
    }
    return
  }
  if (warning.type === "UnexpectedImportRule") {
    report(ctx, "no-invalid-position-at-import-rule", message, pos)
  } else if (message.includes("BadString")) {
    report(ctx, "string-no-newline", "A newline ends this string before its closing quote", pos)
  } else if (warning.type === "SelectorError") {
    report(ctx, "selector-no-invalid", message, pos)
  } else if (!TAILWIND_ENTRY.test(lineAt(ctx, warning.loc.line))) {
    report(ctx, "css-syntax-error", message, pos)
  }
}

const lineAt = (ctx: FileContext, line: number): string =>
  ctx.text.slice(ctx.lineStarts[line - 1] ?? 0, ctx.lineStarts[line] ?? ctx.text.length)

const TAILWIND_NEEDLES = [
  /unknown utility class `([^`]+)`/,
  /unknown variant: (\S+)/,
  /theme function: `theme\(([^)]+)\)`/,
  /`(@utility [^`]+)`/,
  /`([^`]+)`/,
]

const tailwindErrorOffset = (ctx: FileContext, needle: string): number => {
  const inApply = new RegExp(`@apply[^;{}]*?(?<![\\w-])${escapeRegExp(needle)}(?![\\w-])`).exec(
    ctx.code,
  )
  if (inApply !== null) {
    return inApply.index + inApply[0].length - needle.length
  }
  return ctx.code.indexOf(needle)
}

const checkTailwind = async (ctx: FileContext): Promise<void> => {
  try {
    await validateTailwindStylesheet(ctx.text, ctx.file)
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).split("\n")[0] ?? ""
    const needle = TAILWIND_NEEDLES.map((re) => re.exec(message)?.[1]).find((n) => n !== undefined)
    const offset = needle === undefined ? -1 : tailwindErrorOffset(ctx, needle)
    report(ctx, "tailwind", message, offset === -1 ? undefined : positionAt(ctx, offset))
  }
}

const checkText = (ctx: FileContext, blanked: Blanked): void => {
  for (const offset of blanked.emptyComments) {
    report(ctx, "comment-no-empty", "Empty comment", positionAt(ctx, offset))
  }
  if (blanked.unterminatedComment !== undefined) {
    report(
      ctx,
      "css-syntax-error",
      "This comment is never closed with */",
      positionAt(ctx, blanked.unterminatedComment),
    )
  }
  const open: number[] = []
  for (const match of ctx.code.matchAll(/[{}]/g)) {
    if (match[0] === "{") {
      open.push(match.index)
    } else {
      open.pop()
    }
  }
  const unclosed = open.at(-1)
  if (unclosed !== undefined) {
    report(ctx, "css-syntax-error", "This block is never closed with }", positionAt(ctx, unclosed))
  }
  for (const match of ctx.code.matchAll(IRREGULAR_WHITESPACE)) {
    const codePoint = match[0].codePointAt(0) ?? 0
    if (match.index === 0 && codePoint === 0xfeff) {
      continue
    }
    report(
      ctx,
      "no-irregular-whitespace",
      `Irregular whitespace U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`,
      positionAt(ctx, match.index),
    )
  }
}

type Transform = typeof import("lightningcss").transform

const lintFile = async (file: string, transform: Transform): Promise<Diagnostic[]> => {
  const text = await Bun.file(file).text()
  const lineStarts = [0]
  for (const match of text.matchAll(/\n/g)) {
    lineStarts.push(match.index + 1)
  }
  const blanked = blankStringsAndComments(text)
  const declaredCustomProperties = new Set(
    [...blanked.code.matchAll(/(--[\w-]+)\s*:|@property\s+(--[\w-]+)/g)].map(
      (m) => m[1] ?? m[2] ?? "",
    ),
  )
  const ctx: FileContext = {
    file,
    text,
    code: blanked.code,
    lineStarts,
    declaredCustomProperties,
    out: [],
  }

  if (text.trim() === "") {
    report(ctx, "no-empty-source", "The file is empty")
    return ctx.out
  }
  checkText(ctx, blanked)
  try {
    const result = transform({
      filename: file,
      code: new TextEncoder().encode(text),
      errorRecovery: true,
      visitor: {
        StyleSheet(sheet) {
          walkRules(ctx, sheet.rules)
        },
      },
    })
    for (const warning of result.warnings) {
      reportWarning(ctx, warning)
    }
  } catch (error) {
    const loc = (error as { loc?: Location }).loc
    report(
      ctx,
      "css-syntax-error",
      error instanceof Error ? error.message : String(error),
      loc === undefined ? undefined : { line: loc.line, col: loc.column },
    )
  }
  if (TAILWIND_ENTRY.test(text)) {
    await checkTailwind(ctx)
  }
  return ctx.out.sort((a, b) => (a.line ?? 0) - (b.line ?? 0) || (a.col ?? 0) - (b.col ?? 0))
}

/** Lint CSS files with lightningcss's parser and Tailwind's compiler. It has no autofixes. */
export const lintCss = async (paths: string[]): Promise<ToolResult> => {
  if (paths.length === 0) {
    return { tool: "css", ok: true, diagnostics: [] }
  }
  await installLightningcssShim()
  const { transform } = await import("lightningcss")
  const diagnostics: Diagnostic[] = []
  for (const file of paths) {
    diagnostics.push(...(await lintFile(file, transform)))
  }
  return { tool: "css", ok: !diagnostics.some((d) => d.severity === "error"), diagnostics }
}
