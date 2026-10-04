# Ponytail cleanup: slice D (tests/**)

Source: ponytail full-intensity audit. Every item preserves coverage unless marked otherwise.

## Findings (sorted by impact)

1. **Shared `buildContext(config, cwd)`.**
   - 11 test files each hand-roll `makeCtx`. The same `contentDir`, `outputDir`, `staticDir` and `templatesDir` derivation is also copied into `src/cli/commands/build.ts:33-40` and `dev.ts:41-48`.
   - Export one `buildContext(config, cwd): BuildContext` from `src/core/config.ts`, using the `templates === "" ? null : ...` rule, and call it everywhere.
   - Cross-slice: slice A owns the `src/` side. Land it first, then switch the tests.
2. **Merge the prose-only bundle tests.**
   - `mermaid-split.test.ts:33` and `openapi-split.test.ts:47` each do a full `build()` of the same prose site.
   - Merge them into one test and one build, asserting there is no `aid-mermaid.*`, no `aid-openapi.*`, and exactly one `aid-web.*.js`. Optionally merge both files into `tests/integration/bundle-split.test.ts`.
3. **Simplify `makeCtx` overrides.**
   - In `search-index.test.ts:26-57`, the `typoTolerance` and `weights` overrides are never passed. Replace the helper with `makeCtx(raw = {}) => AidConfigSchema.parse({ name, ...raw })`.
   - Do the same in `llms-txt.test.ts:19-47`.
4. **`search-index.test.ts` boilerplate.**
   - The `if (!result) throw` guard repeats 5 times and the `Object.values(storedFields)[0] as` cast 3 times.
   - Replace them with one `storedDocs(ctx, pages)` helper that absorbs `extractIndex`.
5. **Drop the MiniSearch cast.**
   - The `(MiniSearch as unknown as {loadJSON})` cast in `search-index.test.ts:244-256` and `build.test.ts:204-215` is not needed: MiniSearch 7 types `loadJSON`.
   - Use `MiniSearch.loadJSON(payload, { fields: [...SEARCH_FIELDS], storeFields: [...SEARCH_STORE_FIELDS] })`, importing the constants from `src/core/search-index.ts`.
6. **`config-resolve.test.ts` temp dirs.** Its 6 tests use try/finally temp dirs. Switch to `beforeEach`/`afterEach` like `fmt.test.ts` and `lint.test.ts` (about 30 fewer lines).
7. **Unused fixtures.** `tests/fixtures/lint-fixtures/clean/` and `dirty-md/` have no references. `git rm` them.
8. **Hoist `renderFixture`.** `openapi.test.ts:80-84` and `:142-146` define the same `renderFixture`. Move one copy to module scope.
9. **Duplicate outputDir test.** `css-writer.test.ts:81-87` repeats `:36-44`, because its `rm` is a no-op. Delete it.
10. **Merge duplicate markdown tests.** `markdown.test.ts:237-249` repeats `:167-181`. Move the `.md` export assertions into `:167` and delete `:237`.
11. **Redundant double calls.** In `router.test.ts:62-63, :94-95` and `html.test.ts:102-103`, combine each pair into one `rejects.toThrow(/route collision.*\/products/)`-style regex.
12. **`openapi-split.test.ts:74-77`.** The markup assertions repeat the unit tests. Drop them and keep only the presence or absence of the bundle.
13. **`openapi-split.test.ts:80-100`.** The Swagger 2.0 upgrade check runs a full build. Move it to `openapi.test.ts` against the existing Swagger fixture.
14. **`tailwind.test.ts:94-98`.** It asserts only `Array.isArray(dependencies)`. Replace it with an assertion that `dependencies` contains `extra.css` in the `@import` test, but run it first to confirm Tailwind reports it. If it does not, delete the test.
15. **Over-built `makeCtx` in tailwind and css-writer tests.**
    - `tailwind.test.ts:19-36`: `makeCtx` is async with nothing to await, its `stylesheet` override is never passed, and it re-passes defaults. Make it sync, or use `buildContext`.
    - `css-writer.test.ts:19-33`: the same treatment.
16. **Duplicate search-index tests.** `search-index.test.ts:118-124, :146-156` are implied by the other tests. Delete them.
17. **Dead sort.** `build.test.ts:198`: the `.sort()` result is never compared. Drop it.
18. **Fixture defaults.** `tests/fixtures/sample-site/aid.yaml` restates the schema defaults. Keep `name`, `description`, `version` and `dev.port`, and drop the rest.
19. **Misleading test name.** `html.test.ts:160`: rename the test to match its body.

## Not worth it

- A shared `useTempDir()`: each copy is 3 lines and readable. Add it only if `tests/helpers.ts` exists anyway.
- `writeMd`, `write` and `stubHtml` are reused 6 to 11 times. Keep them.
- The `copyAsset` spies are the cheapest real check on an injected dependency.
- `test.each` for sniff and dark-mode would hurt failure readability.
- The hard-coded-literal asserts in html and openapi tests are cheap. Leave them.
- The big `build.test.ts` overlaps unit tests, but the project prefers integration tests. Keep it.
- `events.proto` is used. The missing assertion on its output is a coverage gap, not over-engineering.
