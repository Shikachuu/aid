---
title: Lint and format defaults
description: Files each aid lint and aid fmt tool scans, the config files it looks for, and its bundled defaults.
sidebar:
  order: 4
---

`aid lint` dispatches to five tools and `aid fmt` to four: `css` only lints. Each tool except `css` looks for its own config file, starting in the target directory and walking up until it reaches a directory that holds `.git`. Without one, the bundled default below applies. `aid lint` leaves CSS files to `css`, so `bun` only formats them.

| Tool | Files | Config files |
| --- | --- | --- |
| `md` | `**/*.md`, `**/*.markdown` | `.markdownlint.json`, `.markdownlint.jsonc`, `.markdownlint.yaml`, `.markdownlint.yml` |
| `openapi` | `**/openapi.{yaml,yml,json}`, `**/*.openapi.{yaml,yml,json}`, `**/openapi/**/*.{yaml,yml,json}` | `.spectral.yaml`, `.spectral.yml`, `.spectral.json` |
| `bun` | `**/*.{ts,tsx,js,jsx,mjs,cjs,json,jsonc,css}` | `eslint.config.js`, `eslint.config.mjs`, `eslint.config.cjs`, `eslint.config.ts`, `eslint.config.mts`, `eslint.config.cts`, `.eslintrc`, `.eslintrc.json`, `.eslintrc.js`, `.eslintrc.cjs`, `.eslintrc.yaml`, `.eslintrc.yml`, `.oxlintrc.json`, `.prettierrc`, `.prettierrc.json`, `.prettierrc.json5`, `.prettierrc.yaml`, `.prettierrc.yml`, `.prettierrc.toml`, `.prettierrc.js`, `.prettierrc.cjs`, `.prettierrc.mjs`, `.prettierrc.ts`, `prettier.config.js`, `prettier.config.cjs`, `prettier.config.mjs`, `prettier.config.ts`, `.oxfmtrc.json`, `.oxfmtrc.jsonc`, `oxfmt.config.ts`, `oxfmt.config.mts`, `bunfig.toml` |
| `css` | `**/*.css` | None |
| `proto` | `**/*.proto` | `buf.yaml` |

Discovery never walks into these directories: `node_modules`, `dist`, `.bun`, `.git`, `.turbo`, `build`, `coverage`, `.next`, `.cache`, `.vercel`, `.aid`.

## markdownlint default (`md`)

```json
{
  "default": true,
  "MD010": {
    "code_blocks": false
  },
  "MD013": false,
  "MD024": {
    "siblings_only": true
  },
  "MD041": false
}
```

## Spectral default (`openapi`)

The bundled ruleset is `spectral:oas`.

## bun default (`bun`)

Without a lint config, `aid lint` turns off every `bun lint` rule category and runs only these rules. Without a formatter config, `aid fmt` passes these `bun fmt` options:

```toml
printWidth = 100
semi = false
```

