# `aid` — project instructions

`aid` is a single-binary documentation tool that generates static documentation sites from markdown, HTML, OpenAPI, and Protobuf sources. See @docs/PRODUCT_OVERVIEW.md and @docs/RESEARCH_stack.md for the full overview and stack rationale.

## Stack

- **Runtime:** Bun ≥1.2 (mise-pinned to 1.3.13)
- **Language:** TypeScript, strict mode, ESM only
- **Lint/format:** Biome 2.4.x
- **Styling:** Tailwind 4
- **JSX runtime:** custom (`@aid/jsx`, mapped in `tsconfig.json`)

## Scripts

| Command | Purpose |
|---|---|
| `bun run dev` | Run the CLI in dev-server mode |
| `bun run build` | Bundle the browser-side runtime |
| `bun run compile` | Per-target binary build |
| `bun run emit-schema` | Emit `schemas/aid.schema.json` from Zod |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | `biome check .` |
| `bun run fmt` | `biome format --write .` |
| `bun test` | Bun test runner |

## Where the rules live

Style and convention rules are split across `.claude/rules/`. Files without `paths:` frontmatter load every session; path-scoped files load on demand when matching files are touched.

## Hooks

A PostToolUse hook runs Biome on every edited file (`.claude/hooks/format-on-edit.sh`). Don't pre-emptively format files yourself — the hook will.
