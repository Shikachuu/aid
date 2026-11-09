---
title: Testing
description: How aid's tests are laid out, which helpers and fixtures they share, and how to smoke-test the compiled binary.
llms: optional
sidebar:
  order: 5
---

aid uses the Bun test runner and nothing else. `.claude/rules/tests.md` forbids vitest, jest, and `node:test`. Test files end in `.test.ts`, and `bun test` finds them without configuration.

## Run the tests

```sh
bun test
bun test tests/integration/links.test.ts
bun test -t "broken"
```

The first command runs the whole suite. The second runs one file. The third runs the tests whose name matches the pattern. `bun run check` runs the suite together with the typecheck, the linters, and the drift checks. It does not run the browser tests; see [browser tests](#browser-tests).

## Layout

| Directory | Contents |
| --- | --- |
| `tests/unit` | One module per file: the router, config, search index, Tailwind compile, dark-mode derivation, the JSX runtime, lint, fmt, the dev watcher, `gen-docs`, and more. `tests/unit/renderers/` tests the markdown, HTML, and OpenAPI renderers directly. |
| `tests/integration` | Tests that write a small project to a temporary directory, run `build()` from `src/core/pipeline.ts`, and assert on the files in the output directory. |
| `tests/e2e` | Playwright browser tests. Plain `bun test` skips them. |
| `tests/fixtures` | Shared input projects. |
| `tests/helpers.ts` | Shared setup helpers. |

Integration tests create their project with `mkdtemp(path.join(tmpdir(), "aid-<name>-"))` in `beforeAll` and delete it in `afterAll`. They never build into the repository.

## Prefer integration tests

`.claude/rules/tests.md` asks for integration tests through the public entry points: the CLI and the public exports such as `build()` and `loadBuildContext()`. Unit-test an internal function only when an integration test cannot isolate the behavior. `tests/integration/broken-links.test.ts`, for example, writes pages with bad links, runs `build()`, and asserts on the single error that lists every problem.

## Helpers

`tests/helpers.ts` exports three functions:

- `makeCtx(cwd, raw)` parses `{ name: "Test Site", ...raw }` with `AidConfigSchema` and returns a `BuildContext` for `cwd`.
- `makeSite(cwd, raw)` writes a `main.css` with `@import "tailwindcss"` and `@import "aid/theme"` into `cwd`, then calls `makeCtx`.
- `parseSearchIndexScript(source)` checks that a `search-index.<hash>.js` body has the `window.__AID_SEARCH__=` prefix and a trailing `;`. It returns the stored documents and a `search(query)` function that loads the index into MiniSearch with the shared `SEARCH_OPTIONS`.

## Fixtures

`tests/fixtures/sample-site` is a full project with one page of every kind:

```text
tests/fixtures/sample-site/
  aid.yaml          name, description, dev.port 3001
  main.css          imports tailwindcss and aid/theme, sets --color-aid-accent
  docs/
    index.md        markdown with frontmatter, a colocated image, a note callout, a ts block, and a mermaid block
    hero.svg        the colocated image
    about.html      a full HTML document
    api.yaml        an OpenAPI spec
    events.proto    a Protobuf file
    user.json       a JSON Schema
  static/
    logo.svg        copied to the output root
```

`tests/integration/build.test.ts` copies it to a temporary directory, skipping any `dist/` folder, and builds it. `scripts/manual-test.ts` builds it with the compiled binary.

`tests/fixtures/lint-fixtures/with-user-md-config` holds an `index.md` and a `.markdownlint.json` that turns off MD012 and four other rules. `tests/unit/lint.test.ts` uses it to check that `aid lint` reads a project's own markdownlint config.

`tests/fixtures/lint-fixtures/openapi-bad-json` holds an `openapi.json` with an unterminated string. `.prettierignore` keeps `bun run fmt` away from it. `tests/integration/compiled-binary.test.ts` uses it.

`.claude/rules/tests.md` asks for new fixtures next to `sample-site`, not in a new top-level layout. Commit any snapshot file together with the test that produced it.

## Browser tests

`tests/e2e` drives the built site in headless Chromium through Playwright. Run it with:

```sh
bun run test:e2e
```

The script sets `AID_E2E=1`. Without it, `bun test` marks every e2e test as skipped and prints one line that names the script. The tests need the Chromium build that matches the installed `playwright` package. `bunx playwright install chromium` downloads it.

Each run copies `tests/fixtures/sample-site` to a temporary directory three times, with `base_path: /e2e` and `theme.dark_mode` set to `auto`, `manual`, or `off`. The `manual` copy appends explicit dark tokens to `main.css`. `tests/e2e/site.ts` builds each copy and serves it with `Bun.serve` on a free port.

| File | Checks |
| --- | --- |
| `pages.test.ts` | Every page kind renders at 1280x800 and 375x812, in light and dark color schemes, with no horizontal overflow and no uncaught page error. Search opens, and Enter goes to the top hit. Enter during IME composition does nothing. The sidebar is a closed `Menu` disclosure on a phone and an open nav on a desktop. |
| `dark-mode.test.ts` | For each `dark_mode` value, the page background, the Mermaid diagram, and the Scalar reference follow the OS scheme, except `off`, which stays light on a dark OS. |

Every test writes a full-page screenshot to `tests/e2e/__screenshots__/<dark_mode>-<page>-<viewport>-<scheme>.png`. Git ignores that directory. Look at the screenshots after a theme or layout change, and attach them to the pull request.

## Smoke-test the binary

`bun test` runs aid from source, with one exception. `tests/integration/compiled-binary.test.ts` compiles the host binary with `compileTarget` from `scripts/compile.ts`, runs `lint --filter openapi --format json` on the bad-JSON fixture with both the binary and the source CLI, and checks that the two outputs match. It skips on platforms without a release target.

To check the compiled binary end to end, run:

```sh
bun scripts/manual-test.ts
```

The script runs `bun run build`, then runs `dist/bin/aid-<os>-<arch>` for the host machine with `build` inside `tests/fixtures/sample-site`. It serves `tests/fixtures/sample-site/dist` on `http://localhost:3000/` until you stop it. The build writes its browser bundles to the gitignored `.aid-build/`, so it leaves tracked files alone, as [single binary](./single-binary.md) explains.