| Rule | Severity | Options |
| --- | --- | --- |
| `@next/next/google-font-display` | warn | None |
| `@typescript-eslint/adjacent-overload-signatures` | warn | None |
| `@typescript-eslint/ban-ts-comment` | warn | `[{"ts-ignore":true,"ts-expect-error":false,"ts-nocheck":false,"ts-check":false}]` |
| `@typescript-eslint/ban-types` | warn | None |
| `@typescript-eslint/consistent-type-imports` | warn | `[{"disallowTypeAnnotations":false}]` |
| `@typescript-eslint/no-duplicate-enum-values` | warn | None |
| `@typescript-eslint/no-empty-interface` | error | None |
| `@typescript-eslint/no-explicit-any` | warn | None |
| `@typescript-eslint/no-extra-non-null-assertion` | warn | None |
| `@typescript-eslint/no-extraneous-class` | warn | None |
| `@typescript-eslint/no-invalid-void-type` | warn | None |
| `@typescript-eslint/no-misused-new` | error | None |
| `@typescript-eslint/no-non-null-asserted-optional-chain` | error | None |
| `@typescript-eslint/no-non-null-assertion` | warn | None |
| `@typescript-eslint/no-this-alias` | warn | None |
| `@typescript-eslint/no-unnecessary-type-constraint` | warn | None |
| `@typescript-eslint/no-unsafe-declaration-merging` | error | None |
| `@typescript-eslint/no-useless-empty-export` | warn | None |
| `@typescript-eslint/prefer-function-type` | warn | None |
| `@typescript-eslint/prefer-literal-enum-member` | warn | None |
| `@typescript-eslint/prefer-namespace-keyword` | error | None |
| `@typescript-eslint/prefer-optional-chain` | warn | None |
| `array-callback-return` | error | None |
| `bun:test/no-disabled-tests` | off | None |
| `bun:test/no-export` | off | None |
| `bun:test/no-focused-tests` | off | None |
| `bun:test/valid-describe-callback` | off | None |
| `bun:test/valid-expect` | off | None |
| `bun:test/valid-expect-in-promise` | off | None |
| `constructor-super` | error | None |
| `default-case-last` | warn | None |
| `dot-notation` | warn | None |
| `eqeqeq` | error | `["always",{"null":"ignore"}]` |
| `for-direction` | error | None |
| `getter-return` | error | None |
| `jsx-a11y/alt-text` | error | None |
| `jsx-a11y/anchor-ambiguous-text` | error | None |
| `jsx-a11y/anchor-has-content` | error | None |
| `jsx-a11y/anchor-is-valid` | error | None |
| `jsx-a11y/aria-activedescendant-has-tabindex` | error | None |
| `jsx-a11y/aria-props` | error | None |
| `jsx-a11y/aria-proptypes` | error | None |
| `jsx-a11y/aria-role` | error | None |
| `jsx-a11y/aria-unsupported-elements` | error | None |
| `jsx-a11y/autocomplete-valid` | error | None |
| `jsx-a11y/click-events-have-key-events` | error | None |
| `jsx-a11y/heading-has-content` | error | None |
| `jsx-a11y/html-has-lang` | error | None |
| `jsx-a11y/iframe-has-title` | error | None |
| `jsx-a11y/img-redundant-alt` | error | None |
| `jsx-a11y/interactive-supports-focus` | error | None |
| `jsx-a11y/label-has-associated-control` | error | None |
| `jsx-a11y/lang` | error | None |
| `jsx-a11y/media-has-caption` | error | None |
| `jsx-a11y/mouse-events-have-key-events` | error | None |
| `jsx-a11y/no-access-key` | error | None |
| `jsx-a11y/no-aria-hidden-on-focusable` | error | None |
| `jsx-a11y/no-autofocus` | error | None |
| `jsx-a11y/no-distracting-elements` | error | None |
| `jsx-a11y/no-interactive-element-to-noninteractive-role` | error | None |
| `jsx-a11y/no-noninteractive-element-to-interactive-role` | error | None |
| `jsx-a11y/no-noninteractive-tabindex` | error | None |
| `jsx-a11y/no-redundant-roles` | error | None |
| `jsx-a11y/no-static-element-interactions` | error | None |
| `jsx-a11y/prefer-tag-over-role` | error | None |
| `jsx-a11y/role-has-required-aria-props` | error | None |
| `jsx-a11y/role-supports-aria-props` | error | None |
| `jsx-a11y/scope` | error | None |
| `jsx-a11y/tabindex-no-positive` | error | None |
| `no-array-constructor` | warn | None |
| `no-async-promise-executor` | error | None |
| `no-case-declarations` | error | None |
| `no-class-assign` | error | None |
| `no-compare-neg-zero` | error | None |
| `no-cond-assign` | error | `["always"]` |
| `no-const-assign` | error | None |
| `no-constant-condition` | error | None |
| `no-constructor-return` | error | None |
| `no-control-regex` | error | None |
| `no-debugger` | error | None |
| `no-dupe-args` | error | None |
| `no-dupe-class-members` | error | None |
| `no-dupe-else-if` | error | None |
| `no-dupe-keys` | error | None |
| `no-duplicate-case` | error | None |
| `no-empty-character-class` | error | None |
| `no-empty-pattern` | error | None |
| `no-eval` | error | None |
| `no-ex-assign` | warn | None |
| `no-extra-boolean-cast` | warn | None |
| `no-extra-label` | warn | None |
| `no-fallthrough` | error | None |
| `no-func-assign` | error | None |
| `no-global-assign` | error | None |
| `no-import-assign` | error | None |
| `no-inner-declarations` | error | None |
| `no-irregular-whitespace` | warn | None |
| `no-label-var` | error | None |
| `no-labels` | warn | `[{"allowLoop":true,"allowSwitch":true}]` |
| `no-lone-blocks` | warn | None |
| `no-loss-of-precision` | error | None |
| `no-misleading-character-class` | error | None |
| `no-new-native-nonconstructor` | error | None |
| `no-nonoctal-decimal-escape` | error | None |
| `no-obj-calls` | error | None |
| `no-octal` | off | None |
| `no-octal-escape` | warn | None |
| `no-proto` | warn | None |
| `no-prototype-builtins` | warn | None |
| `no-redeclare` | error | None |
| `no-regex-spaces` | warn | None |
| `no-self-assign` | error | None |
| `no-self-compare` | error | None |
| `no-sequences` | warn | None |
| `no-setter-return` | error | None |
| `no-shadow-restricted-names` | error | None |
| `no-sparse-arrays` | error | None |
| `no-template-curly-in-string` | warn | None |
| `no-this-before-super` | error | None |
| `no-undef-init` | warn | None |
| `no-unneeded-ternary` | warn | None |
| `no-unreachable` | error | None |
| `no-unsafe-finally` | error | None |
| `no-unsafe-negation` | error | None |
| `no-unsafe-optional-chaining` | error | None |
| `no-unused-labels` | warn | None |
| `no-unused-private-class-members` | warn | None |
| `no-unused-vars` | warn | None |
| `no-use-before-define` | error | `[{"functions":false,"classes":false,"variables":false,"typedefs":false}]` |
| `no-useless-backreference` | warn | None |
| `no-useless-catch` | warn | None |
| `no-useless-constructor` | warn | None |
| `no-useless-escape` | warn | None |
| `no-useless-rename` | warn | None |
| `no-with` | error | None |
| `oxc/approx-constant` | warn | None |
| `oxc/bad-min-max-func` | error | None |
| `oxc/misrefactored-assign-op` | error | None |
| `oxc/no-accumulating-spread` | warn | None |
| `oxc/no-const-enum` | warn | None |
| `prefer-arrow-callback` | warn | None |
| `prefer-const` | warn | None |
| `prefer-exponentiation-operator` | warn | None |
| `prefer-numeric-literals` | warn | None |
| `prefer-regex-literals` | warn | None |
| `prefer-rest-params` | warn | None |
| `prefer-template` | warn | None |
| `radix` | warn | None |
| `react/button-has-type` | error | None |
| `react/jsx-no-comment-textnodes` | error | None |
| `react/jsx-no-duplicate-props` | error | None |
| `react/jsx-no-script-url` | error | None |
| `react/jsx-no-target-blank` | error | None |
| `react/jsx-no-useless-fragment` | warn | None |
| `react/jsx-uses-react` | off | None |
| `react/void-dom-elements-no-children` | error | None |
| `require-yield` | error | None |
| `unicorn/no-document-cookie` | warn | None |
| `unicorn/no-instanceof-array` | warn | None |
| `unicorn/no-thenable` | error | None |
| `unicorn/no-useless-switch-case` | warn | None |
| `unicorn/prefer-array-flat` | warn | None |
| `unicorn/prefer-array-flat-map` | warn | None |
| `unicorn/prefer-array-index-of` | warn | None |
| `unicorn/prefer-date-now` | warn | None |
| `unicorn/prefer-dom-node-text-content` | warn | None |
| `unicorn/prefer-math-min-max` | warn | None |
| `unicorn/prefer-node-protocol` | warn | None |
| `unicorn/prefer-number-properties` | warn | `[{"checkInfinity":false,"checkNaN":false}]` |
| `use-isnan` | error | None |
| `valid-typeof` | error | None |

