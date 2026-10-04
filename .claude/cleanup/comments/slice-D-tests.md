# Comment cleanup: slice D (tests/**)

Source: comment-auditor, whole-tree audit. Verdict: REQUEST CHANGES. There are no suppressions in `tests/`, so the Correctness list is empty.

## Must kill

### tests/integration/build.test.ts

This file is one 190-line test that uses comments as section headers. The reshape is to split it into named `test(...)` cases: markdown body, shiki, mermaid bundle, static and colocated assets, CSS, OpenAPI, `.md` sidechain, HTML page, llms.txt, and search index. Shared setup moves into a `buildFixture()` helper in `beforeAll`. The comments are then unnecessary.

- :15-17 "Skip the fixture's `dist/` ..." -> delete. Extract the `cp` filter into a named predicate `isBuildOutputDir`.
- :52, :55, :57, :60, :65, :68, :73-74, :80, :82-83, :89-90, :92-94, :97-98, :101-103, :109, :112-113, :122-124, :136-138, :144, :146, :150, :152-153, :160-163, :175-178, :184-185, :188-189, :197, :202-203 -> delete. Each one narrates the assertion that follows it. Move the intent into the new test names.

### Other test files

- tests/integration/mermaid-split.test.ts:39 "No mermaid bundle output.", :41 "Base bundle is still present." -> delete.
- tests/integration/openapi-split.test.ts:89 "The embedded spec script should hold the upgraded 3.1 document." -> delete.
- tests/integration/colocated-nested.test.ts:49, :66, :80 -> delete.
- tests/integration/security.test.ts:35 "A 'secret' sibling outside contentDir.", :39 "Crucially, the secret was NOT copied" -> delete.
- tests/unit/fmt.test.ts:27 "second run produces no further changes" -> delete.
- tests/unit/tailwind.test.ts:90 "Bundled-only token must not appear." -> delete.
- tests/unit/llms-txt.test.ts:158 -> delete.
- tests/unit/renderers/markdown.test.ts:112, :144, :146, :247 -> delete.
- tests/unit/renderers/html.test.ts:115 -> delete.
- tests/unit/renderers/html.test.ts:161 -> delete. Rename the test at :160 to `"<meta name=description> without content leaves description undefined"`.
- tests/unit/renderers/openapi.test.ts:262-263, :265 -> delete. The test name already covers both.
- tests/unit/search-index.test.ts:89-93 JSDoc on the file-local `extractIndex` -> delete. Rename the helper to `parseSearchIndexScript`.
- tests/unit/search-index.test.ts:242-243 -> delete. Extract the `MiniSearch.loadJSON` cast, which is duplicated in `build.test.ts:204-215`, into a shared `loadSearchIndex(payload)` test helper.
- tests/fixtures/sample-site/main.css:5 "fixture override - confirm theme-token plumbing ..." -> delete.

## Nits

- tests/fixtures/sample-site/docs/events.proto:5 "used by the proto-renderer fixture tests" narrates the suite. Delete it.
- events.proto:7, :12, :18 are fixture data for proto doc-comment extraction, and no test asserts on them. Keep them.

## Kept

- tests/fixtures/sample-site/aid.yaml:1 is a yaml-language-server modeline, which is an external tool directive.
- events.proto:7, :12, :18 are fixture data.
