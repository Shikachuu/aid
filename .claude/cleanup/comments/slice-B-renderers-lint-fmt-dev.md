# Comment cleanup: slice B (src/renderers, src/lint, src/fmt, src/dev, src/workers, src/search)

Source: comment-auditor, whole-tree audit. Verdict: REQUEST CHANGES.

## Must kill

- src/workers/render-worker.ts:11 is commented-out `postMessage` code, and :3-9 is "Stub." prose. `render-worker.ts` and `createWorkerPool` in `src/workers/pool.ts` have no importers. Delete both files. Coordinate with the ponytail pass.
- src/search/runtime.ts:9 "/*implemented in src/web/search.ts*/" is on the stub `attachSearch`, which has no references. Delete the file.
- src/lint/proto.ts:90 "// ignore non-JSON lines" -> delete. Extract `tryParseJson(line): BufJsonError | null`.
- src/dev/watcher.ts:62 "// File deleted - treat as a real change." -> delete. Extract `statMtime(absPath): Promise<number | null>`.
- src/dev/watcher.ts:89 and :100 "may not exist; ignore" -> delete. See the Correctness section.
- src/fmt/openapi.ts:30 "// skip files we can't parse" -> delete. See the Correctness section.
- src/renderers/html.ts:70-71 justifies the `bodyTree` wrapping -> delete.
- src/renderers/html.ts:89-90 is narration -> delete.
- src/renderers/html.ts:93-95 claims the `structuredClone` is "defensive", which is unproven -> delete. Extract `toMarkdown(bodyTree)`.
- src/renderers/markdown/index.ts:53-55 is design rationale for the shared mdast -> delete. Extract `buildMdast(body, file, args)`.
- src/renderers/markdown/index.ts:67-68 is a changelog note about the "pre-fork output" -> delete.
- src/renderers/markdown/index.ts:92-93 is a mutation claim that the auditor's test disproved (remark-rehype leaves the mdast unchanged) -> delete the comment. Drop the clone too if the tests still pass.
- src/renderers/markdown/index.ts:97, first sentence only ("MD branch: serialize ...") -> delete.

## Correctness

- src/lint/markdown.ts:41 and src/fmt/markdown.ts:20 have `biome-ignore noExplicitAny` with the reason "markdownlint Configuration type isn't published". That is false: `markdownlint` exports `Configuration`. Type `resolveMarkdownConfig` as `Promise<Configuration>` and drop `as any`.
- src/dev/watcher.ts `watchDir` and `watchFile` use catch-alls that swallow EMFILE and ENOSPC, which silently disables hot reload. Catch ENOENT only, or check that the path exists first.
- src/fmt/openapi.ts `formatOpenApi` uses a bare `catch` that returns `ok: true` for a malformed spec, so `aid fmt --check` passes on broken files. Emit a Diagnostic instead. This changes behavior.
- src/dev/watcher.ts:19-24 claims that macOS `fs.watch` emits events on reads. This is kept as a platform constraint, but nobody has verified it.

## Nits: exports missing JSDoc

- src/dev/loop.ts:5 `RebuildResult`
- src/dev/server.ts:6 `StartDevServerArgs`, :13 `DevServerHandle`
- src/dev/session.ts:8 `StartDevSessionArgs`
- src/dev/state.ts:20 `createDevState`
- src/dev/watcher.ts:5 `ChangeBatch`, :12 `WatchHandle`
- src/renderers/markdown/frontmatter.ts:19 `Frontmatter`
- src/workers/pool.ts:13 `createWorkerPool` (removed with the file)

## Nits: JSDoc that restates the name (rewrite to say why or when)

- src/lint/diagnostics.ts:1, :4, :14, :24
- src/lint/orchestrate.ts:8, :16
- src/fmt/orchestrate.ts:14, :22
- src/lint/openapi.ts:21
- src/renderers/html.ts:15, src/renderers/markdown/index.ts:22, src/renderers/openapi/index.ts:7, src/renderers/proto/index.ts:7, src/renderers/openapi/parser.ts:3, src/renderers/markdown/colocated-assets.ts:14, src/renderers/markdown/frontmatter.ts:23

## Nits: stale or inaccurate JSDoc

- src/dev/reload.ts:5-6 says the overlay listens for `error`, but the script listens for `error-detail`.
- src/lint/config-resolve.ts:33 omits the `.jsonc` support.
- src/lint/proto.ts:96 and src/fmt/proto.ts:17 say "Skips silently", but both return `skipped` with a reason.
- src/search/emit.ts:7, src/search/runtime.ts:6, src/search/tokenize.ts:10 and src/workers/pool.ts:6 are "Stub." text on dead files. Deleting the files removes these.
- src/renderers/markdown/shiki.ts:6-7 "Users can grow the list later via a config knob" describes a plan. Cut it.

## Nits: longer than the contract needs

- src/dev/watcher.ts:19-24
- src/lint/proto.ts:35-41 duplicates the comment at :26.
- src/renderers/openapi/index.ts:20-22 points into another file and will rot.
- src/renderers/html.ts:42-45: trim the "per v0.1's contract" tail.
- src/search/tokenize.ts:4-9 is an ASCII table of planned fields.

## Kept

- src/lint/buf-bin.d.ts:1 `biome-ignore-all noDefaultExport` (style-only, required for the file import).
- src/lint/proto.ts:26: bunfs paths cannot be passed to posix_spawn (Bun platform behavior).
- src/dev/server.ts:34-36: Bun.serve's default `idleTimeout` would close the SSE streams.
- src/renderers/html.ts:42-43, first sentence: rehype-parse fabricates the `<html>` and `<body>` wrappers.
- src/renderers/markdown/index.ts:97-99: remark-gfm is needed for the stringifier.
- src/renderers/markdown/mermaid.ts:11-19: plugin order contract.
- src/fmt/openapi.ts:8: the YAML comment-loss caveat.
- Exported contract JSDoc in src/lint/*, src/dev/*, and src/renderers/* (see the auditor's list).
