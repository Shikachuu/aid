# Ponytail cleanup: slice C (src/web, src/theme, packages/proto-ui)

## Findings (sorted by impact, highest first)

- `src/web/proto-entry.ts:1-20`, `packages/proto-ui/src/hydrate.tsx:1-20`, `packages/proto-ui/src/hooks/useProtoAst.ts:1-112`, `packages/proto-ui/src/components/*.tsx` [rung 1/4, needless client runtime] Every proto page ships React, react-dom, protobufjs and marked to the browser. I measured `src/web/proto-entry.ts` minified with `Bun.build`: 542.8 KB, 164.6 KB gzip. The browser then fetches the sibling `.proto`, parses it and renders a static document. `src/renderers/proto/index.ts:28` already parses the same AST on the server. Only two parts of the UI are interactive, and both have native equivalents: the ViewSource toggle can be `<details>`, and copy-link can be a plain `#fqn` anchor. `src/jsx-runtime.ts` already maps `className` to `class` and handles `key`, Fragment and `dangerouslySetInnerHTML`, so the components port almost unchanged once their hooks go. The smaller design: `renderProto` renders `<ProtoReference ast={ast}/>` through aid's JSX at build time. That lets you delete `proto-entry.ts`, `hydrate.tsx`, `useProtoAst.ts`, the loading, idle and error states, `aidProtoJs` and `protoBundleHref`, the `react`/`react-dom` deps, and the `bundle index.js`/`hydrate.js` steps in `scripts/build.ts`. The proto CSS can then go through aid's main Tailwind compile. Effect: behavior change. Pages render with no JS, the loading placeholder goes away, and the "standalone React package" goal in `packages/proto-ui/package.json:4` is dropped. This is a real fork to confirm with the user, because CI never publishes proto-ui (`release.yml` only runs `bun publish` at the root). Callers touched: `src/renderers/proto/index.ts`, `src/theme/components/PageProto.tsx`, `src/theme/components/Layout.tsx`, `src/core/pipeline.ts`, `src/core/web-bundle.ts`, `src/web/_bundled.ts`, `scripts/bundle-web.ts`, `package.json`, `packages/proto-ui/package.json`, `packages/proto-ui/scripts/build.ts`.

- `packages/proto-ui/src/parser.ts:96-111` [rung 5, bug] The hand-written `PROTO_SCALARS` list leaves out `sfixed64`. `sfixed64` fields therefore get `scalar: false, fqn: null` and render as the grey `proto-type-unresolved` style. protobufjs already exports the complete list (`types.basic`, typed in `index.d.ts:1864`). Replacement: `const isScalar = (raw: string) => Object.hasOwn(protobuf.types.basic, raw)`. Effect: behavior change (fixes the sfixed64 bug). Callers touched: none outside parser.ts.

- `src/web/ai-button.ts:5-12`, `src/theme/components/AIButton.tsx:1-7` [rung 1, dead stub that ships] The click handler is empty, and `pipeline.ts:182-183` and `renderers/openapi/index.ts:36` always pass `machineUrl: ""`. Every page shows an "Open in AI" button that does nothing, wrapped in a `.aid-page-toolbar` div that has nothing else in it. `src/core/ai-targets.ts:15` `buildAiButtons` is also an unused stub. Replacement: delete `ai-button.ts`, `AIButton.tsx`, the toolbar divs and the `machineUrl` props until the feature lands. When it does, put the data attributes on the `<button>` itself, not on a wrapper div. Effect: behavior change (a non-working button disappears). Callers touched: `src/web/index.ts`, `src/theme/components/PageMarkdown.tsx`, `PageHtml.tsx`, `PageOpenAPI.tsx`, `PageProto.tsx`, `src/core/pipeline.ts`, `src/renderers/openapi/index.ts`, `src/renderers/proto/index.ts`.

