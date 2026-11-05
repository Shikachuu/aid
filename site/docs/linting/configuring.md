---
title: Configuring the linters
description: Where aid lint and aid fmt look for markdownlint, Spectral, bun lint, bun fmt, and buf config files, how a config file replaces the bundled default, and why the CSS checks have none.
sidebar:
  order: 1
---

Each tool behind [`aid lint`](./index.md) and [`aid fmt`](../formatting/index.md) reads its own config file, in that tool's own format. aid has no lint settings in `aid.yaml`.

## Where aid looks

For each tool, aid starts in the target directory and checks for that tool's config file names. If none exists, it moves to the parent directory and checks again. It stops after the first directory that contains `.git`, so it never reads a config file from outside your repository. If the walk finds nothing, aid uses its bundled default for that tool.

The file names per tool, in the order aid checks them, are in [the lint defaults reference](../reference/lint-defaults.md). In short: `.markdownlint.*`, `.spectral.*`, the `bun lint` and `bun fmt` configs below, and `buf.yaml`. The `css` tool reads no config file.

aid parses `.json` and `.jsonc` files as JSON with comments, and `.yaml` and `.yml` files as YAML. The same reference page lists the bundled defaults. A config file that does not parse fails its tool with one error that names the file, such as `md/config` or `openapi/config`, and the other tools still run.

> [!IMPORTANT]
> A config file replaces the bundled default for its tool. aid does not merge the two. Repeat any setting from the bundled default that you still want.

For example, the bundled markdownlint default turns off MD013 (line length) and MD041 (first line must be a heading). A `.markdownlint.yaml` that only turns off MD033 turns MD013 and MD041 back on.

## markdownlint

```yaml
# .markdownlint.yaml
default: true
MD013: false
MD024:
  siblings_only: true
MD041: false
MD033: false
```

This file repeats the bundled default and turns off MD033 (inline HTML). To report a rule without failing the run, set it to `warning`:

```yaml
MD009: warning
```

aid prints these findings as `warn`, and warnings do not change the exit code. `aid fmt` reads the same file to decide which fixes to apply.

markdownlint reads the file itself, so `extends` works: it names another config file, relative to the one that extends it, and the settings in the extending file win.

## bun lint and bun fmt

The `bun` tool reads the same config files as `bun lint` and `bun fmt`.

| Tool | Config files |
| --- | --- |
| `aid lint` | `eslint.config.*`, `.eslintrc*`, `.oxlintrc.json`, or a `bunfig.toml` with a `[lint]` section |
| `aid fmt` | `.prettierrc*`, `prettier.config.*`, `.oxfmtrc.json`, `.oxfmtrc.jsonc`, `oxfmt.config.ts`, `oxfmt.config.mts`, or a `bunfig.toml` with an `[fmt]` section |

Without one of them, `aid lint` runs [the bundled rules](../reference/lint-defaults.md#bun-default-bun) and `aid fmt` formats with a line width of 100 and no semicolons. One `bunfig.toml` can configure both:

```toml
# bunfig.toml
[lint.categories]
correctness = "error"

[lint.rules]
"no-console" = "warn"
"eqeqeq" = ["error", "smart"]

[fmt]
printWidth = 100
semi = false
```

Rule names are `bun lint`'s names, the same as ESLint's for core rules and plugin-prefixed for the rest, such as `@typescript-eslint/no-explicit-any`. Without a `[lint.categories]` section, `bun lint` keeps its own default rules on and adds yours. `bun fmt` takes Prettier's option names and also reads `.editorconfig`. The [bun lint](https://bun.com/docs/lint) and [bun fmt](https://bun.com/docs/format) docs list every option.

Bun reads `bunfig.toml` only from the directory it runs in. aid finds the nearest one with the right section, walking up as for every other tool, and passes it to Bun.

> [!WARNING]
> ESLint JS plugins that a config loads run from the project's `node_modules`, so they need an `npm install` in your project. The rules that `bun lint` has built in need nothing.

## CSS

The `css` tool has no config file and no setting to turn a check off. It always runs the checks in [the CSS checks table](../reference/lint-defaults.md#css-checks-css). To skip CSS, leave `css` out of `--filter`, for example `aid lint docs --filter md,openapi,bun,proto`. A `bun fmt` config changes how `aid fmt` formats CSS, not what `aid lint` reports.

## buf

```yaml
# buf.yaml
version: v2
lint:
  use:
    - STANDARD
  except:
    - PACKAGE_VERSION_SUFFIX
    - PACKAGE_DIRECTORY_MATCH
```

When aid finds no `buf.yaml`, it passes its bundled default to `buf lint` through `--config`. When it finds one, it passes no `--config` and buf reads the file itself.

aid passes each discovered `.proto` file to buf with `--path`, so buf never lints files under `node_modules`, `dist`, or the other folders discovery skips. The `excludes` in your `buf.yaml` still apply. When they exclude every discovered file, the proto tool passes with no findings.

> [!WARNING]
> Put `buf.yaml` in the directory you lint. When aid finds a `buf.yaml` in a parent directory, buf refuses to lint the subdirectory as a separate input, and the proto tool fails with buf's error message.

## Spectral

A `.spectral.*` file can extend the bundled ruleset and change its rules:

```yaml
# .spectral.yaml
extends: spectral:oas
rules:
  info-contact: off
```

`extends` also takes the Spectral CLI's `[[spectral:oas, recommended]]` form.

> [!WARNING]
> Not implemented yet: the rest of the Spectral ruleset format. aid passes the parsed file to Spectral and resolves only `spectral:oas` in `extends`. Another ruleset name, a file path in `extends`, or a built-in function name such as `truthy` fails the openapi tool with an `openapi/config` error that carries Spectral's reason.

Spectral follows every `$ref` in a spec, remote ones included, so `aid lint` fetches a `$ref` that points at a URL.

In the bundled `spectral:oas` ruleset, 32 rules report at `warn` and 13 at `error`. The error rules cover structural problems such as `oas3-schema`, `path-params`, and `operation-operationId-unique`. Style findings such as a missing `info.contact` are warnings and do not fail the run.
