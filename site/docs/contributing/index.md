---
title: Contributing
description: Map of the aid repository and the index of the contributor pages.
llms: optional
sidebar:
  order: 0
---

aid is one Bun and TypeScript codebase that compiles to a single binary per platform. This page lists what each top-level directory holds. The other contributor pages explain each part in depth.

## Repository map

| Path | Contents |
| --- | --- |
| `src/cli` | The citty command tree. `src/cli/index.ts` runs `main` from `src/cli/main.ts`, which lazy-loads each command in `src/cli/commands/`. |
| `src/core` | The build: config loading (`config.ts`), routing, the `build()` pipeline (`pipeline.ts`), navigation, link checking, search index, llms.txt, Tailwind compile, and web bundle output. |
| `src/core/internal` | Helpers for the compiled binary: embedded-file extraction and the lightningcss native shim. |
| `src/renderers/markdown` | The remark and rehype chain for `.md` pages: frontmatter, callouts, colocated images, mermaid, Shiki. |
| `src/renderers/html.ts` | The renderer for full `.html` documents. |
| `src/renderers/openapi` | OpenAPI sniffing, parsing through `@scalar/openapi-parser`, and the page shell. |
| `src/renderers/proto` | The `.proto` renderer. It parses with `@aid/proto-ui/parser` for search tokens and emits a mount point. |
| `src/theme` | The page components in `src/theme/components/*.tsx`, written against aid's own JSX runtime, and the bundled theme stylesheet `src/theme/main.css`. |
| `src/jsx-runtime.ts` | The synchronous JSX-to-string renderer the theme components use. |
| `src/web` | The browser runtime: search, mermaid, the Scalar and proto-ui entries, and the generated `_bundled.ts`. |
| `src/lint` | `aid lint`: markdownlint, Spectral, `bun lint`, buf, and the CSS checks, with discovery and default configs. |
| `src/fmt` | `aid fmt`: markdownlint fixes, `bun fmt`, buf format, and OpenAPI formatting. |
| `src/dev` | `aid dev`: a `Bun.serve` server, a file watcher, and the rebuild loop with live reload over server-sent events. |
| `packages/proto-ui` | `@aid/proto-ui`, a React package with the `.proto` parser (protobufjs) and the proto reference UI. |
| `scripts/` | Build and docs scripts: `compile.ts`, `natives.ts`, `bundle-web.ts`, `stage-natives.ts`, `check-binaries.ts`, `emit-schema.ts`, `gen-docs.ts`, `gen-bunfig.ts`, `gen-css-data.ts`, `generated-files.ts`, `docs-affected.ts`, `manual-test.ts`. |
| `schemas/` | `aid.schema.json`, the JSON Schema that `scripts/emit-schema.ts` emits from the Zod config schema. |
| `assets/scaffold` | A starter project (`aid.yaml`, `main.css`, `docs/index.md`). `tests/integration/scaffold.test.ts` builds it. `aid init` does not copy it yet. |
| `tests/unit` | Unit tests for single modules. |
| `tests/integration` | Tests that run `build()` on a temporary project. |
| `tests/fixtures` | The `sample-site` project and the lint fixtures. |
| `site/` | This documentation site, built by aid. |
| `.claude/` | Claude Code setup: style rules in `rules/`, the format hook in `hooks/`, and the `docs-sync` skill in `skills/`. |

## Contributor pages

- [Development setup](./dev-setup.md): mise, installs, and the package scripts.
- [Architecture](./architecture.md): the module graph, the JSX runtime, and the core types.
- [Build pipeline](./build-pipeline.md): every phase of `build()`, in order.
- [Single binary](./single-binary.md): how `scripts/compile.ts` embeds the web runtime and native binaries.
- [Testing](./testing.md): the test layout, helpers, and fixtures.
- [Conventions](./conventions.md): code style, lint rules, the format hook, and commit style.
- [Docs site](./docs-site.md): how this site is built, generated, and kept in sync.