- `src/web/dark-mode.ts:7-15`, `src/theme/components/DarkToggle.tsx:1-12` [rung 1, dead stub that ships] Same pattern: the toggle's click handler is empty and nothing ever sets `data-aid-theme`. Replacement: delete both, and drop `<DarkToggle />` from `Header.tsx:19`, until the toggle is real. Effect: behavior change (a non-working button disappears). Callers touched: `src/web/index.ts`, `src/theme/components/Header.tsx`. `src/web/openapi-entry.ts:11` mentions it in a comment.

- `src/web/search.ts:245-263` [rung 5] `MiniSearchSearchOptions`, `MiniSearchLike`, `MiniSearchLoadOptions` and `MiniSearchStatic` re-declare types that `minisearch` 7.2 already ships. They also force the casts at :104 and :100. Replacement: `const { default: MiniSearch } = await import("minisearch")`, with `let ms: MiniSearch | null`. Effect: behavior-preserving. Callers touched: none.

- `src/web/search.ts:99-105` [rung 5] The code reads `window.__AID_SEARCH__` as a parsed object, runs `JSON.stringify` on it, and hands the string to `loadJSON`, which parses it again. MiniSearch has `loadJS(plainObject, opts)` for exactly this case. Replacement: `ms = MiniSearch.loadJS(data, opts)`. A further step: emit `search-index.json`, then `MiniSearch.loadJSON(await (await fetch(indexHref)).text(), opts)`. That removes `loadIndexScript`, `cssEscape` and the window global. It changes the emitted filename and breaks the `window.__AID_SEARCH__=` assertions in `tests/integration/build.test.ts:189-212` and `tests/unit/search-index.test.ts`. Effect: `loadJS` is behavior-preserving; the JSON variant is a behavior change. Callers touched: the JSON variant also touches `src/core/search-index.ts`, `docs/PRODUCT_OVERVIEW.md` and those tests.

- `src/web/search.ts:209-243` [rung 1/4] In `loadIndexScript`, the "existing script" branch (:212-223) can never run. The function is only reached through the `loadPromise` guard (:45), and only one SearchBox renders per page. `cssEscape` (:237-243) exists only for that dead selector, and its fallback re-implements `CSS.escape`, which every browser has. Replacement:

  ```ts
  const loadIndexScript = (src: string) => new Promise((resolve, reject) => {
    document.head.append(Object.assign(document.createElement("script"), { src, onload: resolve, onerror: reject }))
  })
  ```

  Effect: behavior-preserving. Callers touched: none.

- `src/web/search.ts:33-35, 188-207, 125, 129-133` [over-defensive on internal data] `parseWeights` (20 lines), the `Number.isFinite` guard on typo tolerance, and the `typeof === "string"` checks on stored fields all validate data that aid's own build wrote from a Zod-validated config. This is not a trust boundary. Replacement: `const weights: Record<string, number> = JSON.parse(input.dataset.aidSearchWeights ?? "{}")`, `const typoTolerance = Number(input.dataset.aidSearchTypoTolerance)`, and `items = raw.slice(0, MAX_RESULTS) as unknown as SearchHit[]`. Also drop `SearchHit.id`, which nothing reads. Effect: behavior-preserving for any build aid produces. Callers touched: none.

- `src/web/search.ts:37-39, 29-31` [needless state] `ready` duplicates `ms !== null`, and `loadPromise` only serves as a once-guard. Lines 29-31 copy values into non-null consts only to narrow types. Replacement: a single `let ms` plus `let loading = false`, and narrow with one early return. Effect: behavior-preserving. Callers touched: none.

- `src/web/search.ts:139-180` [rung 6/7] The code builds a `DocumentFragment`, then appends it. `renderActive` with the `data-aid-search-result-index` attribute is a second render path, used only to update `aria-selected`. Replacement: `results.replaceChildren(...items.map(toLink))`, and for arrow keys either call `render()` again (at most 8 nodes) or loop over `results.children`. Effect: behavior-preserving. Callers touched: none.

