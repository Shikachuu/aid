---
title: Conventions
description: The repository rules in .claude/rules, the bun lint and bun fmt configuration, the format-on-edit hook, and the commit style.
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
| `generated.md` | `schemas/**`, `**/*.schema.json`, `docs/content/reference/**`, `docs/static/schemas/**` | Never hand-edit generated files. `schemas/aid.schema.json` comes from `src/core/config.ts` through `bun run emit-schema`. The reference pages come from `bun run gen-docs`. Extend the Zod schema instead of adding validation next to it. |
| `jsdoc.md` | `src/**/*.{ts,tsx}`, `scripts/**/*.ts` | Every exported function, const, class, and type alias gets a JSDoc block with at least a one-line summary. The JSDoc says why and when, not what the types already say. |
| `tests.md` | `tests/**`, `src/**/*.test.ts` | `bun test` only. Fixtures go in `tests/fixtures/`. Prefer integration tests through public entry points. See [testing](./testing.md). |
| `code-search.md` | every session | Find symbols and trace callers with the codebase-memory-mcp graph tools. Keep Grep and rg for literal strings, config keys, markdown, CSS, and generated files. Leave indexing to `mise install`. Check third-party APIs with Context7, and trust `bun-types` over Context7 for the Bun canary. See [MCP servers](./dev-setup.md#mcp-servers-for-claude-code). |
| `docs-sync.md` | `src/**`, `scripts/**`, `packages/proto-ui/src/**`, `.github/workflows/**`, `mise.toml`, `docs/**` | Run the `docs-sync` skill after a change that users or contributors can see. See [docs site](./docs-site.md). |

## bun lint and bun fmt

`bunfig.toml` configures `bun lint` for the repository, and `.prettierrc.json` configures `bun fmt`. `scripts/gen-bunfig.ts` generates both from the rules and options `aid lint` and `aid fmt` bundle for user projects (`src/lint/configs/bun.default.ts`), plus the repository rules below. Run `bun run gen-bunfig` after changing either, and `bun run gen-bunfig --check` to find drift.

- `bun run lint` runs `bun lint` over `src/`, `scripts/`, `tests/`, and `packages/`, then aid's own CSS checks over every `.css` file.
- `bun run fmt` runs `bun fmt` over the JS, TS, JSON, and CSS files in `src/`, `scripts/`, `tests/`, `packages/`, and `docs/`, and the root `*.json` files. Markdown stays with aid's own formatter and markdownlint.
- `.prettierignore` keeps `bun fmt` away from the generated files, `.prettierrc.json` among them, and from the invalid JSON fixture in `tests/fixtures/lint-fixtures/openapi-bad-json`.

Formatter settings:

- A line width of 100.
- No semicolons, except where automatic semicolon insertion needs one.
- Prettier's defaults for the rest: two-space indentation, double quotes, trailing commas everywhere, parentheses around every arrow function parameter, and LF line endings.
- `prettier-plugin-tailwindcss`, which `bun fmt` has built in, sorts Tailwind classes in `className` attributes, `@apply` rules, and the `clsx`, `cn`, `tw`, `twMerge`, and `cva` calls. Its `tailwindStylesheet` option points at `src/theme/main.css`, and at `packages/proto-ui/src/tailwind-entry.css` for files under `packages/proto-ui/`. Without it, the plugin would not know aid's theme classes such as `bg-aid-bg` and would sort them first. The repo formats through a Prettier config because `bunfig.toml`'s `[fmt]` section has no stylesheet option.

Rules on top of the bundled set:

| Rule | Level | Effect |
| --- | --- | --- |
| `import/no-default-export` | error | Named exports only. The three `.d.ts` files that declare `with { type: "file" }` and `with { type: "text" }` imports (`src/css.d.ts`, `src/lint/buf-bin.d.ts`, `src/core/internal/lightningcss-bin.d.ts`) turn it off with an `eslint-disable` comment. |
| `curly` | error | Every `if`, `else`, and loop body needs braces. |
| `@typescript-eslint/consistent-type-definitions` | error | Use `type`, not `interface`. |
| `prefer-arrow-callback` | error | Use arrow functions instead of function expressions as callbacks. |
| `import/no-namespace` | error | No `import * as`. |
| `promise/prefer-await-to-then` | error | No `.then(...)`, `.catch(...)`, or `.finally(...)` chains. Write `await` with `try`/`catch` instead. |

## Format-on-edit hook

`.claude/settings.json` registers `.claude/hooks/format-on-edit.sh` as a `PostToolUse` hook for Claude Code's `Edit`, `Write`, and `MultiEdit` tools. The script reads the edited path from the hook payload and formats that one file:

- `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.jsonc`, and `.css` files go through `bun fmt`. JS and TS files then go through `bun lint --fix`.
- `.md` files go through `formatMarkdown` from `src/fmt/markdown.ts`, which applies markdownlint's fixable rules with the same config resolution as `aid lint`.

It skips files under `node_modules`, `dist`, and `.bun`, plus `.prettierrc.json` and the generated `schemas/aid.schema.json`, `docs/content/reference/**`, and `docs/static/schemas/**`. When `bun fmt` or the markdown formatter fails, it prints the error to stderr and exits with code 2, so Claude Code shows the failure to Claude. `bun lint --fix` failures are ignored. Without Claude Code, run `bun run fmt` for code and `bun src/cli/index.ts fmt <dir> --filter md` for markdown.

## Codebase-memory hooks

`.claude/settings.json` also registers `codebase-memory-mcp hook-augment` for these Claude Code hook events:

| Event | Matcher | What it adds |
| --- | --- | --- |
| `SessionStart` | none, so every start, resume, clear, and compact | Whether the checkout is indexed, and which graph tools to use. |
| `SubagentStart` | `*` | The same context for each subagent. |
| `PreToolUse` | `Grep\|Glob\|Bash` | Graph symbols that match the search, next to the tool's own results. |
| `PostToolUse` | `Read\|mcp__.*codebase-memory-mcp__.*` | Lines of a read file that the index could not parse. Graph tool calls reset its reminder to use the graph. |

Each hook runs `MISE_AUTO_INSTALL=0 mise exec -C "$CLAUDE_PROJECT_DIR" -- codebase-memory-mcp hook-augment || true` with a 5-second timeout. The hooks only add context and never block a tool call:

- `MISE_AUTO_INSTALL=0` stops mise from downloading a missing binary inside a hook. Without it, mise falls back to its shim, which installs the tool and runs past the timeout. `.mcp.json` sets the same variable for the MCP server.
- `|| true` turns a failure into exit 0, so Claude Code continues. The command does not redirect stderr, so error text from mise or the binary is kept.

The MCP server starts the codebase-memory-mcp daemon. Without a running daemon, the hooks add no graph context.

## Commits

Commit subjects use a type prefix and a short, lowercase, present-tense summary:

- `feat:` for new behavior, for example `feat: render GFM alert blockquotes as themed callouts`.
- `fix:` for bug fixes.
- `refactor:` for changes without a behavior change.
- `chore:` for tooling and maintenance.

Add a body only when the reason for the change is not obvious from the subject.
