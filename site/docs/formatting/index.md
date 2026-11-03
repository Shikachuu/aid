---
title: Formatting
description: How aid fmt rewrites markdown, OpenAPI, Biome, and Protobuf files, and how --check reports the files that would change.
sidebar:
  order: 0
---

`aid fmt` rewrites the files under a directory in place with four of the five tools behind [`aid lint`](../linting/index.md). The `css` tool only lints, so Biome formats CSS. With `--check`, it writes nothing and exits 1 when any file would change.

## Use it

```sh
aid fmt docs
```

> [!CAUTION]
> Without `--check`, `aid fmt` overwrites files in place and keeps no backup. Commit your work first so you can review the diff.

In CI, check instead of writing:

```sh
aid fmt docs --check
```

```text
/home/me/site/docs/index.md  would-change  md/format  file would be reformatted
/home/me/site/docs/api/openapi.yaml  would-change  openapi/format  file would be reformatted

0 errors, 2 warnings (md 1, openapi 1, biome 0, proto 0)
```

Each file that would change prints as one line and counts as a warning in the summary. Any listed file fails its tool, so the run exits 1.

`aid fmt` finds files the same way as `aid lint`: the same glob patterns, the same ignored folders, and the same config files. It does not read `aid.yaml`, so pass your content folder. See [the lint defaults reference](../reference/lint-defaults.md) for the patterns and [configuring the linters](../linting/configuring.md) for the config files.

## Flags

| Flag | Effect |
| --- | --- |
| `[dir]` | Directory to format. Defaults to the current directory. |
| `--check` | Write nothing. List the files that would change and exit 1 if there are any. |
| `--filter md,openapi,biome,proto` | Run only the listed tools. aid drops unknown names. When no valid name is left, every tool runs. |
| `--format pretty\|json` | Output format. Defaults to `pretty`. |

In JSON output, each tool result has a `wouldChange` array with the files that would change in `--check` mode. The rest of the shape matches [the lint JSON output](../linting/index.md#json-output).

## What each tool does

| Tool | Formatter |
| --- | --- |
| `md` | Runs markdownlint with your `.markdownlint.*` config or the bundled default, then applies every fix that markdownlint offers. Rules without a fix leave the file alone. |
| `openapi` | Parses each spec and writes it back. `.json` files go through `JSON.parse` and `JSON.stringify` with a 2-space indent and a trailing newline. `.yaml` and `.yml` files go through `Bun.YAML.parse` and `Bun.YAML.stringify` in block style with a 2-space indent and a trailing newline. |
| `biome` | Formats JS, TS, JSON, and CSS with Biome's `formatContent`, using your `biome.json` or the bundled default. It applies no lint fixes. |
| `proto` | Runs `buf format -w` on each file. With `--check`, it runs `buf format -d --exit-code` and lists the files with a non-empty diff. |

aid finds buf the same way for `aid fmt` as for `aid lint`. When no buf binary is available, the proto tool is skipped and passes. See [how aid finds buf](../linting/index.md#how-aid-finds-buf).

Spectral has no formatter, so the OpenAPI step is a parse and re-serialize, not a style pass. A spec that fails to parse stays untouched, and aid reports an `openapi/parse` error for it.

## Limitations

> [!WARNING]
> `aid fmt` re-serializes every YAML OpenAPI file in block style with a two-space indent, so it drops every YAML comment and normalizes quoting and key layout. To keep comments, exclude OpenAPI from formatting with `--filter md,biome,proto`.