- `src/web/search.ts:89-93` [needless indirection] The document-level click-outside listener repeats the blur handler (:84-87), because any outside click already blurs the input. You could also replace both with `root.addEventListener("focusout", e => { if (!root.contains(e.relatedTarget as Node)) close() })`, which removes the 150 ms timer. Effect: almost behavior-preserving. One edge case: if the index finishes loading after blur and the input has text, the dropdown stays open until the next focus change. Callers touched: none.

- `src/theme/components/PageIndex.tsx:1-14` [rung 1, dead] Nothing imports `PageIndex`. The router (`src/core/router.ts:39-53`) never produces the `"index"` PageKind, and `dispatchRenderer` has no `"index"` case. Replacement: delete the file. Effect: behavior-preserving. Callers touched: none.

- `src/theme/partials.ts:1-17` [rung 1, dead] `resolvePartial` is a stub that returns its fallback, and nothing calls it. Replacement: delete the file. Effect: behavior-preserving. Callers touched: none.

- `packages/proto-ui/src/parser.ts:9-11, 88, 93, 135, 140, 154-161, 183-187, 225` [rung 1] AST fields that no consumer reads: `byFqn`, `targetKind` and `imports`. `ast.syntax` is only used inside the parser. `byFqn` is threaded through `walkNamespace` and `mapMessage` as an extra parameter and written at four sites. Replacement: delete those fields, the `byFqn` parameter, `ProtoEntity` and `ProtoSyntax` from the public types, and keep `syntax` as a local. Effect: behavior-preserving for aid. The package's public type surface shrinks. Callers touched: `packages/proto-ui/src/index.ts`.

- `src/theme/components/Layout.tsx:9-36, 64-65, 78-81` [rung 7] Six optional `*Href?: string | null` props each render one conditional `<link>` or `<script>` tag. Replacement: `stylesheets: string[]` and `scripts: string[]` props, rendered with `.map(href => <link rel="stylesheet" href={href}/>)` and `.map(src => <script type="module" src={src}/>)`. The pipeline builds the arrays with `filter(Boolean)`. Separately, `defer` on `type="module"` does nothing, because module scripts are already deferred. Effect: behavior-preserving, apart from dropping the no-op `defer`. Callers touched: `src/core/pipeline.ts`.

- `src/theme/components/PageHtml.tsx:1-24`, `src/theme/components/PageMarkdown.tsx:1-18` [rung 2, duplicate] The two components are identical except for one class name. Replacement: `PageProse({ kind, bodyHtml })` rendering `<article class={`aid-page aid-page-${kind}`}>`. Effect: behavior-preserving. Callers touched: `src/core/pipeline.ts:178-183`, which collapses to one call. `tests/integration/build.test.ts:143` still passes.

- `src/theme/main.css:122-134` plus `src/renderers/markdown/shiki.ts:53` [rung 5] The `.shiki` CSS-variable flip block repeats what Shiki 4 already does with `defaultColor: "light-dark()"`. With that option Shiki emits `color: light-dark(#l, #d)` inline. Replacement: set that option and delete the block. CSS `color-scheme` then drives highlighting, which also suits a future manual dark toggle better. Effect: behavior-preserving visually. Callers touched: `src/renderers/markdown/shiki.ts`.

- `src/theme/main.css:26-35` [rung 6] Two `color-scheme` rules plus a media query. Replacement: `:root { @apply scheme-light-dark; }`. The installed Tailwind ships `scheme-light-dark`. Effect: behavior-preserving. Callers touched: none.

- `src/theme/main.css:43-64, 141-163` [rung 5] Raw declarations re-implement utilities that Tailwind already generates from the `@theme` tokens. Examples: `background: var(--color-aid-bg)` is `bg-aid-bg`, `color: var(--color-aid-text)` is `text-aid-text`, `font-family: var(--font-aid-mono)` is `font-aid-mono`. The header and footer share a border rule that the footer then partly undoes; give them separate rules (`.aid-header { @apply p-4 border-b border-aid-border }`, `.aid-footer { @apply p-4 border-t border-aid-border }`). This also brings the file in line with `.claude/rules/css.md`. Effect: behavior-preserving. Callers touched: none. Note that `tests/integration/build.test.ts:95-99` matches selectors and token names, and those stay.

