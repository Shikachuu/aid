# Research: a CSS linter for aid

_Date: 2026-11-03. Measurements were taken on darwin-arm64 with Bun 1.4.4, Tailwind 4.3.4, lightningcss as pinned in aid, and Stylelint 18.0.0._

## Problem statement

[RESEARCH_lint_format.md](./RESEARCH_lint_format.md) recommends replacing Biome with `bun fmt` and `bun lint`. Neither Bun tool lints CSS, so `aid lint` would lose the CSS checks Biome gives today. This brief looks for a replacement: Tailwind's own tooling, or a general CSS linter.

## Constraints

- The CSS in an aid project is mostly the `stylesheet` entry (for example `site/main.css`) and theme CSS. It is Tailwind 4 CSS, with `@theme`, `@apply`, `@utility`, `@variant`, `@custom-variant`, `@source`, and `--theme()` or `--spacing()` values.
- The linter must work inside the `bun build --compile` binary, with nothing for the user to install.
- aid already embeds the Tailwind compiler (`@tailwindcss/node`), the oxide scanner, and lightningcss. Reusing them adds 0 MB.
- Every finding must map to aid's `Diagnostic` type: file, line, column, severity, code, and message.

## Tailwind has no standalone linter

Tailwind Labs ships its checks only inside the IntelliSense language server (`@tailwindcss/language-server` 0.16.0, 10.3 MB, LSP only). The community CLIs `tailwind-lint`, `twlinter`, `oxlint-tailwindcss`, and `eslint-plugin-better-tailwindcss` wrap the same engine. They call the Tailwind design system that `tailwindcss` exports as `__unstable__loadDesignSystem`. aid already bundles that function, so it doesn't need any of these packages.

## Options

### Option 1: Tailwind's design system and compiler (in-house, 0 MB)

- **What it is.** aid calls APIs it already ships. `compile()` throws on Tailwind errors. The design system exposes `candidatesToCss` (it returns `null` for an unknown class), `canonicalizeCandidates`, and `getClassOrder`. The oxide `Scanner` has `getCandidatesWithPositions` for finding classes in content.
- **Tested.** These checks ran against a stylesheet with the aid theme token `--color-aid-accent`.

  | Input | Result |
  | --- | --- |
  | `@apply px-4 pyy-2` | Error: "Cannot apply unknown utility class `pyy-2`" |
  | `@variant hoverr` | Error: "Cannot use `@variant` with unknown variant: hoverr" |
  | `--theme(--color-nope)` | Error: "Could not resolve value for theme function" |
  | `@utility foo bar` | Error: "defines an invalid utility name" |
  | `pyy-2`, `bg-aid-acent`, `hoverr:underline` | `candidatesToCss` returned `null` for each one |
  | `[color:red]`, `w-[100%]`, `!p-4` | Canonical forms: `text-[red]`, `w-full`, `p-4!` |
  | `@tailwnd base;`, `colr: red`, duplicate `color` | No error |

- **Strengths.** It finds the mistakes a generic CSS linter cannot. Every class and variant is checked against the user's real theme. The canonical-class check is the same check IntelliSense runs.
- **Weaknesses.** It is not a CSS linter: it misses unknown properties, invalid values, bad selectors, and unknown at-rules. `compile()` errors carry a message but no line or column, so aid must locate the offending token in the source itself. The scanner picks up prose words as class candidates. In a markdown test it returned `prose`, `about`, `layouts`, `the`, and `class` next to the real classes. An unknown-class check is only reliable inside `class` and `className` attributes. The design-system function's `__unstable__` prefix means Tailwind may change it in a minor release.

### Option 2: lightningcss warnings and visitor rules (in-house, 0 MB)

