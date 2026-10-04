# Ponytail cleanup: slice B (src/renderers, src/lint, src/fmt, src/dev, src/workers, src/search)

Source: ponytail full-intensity audit. Items are behavior-preserving unless marked "behavior change".

## Findings (sorted by impact)

1. **Dead stubs.** `src/search/` (`emit.ts`, `runtime.ts`, `tokenize.ts`) and `src/workers/` (`pool.ts`, `render-worker.ts`) have no importers. Run `git rm` on both directories.
2. **Duplicated lint and fmt orchestration.**
   - `src/lint/orchestrate.ts:26-49` and `src/fmt/orchestrate.ts:31-54` duplicate the same orchestration.
   - Add one `runTools(dir, filter, run: Record<Tool, fn>)` to `src/lint/discovery.ts`, driven by a `PATTERNS: Record<Tool, patterns>` map.
   - Merge `LintReport` and `FormatReport` into one type.
3. **buf temp config files.** `writeTempBufConfig` is duplicated in `src/lint/proto.ts:55-60` and `src/fmt/proto.ts:8-13`. Each run leaks a `$TMPDIR/aid-buf-*.yaml` file.
   - buf's `--config` accepts inline YAML (verified). In lint, use `args.push("--config", bufDefault)`.
   - In fmt, delete `USER_CONFIGS`, `findUserConfig`, the temp config and the `bufDefault` import, because `buf format` reads no config options.
4. **One spawn in `src/fmt/proto.ts:42-70`.**
   - Use `["format", check ? "-d" : "-w", file]`. Add `--exit-code` only in check mode.
   - Use `Bun.$\`...\`.cwd(dir).nothrow().quiet()`.
5. **Simpler process reads.** In `src/lint/proto.ts:118-121` and `src/fmt/proto.ts`, replace `new Response(proc.stdout).text()` and the stderr drain with `Bun.$ ... .nothrow().quiet()`, or with `stderr: "ignore"` plus `proc.stdout.text()`.
6. **Dev error page (behavior change, dev only).**
   - `errorBootstrapPage` in `src/dev/server.ts:161-184` duplicates the overlay in `reload.ts`.
   - Its "build in progress" branch is unreachable, because the session awaits the first rebuild.
   - Replace it with a shell that only loads `RELOAD_CLIENT_SCRIPT`.
   - Delete the server `escapeHtml`, the never-set `DevErrorPayload.file` field, and the `payload.file` line in `reload.ts:28`.
   - With JS disabled, the 503 page no longer shows the error text.
7. **Watcher speculation.**
   - `updateTailwindDeps` in `src/dev/watcher.ts` has no callers, and `ChangeBatch.paths` is never read.
   - Use one `watchers` array, `onChange(configChanged: boolean)`, and a `dirty` flag instead of `pending: Map`.
   - This also touches `session.ts`.
8. **`stripJsonComments` (behavior change).**
   - `stripJsonComments` in `src/lint/config-resolve.ts:45-91` is a 47-line lexer. Replace it with `Bun.JSONC.parse(text)`, which exists on Bun 1.3.13.
   - Trailing commas then parse instead of throwing.
   - Check the `engines.bun` minimum.
9. **fmt skeleton.** `src/fmt/biome.ts`, `openapi.ts` and `markdown.ts` repeat the same loop. Extract `applyFormat(tool, files, check, transform)`.
10. **Markdown fixes.** `src/fmt/markdown.ts` and `src/lint/markdown.ts` duplicate the lint, fixInfo and `applyFixes` flow. Export `fixMarkdown` from lint and call it from fmt.
11. **Biome setup.** `src/fmt/biome.ts` and `src/lint/biome.ts` duplicate the Biome setup and shutdown. Add `withBiome(dir, fn)`.
12. **Colocated-asset plugins.**
    - `colocated-assets.ts:29-54` and `colocated-assets-mdast.ts:15-37` share their body. Extract `queueCopy(...)`.
    - Drop the impossible `typeof src !== "string"` check.
13. **Hast text helpers (minor behavior change).**
    - Three hast text helpers: `elementTextContent` in `html.ts`, `hastToString` in `markdown/index.ts`, and `extractText` in `mermaid.ts`. Replace them with one `hastText(node)`.
    - The html.ts version trims at every level, which drops the spaces in `<title>A <b>B</b></title>`. One helper fixes that.
