# Comment cleanup: slice A (src/core, src/cli, scripts, src root, CI, hooks)

Source: comment-auditor, whole-tree audit. Verdict: REQUEST CHANGES. The only suppressions are the two `biome-ignore-all noDefaultExport` lines, which are style-only and kept.

## Must kill

### scripts/

- bundle-web.ts:3-16: the header catalog of `ENTRIES` -> delete.
- bundle-web.ts:34, :36, :38: field docs that restate `name`, `source` and `exportName` -> delete. The comment at :34 is also wrong.
- bundle-web.ts:101-104: the "defensively invoke the package build" rationale -> delete. Extract `buildProtoUi()`.
- compile.ts:3-7: the header that restates the steps -> delete.
- compile.ts:16, :18, :20, :22, :24: `Target` field docs that restate the field names -> delete.
- compile.ts:62-63: a "re-enable once buf-win32" TODO with no issue -> delete. See Notes on release.yml.
- compile.ts:92, :97, :104, :107, :145: step-number narration -> delete. Extract `cleanDist()`, `copySchema()` and `printArtefacts()` if the structure needs to show.
- emit-schema.ts:3-11: the usage header -> delete.
- emit-schema.ts:41: the comment claims a fallback that does not exist -> delete. Call `z.toJSONSchema(AidConfigSchema)` directly and drop the cast and the `typeof` guard.
- manual-test.ts:47, :52-53: they restate the code -> delete.
- stage-natives.ts:27, :29: field docs that restate the fields -> delete.

### .claude/hooks

- format-on-edit.sh:2: narration -> delete. Keep :3.

### src/core

- renderers/markdown.ts:1-5: a `@deprecated` changelog with no importers -> `git rm` the file.
- ai-targets.ts:13: the "Stub - URL templates land with the AI integration PR" sentence -> delete.
- search-index.ts:27-28: "Proto pages are filtered out ... until a proto renderer exists" is stale -> delete. The filter at :44 may be a bug: proto pages are excluded even though `search.weights.proto` exists.
- llms-txt.ts:25, :97: they duplicate the `groupLabelFor` docs -> delete.
- llms-txt.ts:28 -> delete. Rename the field `routePath` to `sortKey`.
- llms-txt.ts:80-85 -> delete. Extract a shared `exportRelativePath(route, suffix)` that both `machineUrlFor` and `pipeline.outputPathForExport` use.
- llms-txt.ts:132 -> delete. Add `const ROOT_GROUP = "Docs"` and extract `compareGroups`.
- pipeline.ts:53-55, :128-129, :174-177: narration -> delete. Extract `renderPageBody(page)` from the ternary in `wrapInLayout`.
- pipeline.ts:117-125: it restates `makeCopyAsset` -> delete. Extract `assertInsideContent(...)`.
- pipeline.ts:150 -> delete. Rename `isInside` to `isLexicallyInside`. See the symlink note.
- tailwind.ts:131-133: a changelog ("no longer @source-scan") -> delete.
- tailwind.ts:162-166: it restates `inlineAidImports` -> delete.
- web-bundle.ts:12-17: a misplaced doc on a string const -> delete. Inline the specifiers into `copyScalarCss` and `copyProtoUiCss`.
- web-bundle.ts:94-97 -> delete. Optionally rename `useSource` to `hasSourceTree`.
- internal/lightningcss-native.ts:82-83: narration -> delete.

## Nits: stale or wrong comments

- internal/lightningcss-native.ts:49: the JSDoc says the shim intercepts `_resolveFilename`, but the code patches `Module.prototype.require`. Fix it and shorten lines 38-56.
- types.ts:9 says the path is "relative to repo root", but it is absolute.
- types.ts:25 omits `.proto`.
- static.ts:19-24 says "Files clobber existing entries", but `AssetRegistry.register` throws on a collision.
- web-bundle.ts:72 says "two entrypoints", but there are four.
- tailwind.ts:35-52: an 18-line narration that is stale about "rendered HTML output". Cut it to the contract.
- search-index.ts:15 says these fields are "Stored", but they are only indexed.
- compile.ts:114-115: "`--define` ... for future runtime branches" is stale.

## Nits: JSDoc that restates the name (rewrite to say why or when)

- cli/commands/build.ts:6, dev.ts:6, help.ts:3
- core/css-writer.ts:7, :13, :19-24
- core/internal/css-scan.ts:1: add the contract. It does not skip braces inside strings or comments.
- core/pipeline.ts:23-28, :210
- core/static.ts:8
- core/types.ts:15, :23, :48, :50
- core/web-bundle.ts:24-41: the three `include*` docs repeat each other. Collapse them.
- core/tailwind.ts:17-20

## Nits: exports missing JSDoc

- cli/commands/fmt.ts:21, lint.ts:21, init.ts:3 `command`
- core/ai-targets.ts:3 `AiButton`
- core/config.ts:28 `AidConfigSchema`, :130 `AidConfig`, :132 `loadConfig`
- core/tailwind.ts:8, :24
- core/types.ts:4, :6, :8, :19, :37, :45, :54, :60
- jsx-runtime.ts:3, :5, :11, :13, :19, :21, :25, :26, :28, :32, :67, :165
  - `render` and `RawHtml` need the escaping contract.
  - Move the comment at :7-10 into the JSDoc on `Component`.

## Nits: borderline keeps

- "Bun.write auto-creates parent dirs" is repeated at bundle-web.ts:80, css-writer.ts:29 and static.ts:38. Keep at most one.
- bundle-web.ts:17-24 duplicates the generated header at :126-140.
- bundle-web.ts:92-95: the claim about Bun.build CSS extraction is unverified.
- stage-natives.ts:16-17 says what mise.toml already shows.
- ci.yml:15, :18: the SHA-pin version annotations. Keep them; Renovate and Dependabot read them.
- internal/lightningcss-bin.d.ts:3-5 duplicates the stage-natives header.

## Kept

- src/css.d.ts:1 and internal/lightningcss-bin.d.ts:1: `biome-ignore-all noDefaultExport`.
- stage-natives.ts:3-14: Bun's .node loader behavior.
- compile.ts:108-113: Bun does not dead-code-eliminate file imports.
- internal/lightningcss-native.ts:75-77, :87-90: dlopen and compiled-binary resolution.
- tailwind.ts:54-60: the lightningcss shim ordering.
- tailwind.ts:155-156: backslashes in `@source` globs.
- dark-mode.ts:22-23: Tailwind 4 `@theme` hoisting.
- dark-mode.ts:3-9, :15-21: token contract.
- web-bundle.ts:52-57: Scalar CSS.
- format-on-edit.sh:3: exit-0 rationale.
- assets.ts, llms-txt.ts:32-38, router.ts:5-11, search-index.ts:11, :16-22, pipeline.ts:219-223, types.ts:27-33, web-bundle.ts:44-62: public contracts.

## Notes for code-reviewer (not comment fixes)

- search-index.ts:44 excludes proto pages from search even though `search.weights.proto` exists.
- `pipeline.ts` `isInside` ignores symlinks, so a symlink inside contentDir can escape it. It also wrongly rejects child names that start with `..` (for example `..foo`).
- release.yml:16-27 builds windows targets that `compile.ts` `TARGETS` lacks. release.yml:30 uses `bun-version: latest` while mise pins 1.3.13.
