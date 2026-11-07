---
title: Linting
description: How aid lint finds markdown, OpenAPI, JS and TS, CSS, and Protobuf files, runs five bundled tools over them, and reports the findings.
sidebar:
  order: 0
---

`aid lint` checks the files under a directory with five bundled tools and exits 1 when any of them reports an error. Every finding comes from one of these tools:

| Tool name | Linter | Files |
| --- | --- | --- |
| `md` | markdownlint | markdown |
| `openapi` | Spectral with the `spectral:oas` ruleset | OpenAPI specs |
| `bun` | `bun lint`, built into the Bun runtime inside aid, plus a JSON syntax check | JS, TS, and JSON |
| `css` | aid's CSS checks on lightningcss and the Tailwind compiler | CSS |
| `proto` | `buf lint` | Protobuf |

The glob patterns, ignored folders, and bundled rule sets for each tool are in [the lint defaults reference](../reference/lint-defaults.md). To change the rules, see [configuring the linters](./configuring.md).

## Use it

Point `aid lint` at your content folder:

```sh
aid lint docs
```

Each finding prints on one line, followed by a summary line:

```text
/home/me/site/docs/index.md:5:30  error  MD009  Trailing spaces: Expected: 0 or 2; Actual: 3
/home/me/site/docs/api/openapi.yaml:2:6  warn   info-contact  Info object must have "contact" object.
/home/me/site/docs/x.ts:2:1  error  no-debugger  Unexpected 'debugger' statement.

2 errors, 1 warning (md 1, openapi 1, bun 1, css 0, proto 0)
```

The line format is `file:line:col  severity  code  message`. The summary counts errors, warnings, and info findings, then the findings per tool. On a terminal, aid colors the severity and the code.

> [!IMPORTANT]
> `aid lint` does not read `aid.yaml`. It scans the whole directory you pass, and the current directory when you pass none. Pass your content folder. Otherwise `bun` also checks `package.json`, your scripts, and every other JS, TS, and JSON file in the project, and `css` checks every CSS file.

`aid build` and `aid dev` do not run the linters. Run `aid lint` yourself or in CI.

## Flags

| Flag | Effect |
| --- | --- |
| `[dir]` | Directory to scan. Defaults to the current directory. |
| `--filter md,openapi,bun,css,proto` | Run only the listed tools. An unknown name, such as a typo, stops the run with an error that lists the valid names. |
| `--fix` | Write autofixes to disk. Only markdownlint fixes and `bun lint --fix` apply. Spectral, `css`, and buf have no fix mode. |
| `--format pretty\|json` | Output format. Defaults to `pretty`. |