- `src/theme/components/Nav.tsx:1-28`, `Layout.tsx:13, 70-72` [rung 1] `pipeline.ts:196` always passes `nav: []`, and nothing in the repo builds a `NavNode`. Every page renders an empty `<nav><ul></ul></nav>` inside a 16rem sidebar column. You can delete it until a nav tree exists, or keep it as planned work. Effect: behavior change if deleted (the empty column goes away, so `.aid-shell` needs `grid-template-columns` updated). Callers touched: `src/core/pipeline.ts`, `src/theme/main.css`.

- `src/web/index.ts:5-9`, `mermaid-entry.ts:8-10`, `openapi-entry.ts:13`, `proto-entry.ts:10` [rung 4] The `DOMContentLoaded` wrappers are redundant. `type="module"` scripts run after parsing and before `DOMContentLoaded` fires, and these tags also sit at the end of `<body>`. Replacement: top-level code. With the two stubs gone, `index.ts` is just `attachSearch()`, so `search.ts` can be the entry. `mermaid-entry.ts` can likewise become `mermaid.ts`'s own top-level call. Effect: behavior-preserving. Callers touched: `src/core/web-bundle.ts:66-69` and `scripts/bundle-web.ts:42-47` if entry files merge.

- `src/web/mermaid.ts:39-48, 14-17, 30-33` [rung 1/7] `currentTheme` reads `data-aid-theme`, which nothing sets, so it always reaches the `matchMedia` fallback. `matchMedia` is created twice. The `WeakMap` of originals and the `src !== undefined` check are more machinery than needed. Replacement:

  ```ts
  const media = matchMedia("(prefers-color-scheme: dark)")
  const sources = [...elements].map(el => el.textContent)
  ```

  Restore with `elements.forEach((el, i) => { el.removeAttribute("data-processed"); el.textContent = sources[i] })`, and use `theme: media.matches ? "dark" : "default"`. Effect: behavior-preserving. Callers touched: none.

- `packages/proto-ui/src/hooks/useProtoAst.ts:10-13, 31, 42-51, 72-78` [rung 1, speculative option] Nobody passes the `signal` option; `hydrate` only passes `protoUrl`. The parent-abort wiring (14 lines) exists only for it. The `protoText` and `ast` arms, and the idle arm at :13, are never used by aid. The `source` field in `UseProtoAstResult` (:16-19) is never read. Line 65's `error.name === "AbortError"` is already covered by `controller.signal.aborted`, and `err instanceof Error ? ...` (:64, :108) wraps fetch and parse errors that are already `Error`s. Replacement, if the package stays: keep `protoUrl` only, use one `useState<Result>` set from the effect, and drop `useMemo`, `fetched.url === protoUrl` and `source`. Effect: behavior-preserving for aid; breaks the package's public options. Callers touched: `packages/proto-ui/src/components/ProtoReference.tsx`, `packages/proto-ui/src/index.ts`.

- `packages/proto-ui/src/components/ProtoReference.tsx:33-39, 64-96` [rung 1/7] The `idle` branch is unreachable, because `ProtoSource` (:14-17) has no "none supplied" arm. `ProtoReferenceContent` is a single-use component, split off only to receive already-computed props. The three state branches each repeat `<div className={rootClass}>`. Replacement: one `<div className={rootClass}>` wrapping a conditional child, with the content inlined. `className`, `fileSourceUrl` and `baseHref` are never passed by aid (`proto-entry.ts:19`). Effect: behavior-preserving. Callers touched: none.

