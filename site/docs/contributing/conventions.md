---
title: Conventions
description: The repository rules in .claude/rules, the Biome configuration, the format-on-edit hook, and the commit style.
llms: optional
sidebar:
  order: 7
---

The rules below apply to every contributor. The files under `.claude/rules/` are written for Claude Code, which loads them automatically, but they describe the conventions for human contributors too.

## Rules in .claude/rules

Claude Code loads a rule file without `paths:` frontmatter in every session. It loads a file with `paths:` only when it touches a matching file.

| File | Applies to | Rule |
| --- | --- | --- |
| `dependencies.md` | every session | Check Bun's built-ins (`Bun.serve`, `Bun.file`, `Bun.Glob`, `Bun.YAML`, `Bun.build`, and others) before adding an npm package. Propose every dependency change before making it. Install through `mise install`, never a bare `bun install`. Pin the resolved version with a caret range. Platform subpackages stay exact-pinned to match their parent. |
| `css.md` | `**/*.css` | Write CSS only through Tailwind 4 directives: `@apply`, `@theme`, `@utility`, `@layer`, `@variant`, `@source`, `@config`, `@reference`, `@plugin`. Design tokens go in `@theme`, not in bare custom properties on `:root`. |
| `generated.md` | `schemas/**`, `**/*.schema.json`, `site/docs/reference/**`, `site/static/schemas/**` | Never hand-edit generated files. `schemas/aid.schema.json` comes from `src/core/config.ts` through `bun run emit-schema`. The reference pages come from `bun run gen-docs`. Extend the Zod schema instead of adding validation next to it. |
| `jsdoc.md` | `src/**/*.{ts,tsx}`, `scripts/**/*.ts` | Every exported function, const, class, and type alias gets a JSDoc block with at least a one-line summary. The JSDoc says why and when, not what the types already say. |
| `tests.md` | `tests/**`, `src/**/*.test.ts` | `bun test` only. Fixtures go in `tests/fixtures/`. Prefer integration tests through public entry points. See [testing](./testing.md). |
| `docs-sync.md` | `src/**`, `scripts/**`, `packages/proto-ui/src/**`, `.github/workflows/**`, `mise.toml`, `site/**` | Run the `docs-sync` skill after a change that users or contributors can see. See [docs site](./docs-site.md). |

## Biome

`biome.json` configures formatting and linting for `src/`, `scripts/`, `tests/`, `packages/`, `site/`, and the root `*.json` and `*.md` files. It skips `node_modules`, `dist`, `.bun`, every `*.svg`, `schemas/aid.schema.json`, and the invalid JSON fixture in `tests/fixtures/lint-fixtures/openapi-bad-json`. It turns off Biome's markdown and YAML formatter and linter, so Biome leaves `.md` files to aid's own formatter and markdownlint.

Formatter settings:

- Two-space indentation, a line width of 100, and LF line endings.
- Double quotes in JavaScript and JSX.
- No semicolons, except where automatic semicolon insertion needs one.
- Trailing commas everywhere and parentheses around every arrow function parameter.

Lint rules beyond Biome's `recommended` preset:

| Rule | Level | Effect |
| --- | --- | --- |
| `style/noDefaultExport` | error | Named exports only. The three `.d.ts` files that declare `with { type: "file" }` and `with { type: "text" }` imports (`src/css.d.ts`, `src/lint/buf-bin.d.ts`, `src/core/internal/lightningcss-bin.d.ts`) turn it off with `biome-ignore-all`. |
| `style/useBlockStatements` | error | Every `if`, `else`, and loop body needs braces. |
| `style/useConsistentTypeDefinitions` | error | Use `type`, not `interface`. |
| `complexity/useArrowFunction` | error | Use arrow functions instead of function expressions. |
| `performance/noNamespaceImport` | error | No `import * as`. |
| `nursery/useTailwindSortedClasses` | warn | Tailwind classes must be sorted. The top-level `tailwind` block applies it to the `class` and `className` attributes, the `clsx`, `cn`, `tw`, and `twMerge` calls, and `cva` variants. |

The CSS parser has `tailwindDirectives` on, so Biome accepts `@theme`, `@apply`, and the other Tailwind directives.

### No promise chains

`biome.json` loads the GritQL plugin `plugins/no-promise-chains.grit`. It reports every `.then(...)`, `.catch(...)`, and `.finally(...)` call with the message "Prefer async/await over Promise.then/.catch/.finally." Write `await` with `try`/`catch` instead.

## Format-on-edit hook

`.claude/settings.json` registers `.claude/hooks/format-on-edit.sh` as a `PostToolUse` hook for Claude Code's `Edit`, `Write`, and `MultiEdit` tools. The script reads the edited path from the hook payload and formats that one file:

- `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.jsonc`, and `.css` files go through `bun x biome check --write`.
- `.md` files go through `formatMarkdown` from `src/fmt/markdown.ts`, which applies markdownlint's fixable rules with the same config resolution as `aid lint`.

It skips files under `node_modules`, `dist`, and `.bun`, plus the generated `schemas/aid.schema.json`, `site/docs/reference/**`, and `site/static/schemas/**`. It ignores formatter failures and always exits 0. Without Claude Code, run `bun run fmt` for code and `bun src/cli/index.ts fmt <dir> --filter md` for markdown.

## Commits

Commit subjects use a type prefix and a short, lowercase, present-tense summary:

- `feat:` for new behavior, for example `feat: render GFM alert blockquotes as themed callouts`.
- `fix:` for bug fixes.
- `refactor:` for changes without a behavior change.
- `chore:` for tooling and maintenance.

Add a body only when the reason for the change is not obvious from the subject.