- **What it is.** `transform({ errorRecovery: true })` returns parse warnings with line and column. Its `visitor` option walks rules and declarations, so aid could write its own rules.
- **Tested, warnings.** Warnings caught an invalid pseudo-class (`:hovr`), a dangling combinator (`a > > b`), an unexpected token (`!importnt`), and unknown at-rules. Every Tailwind directive (`@theme`, `@utility`, `@custom-variant`, `@apply`) also came back as "Unknown at rule", so aid would need an allowlist. Warnings missed `colr: red`, `width: 10pxx`, `display: flexx`, duplicate declarations, and `min-widht` in a media query.
- **Tested, visitor.** A 20-line visitor found the unknown property (`colr`), the duplicate `color`, and the invalid values `10pxx` and `flexx`. lightningcss also marks valid values it can't parse as unparsed: `var(--m)`, `--theme(...)`, `--spacing(4)`, and `grid-template-areas`. So an invalid-value rule must skip values that contain functions or variables. Media feature names arrive as plain strings, so `min-widht` needs aid's own list of known features.
- **Strengths.** No new dependency, native speed, and positions for parse warnings.
- **Weaknesses.** aid would write, test, and maintain every rule and every known-name list itself. I didn't find declaration-level positions in the visitor output, only rule-level ones. Users get no config format they already know.

### Option 3: Stylelint (+2 MB)

- **What it is.** The standard CSS linter: 13.9 million npm downloads in the last week, 11.5k GitHub stars, MIT. Version 18.0.0 shipped on 2026-11-03, and 17.16.0 on 2026-10-01. It is pure JS on PostCSS and css-tree, with 33 packages and 9.2 MB in `node_modules` including `stylelint-config-standard`. `stylelint-config-recommended` has 46 rules, all correctness checks.
- **Tested in the compiled binary.** A plain `bun build --compile` failed at runtime twice. Two `Bun.build` plugins fixed it:
  1. Stylelint loads rules with ``import(`./${ruleName}/index.mjs`)``. A plugin rewrites `lib/rules/index.mjs` into a static table of `() => import("./<rule>/index.mjs")` entries.
  2. css-tree loads its JSON data through `createRequire`. A plugin rewrites the `require` calls in `css-tree/lib/data.js`, `data-patch.js`, and `version.js` into static imports.

  The binary was 87 MB, against 85 MB for an empty Bun binary. Once both plugins were in, a lint call took 33 ms. On the test file it reported `property-no-unknown` (`colr`), `declaration-block-no-duplicate-properties`, `declaration-property-value-no-unknown` (`10pxx`, `flexx`), `selector-pseudo-class-no-unknown` (`:hovr`), `media-feature-name-no-unknown` (`min-widht`), and `named-grid-areas-no-invalid`, each with line and column.
- **Tested on aid's own CSS.** I ran the recommended preset on `src/theme/main.css`, `packages/proto-ui/src/tailwind-entry.css`, and `site/main.css`. Tailwind needs `ignoreAtRules` on two rules, `at-rule-no-unknown` and `at-rule-prelude-no-invalid`. Without the second one, every `@apply` line was flagged, 95 times across the theme files. With both ignores, one finding remained: a duplicate `.proto-root` selector in `tailwind-entry.css`, which is a real duplicate. `stylelint-config-standard` adds stylistic rules such as `hue-degree-notation` and `declaration-empty-line-before`. Those rules overlap with the formatter and produced 62 more findings.
- **Strengths.** It covers what Biome's CSS lint covers, it is well tested, and it has a config format users already know (`.stylelintrc*`). Its diagnostics map directly onto aid's `Diagnostic` type.
- **Weaknesses.** It has no Tailwind awareness beyond the at-rule ignores. The two build plugins depend on Stylelint and css-tree internals, so a bump can break the compile. `bun run build` would catch that, because the binary fails at its first lint call. Version 18.0.0 is one day old.
- **Gotchas.** I did not test Stylelint's own config loading (cosmiconfig and `import-meta-resolve`) inside the binary. aid should parse `.stylelintrc*` itself through `src/lint/config-resolve.ts` and pass the result as `config`, as it does for the other tools. It should resolve `extends: "stylelint-config-recommended"` to its bundled copy. Other `extends` entries and plugins would need the user's `node_modules`, the same limit `bun lint` has.

### Option 4: young Rust CSS linters

- **Gale** (`gale-lint` 0.1.5 on crates.io, `@lyricalstring/gale` on npm, MIT). It claims to replace Stylelint with 250+ rules, and its `gale:recommended` preset has 29 rules. It is CLI and LSP only, with no library API and no Tailwind support. Its npm package downloads a platform binary on install. The fork I could reach has 0 stars.
- **csskit** (0.0.36, 331 stars, 1,437 npm downloads in the last week). Its own docs say "alpha software - great for experimenting but may have bugs in production." It ships one native package per platform.
- **Fit.** Either one adds a fifth native binary family to `scripts/natives.ts`. Both are too young to be the default linter for a tool other people depend on.