## CSS checks (`css`)

The `css` tool has no config file and always runs these checks. Codes match the Stylelint rule with the same intent.

| Code | Severity | Reports |
| --- | --- | --- |
| `css-syntax-error` | error | CSS that lightningcss cannot parse, and comments or blocks that are never closed. |
| `at-rule-no-unknown` | error | At-rules that no CSS spec and no Tailwind directive defines. |
| `selector-no-invalid` | error | Selectors that do not parse. |
| `selector-pseudo-class-no-unknown` | error | Pseudo-classes that no CSS spec defines. |
| `selector-pseudo-element-no-unknown` | error | Pseudo-elements that no CSS spec defines. |
| `selector-type-no-unknown` | error | Type selectors that name no HTML, SVG, or MathML element. Custom elements pass. |
| `no-invalid-position-at-import-rule` | error | `@import` after any rule other than `@charset` or `@layer`. |
| `string-no-newline` | error | Strings that a newline cuts off. |
| `property-no-unknown` | error | Properties that no CSS spec defines. Custom and vendor-prefixed properties pass. |
| `declaration-property-value-no-unknown` | error | Values that do not parse for their property and use a keyword or unit that no CSS spec defines. |
| `custom-property-no-missing-var-function` | error | A custom property declared in the file and used as a value without `var()`. |
| `media-feature-name-no-unknown` | error | Media features that no CSS spec defines. |
| `at-rule-descriptor-no-unknown` | error | `@font-face` descriptors that no CSS spec defines. |
| `declaration-block-no-duplicate-properties` | warn | A property declared twice in one block. Two consecutive declarations with different kinds of value pass as a browser fallback, for example `#fff` then `oklch(...)`. |
| `declaration-block-no-duplicate-custom-properties` | warn | A custom property declared twice in one block. |
| `declaration-block-no-shorthand-property-overrides` | warn | A shorthand that resets a longhand declared before it in the same block. |
| `font-family-no-duplicate-names` | warn | A font family listed twice in one `font-family` or `font` value. |
| `font-family-no-missing-generic-family-keyword` | warn | A font family list without a generic family such as `sans-serif`. |
| `keyframe-block-no-duplicate-selectors` | warn | A keyframe selector used twice in one `@keyframes`. |
| `keyframe-declaration-no-important` | warn | `!important` inside `@keyframes`, which browsers ignore. |
| `no-duplicate-at-import-rules` | warn | The same `@import` twice. |
| `no-duplicate-selectors` | warn | The same selector list twice in one scope. |
| `block-no-empty` | warn | Style rules with an empty block. |
| `comment-no-empty` | warn | Empty comments. |
| `no-empty-source` | warn | Files that hold only whitespace. |
| `no-irregular-whitespace` | warn | Whitespace characters other than space, tab, and newline. |
| `tailwind` | error | The first error Tailwind reports when it compiles a stylesheet that imports `tailwindcss` or `aid/theme`: an unknown utility in `@apply`, an unknown variant, an unresolved `--theme()` value, or an invalid `@utility` name. |

## buf default (`proto`)

```yaml
version: v2
lint:
  use:
    - STANDARD
```
