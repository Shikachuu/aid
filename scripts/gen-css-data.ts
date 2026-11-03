#!/usr/bin/env bun
import path from "node:path"
import webref from "@webref/css/css.json" with { type: "json" }

const ROOT = path.resolve(import.meta.dir, "..")
const OUT = "src/lint/css-data.json"
const IDENT_TYPES = new Set(["custom-ident", "dashed-ident", "custom-property-name"])

type Named = { name: string; syntax?: string }

/** Names `aid lint`'s CSS checks treat as known, taken from the W3C specs through webref. */
export type CssData = {
  properties: string[]
  identProperties: string[]
  keywords: string[]
  mediaFeatures: string[]
  atRules: string[]
  fontFaceDescriptors: string[]
  pseudoClasses: string[]
  pseudoElements: string[]
  elements: string[]
}

const sorted = (names: Iterable<string>): string[] => [...new Set(names)].sort()

const references = (syntax: string): string[] =>
  [...syntax.matchAll(/<'?([a-z][a-z0-9-]*)(?:\(\))?'?(?:\s*\[[^\]]*\])?>/g)].map((m) => m[1] ?? "")

const keywordsOf = (syntax: string): string[] =>
  [...syntax.matchAll(/<[^>]*>|'[^']*'|"[^"]*"|[a-zA-Z][a-zA-Z0-9-]*\(?/g)]
    .map((m) => m[0])
    .filter((token) => /^[a-zA-Z][a-zA-Z0-9-]*$/.test(token))
    .map((token) => token.toLowerCase())

const reachesIdent = (start: string, grammar: Map<string, string>): boolean => {
  const seen = new Set<string>()
  const stack = [start]
  while (stack.length > 0) {
    const syntax = stack.pop() ?? ""
    for (const ref of references(syntax)) {
      if (IDENT_TYPES.has(ref)) {
        return true
      }
      const next = grammar.get(ref)
      if (next !== undefined && !seen.has(ref)) {
        seen.add(ref)
        stack.push(next)
      }
    }
  }
  return false
}

const pseudoName = (selector: string): string => selector.replace(/^::?/, "").replace(/\(\)$/, "")

const elementNames = async (): Promise<string[]> => {
  const dir = path.dirname(Bun.resolveSync("@webref/elements/package.json", import.meta.dir))
  const names: string[] = []
  for await (const file of new Bun.Glob("*.json").scan({ cwd: dir })) {
    if (file === "package.json") {
      continue
    }
    const spec = (await Bun.file(path.join(dir, file)).json()) as { elements?: Named[] }
    names.push(...(spec.elements ?? []).map((e) => e.name.toLowerCase()))
  }
  return sorted(names)
}

/** Build the data file from the installed webref packages. */
export const generateCssData = async (): Promise<CssData> => {
  const properties = webref.properties as Named[]
  const types = webref.types as Named[]
  const grammar = new Map<string, string>()
  for (const entry of [...types, ...properties]) {
    if (entry.syntax !== undefined) {
      grammar.set(entry.name, entry.syntax)
    }
  }
  const syntaxes = [...grammar.values()]
  const atRules = webref.atrules as (Named & { descriptors?: Named[] })[]
  const selectors = (webref.selectors as Named[]).map((s) => s.name)
  return {
    properties: sorted(properties.map((p) => p.name)),
    identProperties: sorted(
      properties.filter((p) => p.syntax && reachesIdent(p.syntax, grammar)).map((p) => p.name),
    ),
    keywords: sorted(syntaxes.flatMap(keywordsOf)),
    mediaFeatures: sorted(
      (atRules.find((a) => a.name === "@media")?.descriptors ?? []).map((d) => d.name),
    ),
    atRules: sorted(atRules.map((a) => a.name.slice(1))),
    fontFaceDescriptors: sorted(
      (atRules.find((a) => a.name === "@font-face")?.descriptors ?? []).map((d) => d.name),
    ),
    pseudoClasses: sorted(selectors.filter((s) => /^:[^:]/.test(s)).map(pseudoName)),
    pseudoElements: sorted(selectors.filter((s) => s.startsWith("::")).map(pseudoName)),
    elements: await elementNames(),
  }
}

const render = (data: CssData): string => `${JSON.stringify(data, null, 2)}\n`

if (import.meta.main) {
  const content = render(await generateCssData())
  const target = Bun.file(path.join(ROOT, OUT))
  if (process.argv.includes("--check")) {
    if (!(await target.exists()) || (await target.text()) !== content) {
      console.error(
        `[gen-css-data] ${OUT} is out of date. Run 'bun run gen-css-data' and commit it.`,
      )
      process.exit(1)
    }
    console.log(`[gen-css-data] ${OUT} is in sync.`)
  } else {
    await Bun.write(target, content)
    console.log(`[gen-css-data] wrote ${OUT}.`)
  }
}
