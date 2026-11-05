#!/usr/bin/env bun
import path from "node:path"

/** One mapping from source globs to the site pages that document them. */
export type DocsMapEntry = { sources: readonly string[]; pages: readonly string[] }

const DOCS = "site/docs"

/**
 * Which pages document which source files. The docs-sync skill reads it to
 * list the pages a change may have made stale. Generated pages under
 * `reference/` are not listed: `gen-docs --check` covers them.
 */
export const DOCS_MAP: readonly DocsMapEntry[] = [
  {
    sources: ["src/cli/index.ts", "src/cli/main.ts", "src/cli/commands/help.ts"],
    pages: [`${DOCS}/commands/index.md`],
  },
  {
    sources: ["src/cli/commands/build.ts", "src/core/pipeline.ts", "src/core/assets.ts"],
    pages: [`${DOCS}/commands/build.md`, `${DOCS}/contributing/build-pipeline.md`],
  },
  {
    sources: ["src/cli/commands/init.ts", "assets/scaffold/**"],
    pages: [`${DOCS}/commands/init.md`, `${DOCS}/getting-started/index.md`, `${DOCS}/status.html`],
  },
  {
    sources: ["src/core/config.ts", "scripts/emit-schema.ts"],
    pages: [
      `${DOCS}/configuration/index.md`,
      `${DOCS}/configuration/paths-and-urls.md`,
      `${DOCS}/deployment/github-pages.md`,
      `${DOCS}/status.html`,
    ],
  },
  {
    sources: [
      "src/core/router.ts",
      "src/renderers/openapi/sniff.ts",
      "src/renderers/jsonschema/sniff.ts",
    ],
    pages: [`${DOCS}/content-types/index.md`, `${DOCS}/configuration/paths-and-urls.md`],
  },
  {
    sources: ["src/renderers/markdown/**", "src/renderers/shared.ts", "src/web/mermaid.ts"],
    pages: [`${DOCS}/content-types/markdown.md`],
  },
  { sources: ["src/renderers/html.ts"], pages: [`${DOCS}/content-types/html.md`] },
  {
    sources: ["src/renderers/openapi/**", "src/web/openapi-entry.ts"],
    pages: [`${DOCS}/content-types/openapi.md`],
  },
  {
    sources: ["src/renderers/proto/**", "src/web/proto-entry.ts", "packages/proto-ui/src/**"],
    pages: [`${DOCS}/content-types/proto.md`, `${DOCS}/content-types/proto-example.proto`],
  },
  {
    sources: ["src/renderers/jsonschema/**", "src/theme/components/PageJsonSchema.tsx"],
    pages: [`${DOCS}/content-types/jsonschema.md`, `${DOCS}/reference/aid-schema.json`],
  },
  {
    sources: [
      "src/renderers/markdown/colocated-assets*.ts",
      "src/core/static.ts",
      "src/core/assets.ts",
    ],
    pages: [`${DOCS}/content-types/images-and-static.md`],
  },
  {
    sources: ["src/core/nav.ts", "src/theme/components/Nav.tsx"],
    pages: [`${DOCS}/content-types/navigation.md`],
  },
  {
    sources: ["src/core/links.ts", "src/renderers/links.ts"],
    pages: [`${DOCS}/content-types/links.md`],
  },
  {
    sources: ["src/core/search-index.ts", "src/core/search-options.ts", "src/web/search.ts"],
    pages: [`${DOCS}/search/index.md`],
  },
  {
    sources: ["src/core/llms-txt.ts", "src/web/ai-button.ts"],
    pages: [`${DOCS}/llms-txt/index.md`, `${DOCS}/status.html`],
  },
  {
    sources: ["src/lint/**", "src/cli/commands/lint.ts"],
    pages: [`${DOCS}/linting/index.md`, `${DOCS}/linting/configuring.md`],
  },
  {
    sources: ["src/fmt/**", "src/cli/commands/fmt.ts"],
    pages: [`${DOCS}/formatting/index.md`],
  },
  {
    sources: ["src/dev/**", "src/cli/commands/dev.ts"],
    pages: [`${DOCS}/dev-server/index.md`],
  },
  {
    sources: ["src/theme/**", "src/core/tailwind.ts"],
    pages: [`${DOCS}/theming/index.md`],
  },
  {
    sources: ["src/core/dark-mode.ts", "src/web/dark-mode.ts"],
    pages: [`${DOCS}/theming/dark-mode.md`, `${DOCS}/status.html`],
  },
  {
    sources: ["src/jsx-runtime.ts", "src/core/types.ts", "src/core/web-entries.ts"],
    pages: [`${DOCS}/contributing/architecture.md`],
  },
  {
    sources: [
      "scripts/compile.ts",
      "scripts/bundle-web.ts",
      "scripts/stage-natives.ts",
      "scripts/natives.ts",
      "src/core/internal/**",
      "src/web/_bundled.ts",
    ],
    pages: [`${DOCS}/contributing/single-binary.md`, `${DOCS}/getting-started/installation.md`],
  },
  {
    sources: [
      "mise.toml",
      "mise.lock",
      "package.json",
      "scripts/check-binaries.ts",
      "scripts/gen-css-data.ts",
    ],
    pages: [`${DOCS}/contributing/dev-setup.md`, `${DOCS}/getting-started/installation.md`],
  },
  {
    sources: ["tests/helpers.ts", "tests/fixtures/**", "scripts/manual-test.ts"],
    pages: [`${DOCS}/contributing/testing.md`],
  },
  {
    sources: [
      ".claude/rules/**",
      ".claude/hooks/**",
      "bunfig.toml",
      ".prettierignore",
      ".prettierrc.json",
      "scripts/gen-bunfig.ts",
    ],
    pages: [`${DOCS}/contributing/conventions.md`],
  },
  {
    sources: [
      "scripts/gen-docs.ts",
      "scripts/docs-affected.ts",
      ".claude/skills/docs-sync/**",
      "site/aid.yaml",
      "site/main.css",
      "site/templates/**",
    ],
    pages: [`${DOCS}/contributing/docs-site.md`],
  },
  {
    sources: ["src/**", "scripts/**", "packages/proto-ui/src/**"],
    pages: [`${DOCS}/contributing/index.md`],
  },
]