- `packages/proto-ui/src/components/ViewSource.tsx:7-25` [rung 4] A `useState` toggle with `aria-expanded` rebuilds `<details>`. Replacement: `<details className="proto-view-source"><summary>View source</summary><pre><code>{declaration}</code></pre></details>`. Effect: small behavior change; the label no longer switches to "Hide source", though CSS `details[open] summary` can restore that. Native keyboard support and expanded-state reporting are kept. Callers touched: `packages/proto-ui/src/tailwind-entry.css:293-310`.

- `packages/proto-ui/src/components/EntityHeader.tsx:11-16, 19-32` [rung 1/4] `KIND_LABEL` maps each kind to itself; use `{kind}`. The `typeof window === "undefined"` check is dead inside an onClick handler, and `useCallback` and `useState` exist only for the "copied" tick. Replacement: `<a className="proto-entity-copy" href={`#${fqn}`} aria-label="Link to this entity">#</a>`, matching aid's own heading anchors (`aid-heading-link`). Effect: behavior change; clicking now navigates instead of copying to the clipboard. Callers touched: none.

- `packages/proto-ui/src/components/Sidebar.tsx:8-58` [rung 7] Three copy-pasted group blocks plus two single-use subcomponents. Replacement:

  ```tsx
  ([["Services", ast.services], ["Messages", ast.messages], ["Enums", ast.enums]] as const)
    .filter(([, xs]) => xs.length)
    .map(([label, xs]) => <div className="proto-sidebar-group"><h3 ...>{label}</h3><ul ...>{xs.map(x => <li ...><a href={`${baseHref}#${x.fqn}`} title={x.fqn}>{x.name}</a></li>)}</ul></div>)
  ```

  Effect: behavior-preserving. Callers touched: none.

- `packages/proto-ui/src/components/FileSourceLink.tsx:1-10`, `PackageHeader.tsx:7, 21` [rung 1] This wrapper is used once, its `label` prop is never passed, and aid never supplies `fileSourceUrl`. Replacement: inline the `<a>` into `PackageHeader`, or delete the whole `fileSourceUrl` path. Effect: behavior-preserving. Callers touched: `ProtoReference.tsx`.

- `packages/proto-ui/src/components/MessageBlock.tsx:12-13, 16-19, 75-79` and `print-proto.ts:31-36, 46` [rung 2/6] The `depth` prop only feeds an unused `data-depth` attribute; no CSS reads it, and despite its comment it does not set the heading level. `fieldsExcludingOneOfs` and `printMessage` each build a name Set that equals `f.oneofName`, and the logic is duplicated across the two files. Replacement: `m.fields.filter(f => !f.oneofName)`. For oneof members use `m.fields.filter(f => f.oneofName === o.name)` instead of `fieldNames.find`; that also leaves `ProtoOneOf.fieldNames` unused. Effect: behavior-preserving (field names are unique within a message). Callers touched: `parser.ts:198` if `fieldNames` is dropped.

- `packages/proto-ui/src/components/print-proto.ts:11-22` [rung 6] `rulePrefix` is 12 lines. Replacement: `f.rule === "singular" ? "" :`${f.rule} ``. Effect: behavior-preserving. Callers touched: none.

- `packages/proto-ui/src/components/TypeRef.tsx:10-17` [rung 6] Replacement: `const slug = /^\.?google\.protobuf\.(\w+)$/.exec(reference.raw)?.[1]?.toLowerCase()`. Effect: behavior-preserving. Callers touched: none.

- `packages/proto-ui/src/components/DocBlock.tsx:10-15` [needless hook] The `useMemo` around `marked.parse` does nothing useful on a static document, and under server rendering it disappears. Effect: behavior-preserving. Callers touched: none.

- `packages/proto-ui/src/parser.ts:180-181` [rung 5] `isDescendable` is a duck-typing guard. Replacement: `child instanceof protobuf.Namespace`. `Type` and `Service` are already handled earlier in the chain. Effect: behavior-preserving. Callers touched: none.

- `packages/proto-ui/src/parser.ts:300, 325-331` [rung 6] `syntax === "proto3" &&` is redundant, because `isProto3Optional` already implies proto3. `optionFlag` can be one line: `options?.[name] === true || options?.[name] === "true"`. The string `"true"` comparison is probably dead, since protobufjs parses option booleans; I did not verify this. Effect: behavior-preserving. Callers touched: none.

- `packages/proto-ui/src/hydrate.tsx:5` [type with one implementation] `CreateProtoReferenceOptions` is just another name for `ProtoReferenceProps`. Replacement: use `ProtoReferenceProps` directly. The returned unmount function (:19) is ignored by the only caller. Effect: behavior-preserving. Callers touched: none.

- `packages/proto-ui/src/index.ts:1-20`, `package.json:8-12, 18-22`, `scripts/build.ts:54-71, 114-116, 120` [rung 1] Nothing in the repo imports the `"."` entry, and the package is not published. `dist/parser.js` is never loaded either: aid resolves `./parser` through the `"bun"` condition to `src/parser.ts`. I confirmed with `Bun.build` metafile that the browser build resolves `dist/hydrate.js`. Separately, `bundleParser` duplicates `bundleEntry` apart from `target` and `external`. Replacement: drop the `bundle index.js` and `bundle parser.js` steps and the `"."` and `./parser` `import` targets. If any step stays, give `bundleEntry` a `target` parameter. Effect: behavior-preserving in-repo; drops non-Bun package consumers. Callers touched: `packages/proto-ui/package.json`.

- `packages/proto-ui/scripts/build.ts:12-21, 96-109` [rung 3/7] An IIFE resolves the tsgo native binary per platform, and `emitTypes` hand-pipes stdout and stderr. Replacement: `await Bun.$`bun x tsgo --emitDeclarationOnly --outDir dist --project .`.cwd(PACKAGE_ROOT)`. `Bun.$` throws with stderr on a non-zero exit. Effect: behavior-preserving, at the cost of the Node shim's startup time. Callers touched: none.

- `packages/proto-ui/src/tailwind-entry.css:1, 11-24` plus `src/theme/main.css:105-113` [rung 2] proto-ui runs its own `@import "tailwindcss"`, so proto pages load preflight and the base theme twice. Its `--proto-*` defaults repeat aid's token values exactly, and `main.css` then bridges them back to the aid tokens. With proto rendered on the server (first finding), the proto component styles can join aid's compile and use the `aid-*` tokens directly; that removes the bridge, the duplicate tokens and `compileStyles`. `.proto-root` (:26-29) also nests a second `16rem 1fr` grid inside `.aid-shell`'s grid. Effect: behavior change (one stylesheet, one sidebar column). Callers touched: `src/core/web-bundle.ts`, `scripts/bundle-web.ts`, `src/theme/main.css`.

- `src/theme/components/SearchBox.tsx:2, 7, 21-23` [rung 1] Search has two off-switches. `Header.tsx:18` skips SearchBox when `search` is undefined, and SearchBox also returns null when `indexHref` is undefined, but `pipeline.ts:186` always sets `indexHref`. `SearchBoxWeights` is used once. Replacement: make `indexHref: string` required, delete the early return, and inline `Record<string, number>`. Effect: behavior-preserving. Callers touched: none.

- `src/web/openapi-entry.ts:16-22` and `src/theme/components/PageOpenAPI.tsx:21` [over-defensive on internal data, dead attribute] The renderer always emits the spec script, so the empty-text and `?? ""` guards protect nothing. `data-spec-source="#aid-openapi-spec"` is never read; the entry uses `getElementById`. Replacement: `createApiReference(mount, { content: JSON.parse(specEl.textContent!), ... })` behind one `if (!mount || !specEl) return`, and drop the attribute. Keep `escapeScriptJson`, which is XSS protection. Effect: behavior-preserving. Callers touched: none.

- `src/web/proto-entry.ts:15-18` [rung 6] Replacement: `const protoUrl = mount.dataset.protoUrl`. Effect: behavior-preserving. Callers touched: none. This finding goes away if the first finding is adopted.

## Cross-slice

- Search field config is duplicated. `src/core/search-index.ts:16-22` (`SEARCH_FIELDS`, `SEARCH_STORE_FIELDS`, `SEARCH_FIELD_BOOST`) is copied as literals in `src/web/search.ts:105-108`, so the two can drift silently. Move the constants into a dependency-free module, for example `src/search/fields.ts`, and import it from both; `search-index.ts` imports `node:path`, so the browser should not import it directly.
- `src/search/runtime.ts` (a dead `attachSearch` stub that duplicates `src/web/search.ts`), `src/search/emit.ts` (a dead `emitSearchIndex` stub) and `src/core/ai-targets.ts` (`buildAiButtons`, a dead stub) are never imported. Delete them. Check `src/search/tokenize.ts` the same way; nothing imports it either.
- `src/core/search-index.ts:27-28, 44` filters proto pages out "defensively until a proto renderer exists". The renderer exists, so `src/renderers/proto/index.ts:73-154` (`extractSearchTokens`) computes tokens that are thrown away. Either index proto pages, which the product docs promise, or delete the extractor.
- `"index"` in `PageKind` (`src/core/types.ts:6`) is never produced. The filter at `search-index.ts:44` and `PageIndex` exist only for it.
- The xxHash64 8-character filename hash is copied four times: `src/core/css-writer.ts:26`, `search-index.ts:56`, `web-bundle.ts:151,158`. `writeEmbedded` and `writeEmbeddedCss` (`web-bundle.ts:150-162`) are identical apart from the file extension. Use one `hashName(name, ext, source)` helper.
- `packages/proto-ui/scripts/build.ts:73-94` `compileStyles` repeats `src/core/tailwind.ts:72-88` (`compile` plus `customCssResolver` plus `Scanner`).
- `scripts/bundle-web.ts:105-120` rebuilds proto-ui "defensively", on top of the `mise.toml:8` postinstall that already does it.
- `scripts/bundle-web.ts:61-66` bundles without `splitting`. In the release binary, `search.ts`'s `import("minisearch")` is therefore inlined: the measured base bundle is 21.6 KB minified, 7.4 KB gzip. The lazy import only pays off in dev builds.
- `marked` (a proto-ui dependency) is a second markdown parser. aid already ships `remark-parse`, `remark-rehype` and `rehype-stringify`. If proto rendering moves to the server, proto comments can go through the existing pipeline and `marked` can go.
- I found no duplication between `packages/proto-ui/src/parser.ts` and `src/lint/proto.ts` or `src/fmt/proto.ts`; both use the `buf` binary and never parse the AST. `src/renderers/proto/index.ts` consumes `parseProto` and does not re-implement it.
- No test covers proto rendering, `src/web/*` behavior, or the proto-ui package. The first finding has no safety net either way.

## Not worth it

- `src/web/_bundled.ts`: the empty-placeholder-plus-codegen setup is the simplest way to embed bundles in `bun build --compile`.
- `src/theme/components/Footer.tsx` and `Header.tsx` could be inlined into `Layout`, but they are the natural override points if user partials ever land.
- `DeprecatedBadge.tsx` is a one-line component used in two places; fine.
- `EnumBlock.tsx:35-40` uses a fragment around a space and the badge; cosmetic.
- `findPackageLeadingComment` (`parser.ts:347-373`): protobufjs does not expose package comments, so the custom scan is needed.
- `detectSyntax` (`parser.ts:333-345`): protobufjs v8's `IParserResult` has no `syntax` field, and `hasPresence` would mislabel proto3 message fields as optional, so the regex stays.
- The `run()` timing wrapper in `build.ts:23-33` is small and useful.
- `search.ts` debounce (80 ms): harmless.
- The `print-proto.ts` `indent` helper is fine as is.
- `PageOpenAPI` `escapeScriptJson`, `DocBlock`'s trusted-HTML injection note, and the ARIA attributes in SearchBox and the search code are security and accessibility measures, and stay as they are.
