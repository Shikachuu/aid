import { expect } from "bun:test"
import path from "node:path"
import MiniSearch from "minisearch"
import { AidConfigSchema, buildContext } from "../src/core/config"
import { SEARCH_OPTIONS } from "../src/core/search-options"
import type { BuildContext } from "../src/core/types"

export function makeCtx(cwd: string, raw: Record<string, unknown> = {}): BuildContext {
  return buildContext(AidConfigSchema.parse({ name: "Test Site", ...raw }), cwd)
}

export async function makeSite(
  cwd: string,
  raw: Record<string, unknown> = {},
): Promise<BuildContext> {
  await Bun.write(path.join(cwd, "main.css"), `@import "tailwindcss";\n@import "aid/theme";\n`)
  return makeCtx(cwd, raw)
}

const SEARCH_SCRIPT_PREFIX = "window.__AID_SEARCH__="

export function parseSearchIndexScript(source: string) {
  expect(source.startsWith(SEARCH_SCRIPT_PREFIX)).toBe(true)
  expect(source.endsWith(";")).toBe(true)
  const json = source.slice(SEARCH_SCRIPT_PREFIX.length, -1)
  const { storedFields } = JSON.parse(json) as {
    storedFields: Record<string, { type: string; title: string; url: string }>
  }
  return {
    docs: Object.values(storedFields),
    search: (query: string) => MiniSearch.loadJSON(json, SEARCH_OPTIONS).search(query),
  }
}