/** Pages that are hubs and change only when the tree itself changes, not with any one source. */
export const HUB_PAGES: readonly string[] = [`${DOCS}/index.md`, `${DOCS}/deployment/index.md`]

const WATCHED_PREFIXES = ["src/", "scripts/", "packages/proto-ui/src/"]

/** Result of {@link affectedPages}. */
export type Affected = {
  pages: { page: string; touched: boolean }[]
  unmapped: string[]
}

/**
 * Pages mapped from `changed`, each flagged by whether the change already
 * touches it, plus changed source files no entry maps. The catch-all
 * `contributing/index.md` entry does not count as a mapping.
 */
export function affectedPages(changed: readonly string[]): Affected {
  const changedSet = new Set(changed)
  const pages = new Set<string>()
  const mapped = new Set<string>()
  for (const entry of DOCS_MAP) {
    const globs = entry.sources.map((s) => new Bun.Glob(s))
    const hits = changed.filter((file) => globs.some((g) => g.match(file)))
    if (hits.length === 0) {
      continue
    }
    for (const page of entry.pages) {
      pages.add(page)
    }
    if (!entry.pages.includes(`${DOCS}/contributing/index.md`)) {
      for (const hit of hits) {
        mapped.add(hit)
      }
    }
  }
  return {
    pages: [...pages].sort().map((page) => ({ page, touched: changedSet.has(page) })),
    unmapped: changed.filter(
      (file) => WATCHED_PREFIXES.some((p) => file.startsWith(p)) && !mapped.has(file),
    ),
  }
}

const REPO_ROOT = path.join(import.meta.dir, "..")

async function changedFiles(base: string): Promise<string[]> {
  const run = async (...args: string[]) => {
    const result = await Bun.$`git ${args}`.cwd(REPO_ROOT).quiet().nothrow()
    if (result.exitCode !== 0) {
      console.error(`git ${args.join(" ")} failed: ${result.stderr.toString().trim()}`)
      console.error("Pass an existing ref with --base <ref>.")
      process.exit(1)
    }
    return result.text().split("\n").filter(Boolean)
  }
  const files = [
    ...(await run("diff", "--name-only", "--no-renames", `${base}...HEAD`)),
    ...(await run("diff", "--name-only", "--no-renames", "HEAD")),
    ...(await run("ls-files", "--others", "--exclude-standard", "--full-name")),
  ]
  return [...new Set(files)].sort()
}

function baseRef(argv: string[]): string {
  const at = argv.indexOf("--base")
  if (at === -1) {
    return "origin/main"
  }
  const value = argv[at + 1]
  if (value === undefined || value.startsWith("-")) {
    console.error("--base needs a ref, for example --base origin/main.")
    process.exit(1)
  }
  return value
}

if (import.meta.main) {
  const { pages, unmapped } = affectedPages(await changedFiles(baseRef(process.argv.slice(2))))
  for (const { page, touched } of pages) {
    console.log(`${touched ? "changed " : "review  "} ${path.normalize(page)}`)
  }
  for (const file of unmapped) {
    console.log(`unmapped ${file}`)
  }
  if (pages.length === 0 && unmapped.length === 0) {
    console.log("No documented sources changed.")
  }
}
