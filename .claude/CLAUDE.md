# `aid` project instructions

`aid` is a single-binary documentation tool that generates static documentation sites from markdown, HTML, OpenAPI, and Protobuf sources. See @docs/PRODUCT_OVERVIEW.md and @docs/RESEARCH_stack.md for the full overview and stack rationale.

## Stack

| Area | Choice |
| --- | --- |
| Runtime | Bun >= 1.2 (mise-pinned to 1.3.13) |
| Language | TypeScript, strict mode, ESM only |
| Lint and format | Biome 2.4.x |
| Styling | Tailwind 4 |
| JSX runtime | custom (`@aid/jsx`, mapped in `tsconfig.json`) |

## Scripts

| Command | Purpose |
| --- | --- |
| `bun run build` | Run `scripts/compile.ts`: emit the schema, bundle the browser runtime, and cross-compile the release binaries |
| `bun run emit-schema` | Emit `schemas/aid.schema.json` from Zod |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | `biome check .` |
| `bun run fmt` | `biome format --write .` |
| `bun test` | Bun test runner |

Run the CLI from source with `bun src/cli/index.ts <command>`, for example `bun src/cli/index.ts dev`.

## Where the rules live

Style and convention rules are split across `.claude/rules/`. Files without `paths:` frontmatter load every session. Path-scoped files load when Claude touches a matching file.

## Hooks

A PostToolUse hook runs Biome on every edited file (`.claude/hooks/format-on-edit.sh`). Do not format files yourself. The hook formats them.
