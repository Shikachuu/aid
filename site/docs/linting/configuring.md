---
title: Configuring the linters
description: Where aid lint and aid fmt look for markdownlint, Spectral, Biome, and buf config files, and how a config file replaces the bundled default.
sidebar:
  order: 1
---

Each tool behind [`aid lint`](./index.md) and [`aid fmt`](../formatting/index.md) reads its own config file, in that tool's own format. aid has no lint settings in `aid.yaml`.

## Where aid looks

For each tool, aid starts in the target directory and checks for that tool's config file names. If none exists, it moves to the parent directory and checks again. It stops after the first directory that contains `.git`, so it never reads a config file from outside your repository. If the walk finds nothing, aid uses its bundled default for that tool.

The file names per tool, in the order aid checks them, are in [the lint defaults reference](../reference/lint-defaults.md). In short: `.markdownlint.*`, `.spectral.*`, `biome.json` or `biome.jsonc`, and `buf.yaml`.

aid parses `.json` and `.jsonc` files as JSON with comments, and `.yaml` and `.yml` files as YAML. The same reference page lists the bundled defaults.

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

## Biome

```json
{
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": { "quoteStyle": "double", "semicolons": "asNeeded" }
  },
  "linter": {
    "rules": {
      "recommended": true,
      "suspicious": { "noDebugger": "off" }
    }
  }
}
```

Save this as `biome.json`. aid hands the parsed file to Biome's `applyConfiguration`. Keys you leave out fall back to Biome's own defaults, not to aid's bundled default. Biome's own formatter default indents with tabs and always adds semicolons, so a `biome.json` with only a `linter` block changes how `aid fmt` formats JS and TS.

aid finds the files itself, so `files.includes` in your `biome.json` does not widen or narrow what aid checks.

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

> [!WARNING]
> Put `buf.yaml` in the directory you lint. When aid finds a `buf.yaml` in a parent directory, buf refuses to lint the subdirectory as a separate input, and the proto tool fails with no findings.

## Spectral

> [!WARNING]
> Not implemented yet: custom Spectral rulesets. aid passes the parsed `.spectral.*` file to Spectral without resolving it. Any `extends` (such as `spectral:oas`), any built-in function name (such as `truthy`), or any override of a `spectral:oas` rule makes `aid lint` crash with a stack trace. Keep no `.spectral.yaml`, `.spectral.yml`, or `.spectral.json` between the target directory and the repository root, and aid lints with the bundled `spectral:oas` ruleset.

This file works with the Spectral CLI but crashes `aid lint`:

```yaml
# .spectral.yaml
extends: spectral:oas
rules:
  info-contact: off
```

In the bundled `spectral:oas` ruleset, 32 rules report at `warn` and 13 at `error`. The error rules cover structural problems such as `oas3-schema`, `path-params`, and `operation-operationId-unique`. Style findings such as a missing `info.contact` are warnings and do not fail the run.