## Comparison

| Criterion | Option 1: Tailwind engine | Option 2: lightningcss visitor | Option 3: Stylelint | Option 4: Gale or csskit |
| --- | --- | --- | --- | --- |
| Binary size change | 0 MB | 0 MB | +2 MB, measured | One native binary per target |
| Works in the compiled binary | Yes, already used by `aid build` | Yes, already used by `aid build` | Yes, after two build plugins (tested) | Not tested |
| Unknown properties, invalid values, duplicates | No | Yes, rules written by aid | Yes | Yes, as claimed |
| Bad selectors, unknown media features | No | Selectors yes; media features need aid's own list | Yes | Yes, as claimed |
| Tailwind errors (`@apply`, `@variant`, `--theme()`, unknown classes) | Yes | No | No | No |
| Canonical class suggestions | Yes | No | No | No |
| Line and column | Classes yes; `compile()` errors no | Rule level | Yes | Yes |
| Config users know | None | None | `.stylelintrc*` | `.stylelintrc*` (Gale) |
| Maturity | Tailwind 4 core, `__unstable__` API | Stable, but aid owns the rules | 11.5k stars, 13.9M weekly downloads | 0.x alpha |

Options 1 and 3 cover different mistakes, and neither covers what the other catches. Stylelint catches CSS mistakes and is blind to Tailwind. The Tailwind engine catches Tailwind mistakes and is blind to plain CSS. Option 2 could cover the CSS side for 0 MB, but aid would rebuild a small Stylelint by hand to save 2 MB.

## Recommendation

Combine Options 1 and 3 into one CSS tool in `aid lint`.

1. Run Stylelint with `stylelint-config-recommended` on discovered `.css` files. Add `ignoreAtRules` for Tailwind's directives on both `at-rule-no-unknown` and `at-rule-prelude-no-invalid`. Leave out `stylelint-config-standard`, because the formatter owns style. Ship the two build plugins in `scripts/compile.ts`, next to the existing `jsonc-parser` redirect.
2. Run Tailwind's `compile()` on the configured `stylesheet` and report its errors as diagnostics. aid finds the line by searching the source for the token named in the message.
3. As a second step, check classes inside `class` and `className` attributes in templates and HTML content. Report unknown classes with `candidatesToCss` and non-canonical classes with `canonicalizeCandidates`. Leave markdown prose out, because the scanner reports prose words as candidates.

Adding `stylelint` and `stylelint-config-recommended` is a dependency change and needs approval first. Pin 17.16.0 or wait for an 18.0.x patch release; 18.0.0 is one day old.

## Open questions

- Should a user's `.stylelintrc*` replace the bundled preset, the way `biome.json` replaces Biome's default today? Or should it merge with the preset, so the Tailwind ignores stay?
- What severity should a non-canonical class get? A `warn` fits, because `w-[100%]` renders correctly.
- Does aid have rehype parse the HTML before it checks classes? Or does it scan `class` attributes with a regex in `.tsx` templates, where no HTML parser runs?
- `__unstable__loadDesignSystem` may change in a Tailwind minor release. A unit test that calls it would catch a break when Tailwind is bumped.

## Sources

- [Stylelint repository](https://github.com/stylelint/stylelint)
- [Gale README on docs.rs](https://docs.rs/crate/gale-lint/latest/source/README.md)
- [csskit docs](https://csskit.rs/docs/)
- [tailwind-lint (IntelliSense-based CLI)](https://github.com/ph1p/tailwind-lint)
- [twlint](https://github.com/tinyfroggy/twlint)
- [oxlint-tailwindcss on npm](https://www.npmjs.com/package/oxlint-tailwindcss)
- [tailwindcss-intellisense PR adding the canonical-class diagnostic](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1475/files)
- [SonarSource thread listing Tailwind 4 at-rules that need ignoring](https://community.sonarsource.com/t/tailwind-css-v4-upgrade-s4662-false-positive-on-at-theme/136245)
- npm registry metadata and download counts, and GitHub API stats, fetched 2026-11-03
- Local measurements: Tailwind `compile()` and design-system tests, a lightningcss warning and visitor prototype, a Stylelint compiled-binary test, and Stylelint runs on aid's theme CSS