The generated [CLI reference](../reference/cli.md#aid-lint) lists the same flags.

With `--fix`, aid writes markdownlint's fixes back to the file, lints the result again, and reports what is left. aid never applies the fixes that change what a page says: MD037 (it would turn `a * b * c` into emphasis), MD053 (it deletes unused link definitions), and MD009 on a line that ends in two or more spaces (a hard line break). Those stay reported. `bun lint --fix` writes its safe fixes and reports what is left.

## How it works

```mermaid
flowchart TD
  A["aid lint dir"] --> F{"--filter"}
  F --> MD["md: discover *.md, *.markdown"]
  F --> OA["openapi: discover openapi.*, *.openapi.*, openapi/**"]
  F --> BI["bun: discover JS, TS, JSON"]
  F --> CS["css: discover *.css"]
  F --> PR["proto: discover *.proto"]
  MD --> MDL["markdownlint"]
  OA --> SP["Spectral, spectral:oas"]
  BI --> BW["bun lint, JSON parse"]
  CS --> LC["lightningcss checks, Tailwind compile"]
  PR --> BUF{"buf binary found?"}
  BUF -- yes --> BL["buf lint"]
  BUF -- no --> SK["skipped, passes"]
  MDL --> R["merge results"]
  SP --> R
  BW --> R
  LC --> R
  BL --> R
  SK --> R
  R --> O{"--format"}
  O --> PP["pretty lines + summary"]
  O --> JS["JSON"]
  PP --> X["exit 0, or 1 when any tool failed"]
  JS --> X
```

1. aid parses `--filter` into a set of tools. No filter selects all five. An unknown name stops the run with exit code 1.
2. For each selected tool, aid globs the target directory with that tool's patterns. It skips `node_modules`, `dist`, `.git`, and the other folders listed in [the lint defaults reference](../reference/lint-defaults.md).
3. aid runs the selected tools in parallel. A tool with no matching files passes with no findings.
4. Each tool finds its config file (see [configuring the linters](./configuring.md)) or falls back to the bundled default.
5. aid maps every finding to one shape: file, line, column, severity, code, message.
6. aid prints the report and exits 0 when every tool passed, 1 otherwise.

> [!WARNING]
> OpenAPI discovery goes by file name: `openapi.yaml`, `*.openapi.json`, or any YAML or JSON file under an `openapi/` folder. `aid build` detects OpenAPI by content instead, from a top-level `openapi:` or `swagger:` key. A spec named `api.yaml` renders as an API page but `aid lint` never checks it. Rename it to `api.openapi.yaml` or move it into an `openapi/` folder.

### Severity

aid maps each tool's levels onto three severities: `error`, `warn`, and `info`.

| Tool | `error` | `warn` | `info` |
| --- | --- | --- | --- |
| markdownlint | rules at the default severity | rules set to `warning` | none |
| Spectral | severity 0 (error) | severity 1 (warn) | severity 2 and 3 (info, hint) |
| `bun` | rules set to `"error"`, parse errors, JSON syntax errors | rules set to `"warn"` | none |
| `css` | the checks marked `error` in [the CSS checks table](../reference/lint-defaults.md#css-checks-css) | the checks marked `warn` | none |
| buf | every finding | none | none |

Only `error` fails a tool. A run with warnings and no errors exits 0. buf reports no severity, so every buf finding is an error. The proto tool also fails when `buf lint` exits non-zero.

### How aid finds buf

markdownlint, Spectral, the CSS checks, and the Bun runtime that runs `bun lint` ship inside aid. buf is a native binary, so aid looks for it in this order:

1. The per-platform buf binary embedded in aid, for macOS and Linux on arm64 and x64. In a compiled aid binary, aid copies it to a temporary file such as `/tmp/aid-buf-XXXXXX/buf` on first use, because the embedded file cannot be executed in place. Run from source, aid uses the copy in `node_modules`.
2. `buf` on your `PATH`.
3. If neither exists, aid skips the proto tool and the tool passes. Pretty output prints `proto: skipped (...)`, and the JSON result has `skipped: true` and a `reason`.

## JS, TS, and JSON checks

The `bun` tool runs `bun lint` from the Bun runtime that every aid binary embeds, so it needs no install. A compiled aid binary starts a second copy of itself with `BUN_BE_BUN=1`, which makes it act as the `bun` CLI. aid passes the discovered JS and TS files and maps `bun lint --format json` onto the line format above. Each code is the `bun lint` rule name, such as `prefer-const`, or `syntax-error` for a file that does not parse.

When the project has no lint config, aid turns off every `bun lint` rule category and runs only the rules in [the bundled rule table](../reference/lint-defaults.md#bun-default-bun). [Configuring the linters](./configuring.md#bun-lint-and-bun-fmt) lists the config files that replace it.

`bun lint` does not check JSON files. aid parses each one instead and reports a file that does not parse as `json-syntax-error`. `.json` files must be strict JSON. `.jsonc` files and the JSON-with-comments files that tools read, such as `tsconfig.json`, `jsconfig.json`, `.oxlintrc.json`, and `.vscode/*.json`, may hold comments and trailing commas.

## CSS checks

The `css` tool runs every check in [the CSS checks table](../reference/lint-defaults.md#css-checks-css) on each CSS file. It has no config file. Each code matches the name of the Stylelint rule with the same intent. A run has two stages:

1. lightningcss, the CSS parser that `aid build` uses, parses the file. aid reports its parse errors and walks the parsed rules for unknown properties, values, selectors, at-rules, and media features, and for duplicates. Tailwind's directives, such as `@theme`, `@apply`, `@utility`, and `@custom-variant`, pass.
2. When the file imports `tailwindcss` or `aid/theme`, aid compiles it with Tailwind the way `aid build` does. Tailwind stops at the first error, such as an unknown utility in `@apply`, so aid reports at most one `tailwind` finding per file.

aid knows a name when a W3C spec defines it. `src/lint/css-data.json` holds the names, generated from the `@webref/css` and `@webref/elements` packages. Custom properties, vendor-prefixed properties, and custom elements pass. Values that lightningcss cannot parse pass when every keyword and unit in them appears in a CSS spec, so newer values such as `word-break: auto-phrase` do not fail.

```text
/home/me/site/main.css:4:15  error  tailwind  Cannot apply unknown utility class `pyy-2`
/home/me/site/main.css:7:3  error  property-no-unknown  Unknown property "colr"
```

## JSON output

`--format json` prints one object with a `results` array, one entry per tool that ran:

```json
{
  "results": [
    {
      "tool": "md",
      "ok": false,
      "diagnostics": [
        {
          "file": "/home/me/site/docs/index.md",
          "line": 5,
          "col": 30,
          "severity": "error",
          "code": "MD009",
          "message": "Trailing spaces: Expected: 0 or 2; Actual: 3"
        }
      ]
    },
    { "tool": "proto", "ok": true, "diagnostics": [], "skipped": true, "reason": "buf binary not available ..." }
  ]
}
```

- `tool` is `md`, `openapi`, `bun`, `css`, or `proto`.
- `ok` is false when the tool reported an error.
- `line` and `col` are absent when the tool gives no position.
- `skipped` and `reason` appear only when a tool had files but could not run.

The exit code follows the same rule as pretty output.

## Limitations

> [!WARNING]
> lightningcss records no position for a declaration. aid searches the rule's source for the property name, so a finding can point at the wrong line when a nested rule declares the same property first.
>
> buf errors that are not lint findings, such as a broken `buf.yaml`, do not print. The proto tool fails with no findings. Run `buf lint` by hand to see the message.