14. **`html.ts:63-68`.** It re-parses its own frontmatter through `FrontmatterSchema` and double-checks the title. Use `extractHeadMetadata(headEl)` and `title ?? filenameTitle` instead.
15. **`html.ts:94-98`.** `structuredClone(bodyTree)` is unnecessary, because nothing reads `bodyTree` afterwards.
16. **`html.ts:176-186`.** The string branch in `hasClass` is unreachable. Use `(className as string[])?.includes("mermaid")`.
17. **Extras guards.** `openapi/index.ts:108-124` and `proto/index.ts:131-146` each have five `if (x.length > 0)` guards. Replace them with one shared `nonEmpty(obj)` helper.
18. **`session.ts:46-65`.** Replace `inFlight: Promise` and its cast with `let running = false`.
19. **`session.ts:68-75`.** The config-change branch duplicates `shutdown()`. Call `shutdown()` instead.
20. **SSE frames.** The SSE frame format is built in both `server.ts:85-88` and `state.ts:32-33`. Export `sseFrame(event, data)`.
21. **Trailing slashes.** `stripBasePath`, `normalizeBasePath` and `buildUrl` each add a trailing slash. Use one `withSlash(basePath)`.
22. **`state.ts`.** Inline `createDevState` (one caller). Replace `serializeError` with `JSON.stringify`.
23. **`loop.ts`.** `RebuildResult.outputDir` is never read, `rebuildCtx` is single-use, and `durationMs` is computed twice. Clean all three up.
24. **`server.ts:186-192`.** Shorten `isAddrInUse` to `(err as {code?: string} | null)?.code === "EADDRINUSE"`.
25. **Unused option.** `LintOptions.format` and `FormatOptions.format` are never read. Drop them from the CLI calls and tests too.
26. **`lint/markdown.ts:21-23`.** The `"config" in parsed` unwrap targets a format that is never loaded. Delete it.
27. **`lint/configs/buf.default.ts:9-11`.** The `breaking:` block is unused. Delete it.
28. **Unused re-exports.** Delete `export type { Frontmatter }` from `markdown/index.ts:127` and `html.ts:187`.
29. **`shiki.ts`.** `DEFAULT_LANGS` and `DEFAULT_THEMES` are exported but used only locally. Inline them.
30. **`lint/openapi.ts:11`.** Un-export `resolveSpectralRuleset`.
31. **`mermaid.ts:54-71`.** Shrink `hasMermaidLanguageClass` to a `.find(...)` one-liner.
32. **`colocated-assets.ts:56-76`.** Replace the `isRelative` if-chain with one regex.
33. **`lint/discovery.ts:32-63`.** Use `absolute: false`, a `Set` of ignores, and a `Set` for dedupe.
34. **`lint/biome.ts:44-55`.** `toDiagnostic` builds a fake `{0,0}` position and then nulls it. Use an optional `pos` instead.
35. **`config-resolve.ts:14`.** `isAbsolute ? x : resolve(x)` is the same as `resolve(x)`.

## Cross-slice (owned by the slice named)

- **Slice A:** `git rm` `src/core/renderers/markdown.ts`. It is a deprecated shim with no importers.
- **Slice A:** drop `"WebWorker"` from the `tsconfig.json` lib once the workers are gone, and confirm with typecheck.
- **Slice A:** `KNOWN_TOOLS` and `parseFilter` are duplicated in `cli/commands/lint.ts` and `fmt.ts`. Move one copy next to `Tool` in `src/lint/diagnostics.ts`. This touches slice B.
- **Slice A (behavior change):** `escapeHtml` and `escapeAttr` in `jsx-runtime.ts` are identical, and server.ts has a third copy. Use `Bun.escapeHTML`, which emits `&#x27;` instead of `&#39;`.
- **Slice A:** `scripts/manual-test.ts` copies `serveFile` from `src/dev/server.ts`. Import it instead.
- **Slice A:** `rm -rf outputDir` is duplicated in `cli/commands/build.ts:42` and `dev/loop.ts:20`. Move it into `build()`.
- **Slice A:** `extractEmbeddedBuf` and the lightningcss-native extraction duplicate each other. Extract `extractBunfsFile(...)`.
- **Slice A:** base_path normalization is spread across `llms-txt.ts`, server and session. Normalize it once in the Zod schema and re-run `emit-schema`.
- **Slice A:** `as never` casts exist because `JSX.Element.type` is `unknown`. Alias `JSX.Element = Element`.
- **Needs user approval (dependencies):** the following are not applied in the cleanup.
  - `markdownlint-cli2` is unused.
  - `markdownlint`, `rehype-parse`, `unist-util-visit` and `vfile` are imported but undeclared.
  - `remark-frontmatter` is unused.
- **Bug:** `renderOpenApi` passes `machineUrl: ""` even though it emits a `.json` sidechain.

## Not worth it

- `styleText` in place of the ANSI table: it loses the TTY check.
- `remark-frontmatter` in place of the regex.
- Adding `hast-util-to-string`.
- `Bun.serve` routes.
- The fallback branches in `injectReloadScript`.
- The traversal check: it is a security boundary.
- The mtime dedup: it works around macOS `fs.watch` events on reads.
- The OpenAPI input guards: they validate user input at a trust boundary.
- The HTML sniff regex.
- The `titleSink` plugin order.
- Batching buf format calls.
- Brace glob merging.
- Caching in `offsetToLineCol`.
- The `resolveBufBinary` cache.
- The `lintMarkdown` default options.
