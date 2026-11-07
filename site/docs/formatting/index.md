---
title: Formatting
description: How aid fmt rewrites markdown, OpenAPI, JS, TS, JSON, CSS, and Protobuf files, and how --check reports the files that would change.
sidebar:
  order: 0
---

`aid fmt` rewrites the files under a directory in place with four of the five tools behind [`aid lint`](../linting/index.md). The `css` tool only lints, so `bun` formats CSS. With `--check`, it writes nothing and exits 1 when any file would change.

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

0 errors, 2 warnings (md 1, openapi 1, bun 0, proto 0)
```

Each file that would change prints as one line and counts as a warning in the summary. Any listed file fails its tool, so the run exits 1.

`aid fmt` finds files the same way as `aid lint`: the same glob patterns, the same ignored folders, and the same config files. It does not read `aid.yaml`, so pass your content folder. See [the lint defaults reference](../reference/lint-defaults.md) for the patterns and [configuring the linters](../linting/configuring.md) for the config files.

## Flags

| Flag | Effect |
| --- | --- |
| `[dir]` | Directory to format. Defaults to the current directory. |
| `--check` | Write nothing. List the files that would change and exit 1 if there are any. |
| `--filter md,openapi,bun,proto` | Run only the listed tools. An unknown name, such as a typo, stops the run with an error that lists the valid names. |
| `--format pretty\|json` | Output format. Defaults to `pretty`. |

In JSON output, each tool result has a `wouldChange` array with the files that would change in `--check` mode. The rest of the shape matches [the lint JSON output](../linting/index.md#json-output).

## What each tool does

| Tool | Formatter |
| --- | --- |
| `md` | Runs markdownlint with your `.markdownlint.*` config or the bundled default, then applies its fixes until the file is stable. It skips the fixes that change meaning, the same ones `aid lint --fix` skips (see [linting](../linting/index.md)). |
| `openapi` | Reformats `.yaml` and `.yml` specs with a 2-space indent. Comments, anchors, block scalars, quoting and number spellings such as `1.0` stay as written. `.json` specs are formatted by the `bun` tool like any other JSON file, so `--filter openapi` alone leaves them untouched. |
| `bun` | Runs `bun fmt` on JS, TS, JSON, and CSS files, with your `bun fmt` config or the bundled default: a line width of 100 and no semicolons. With `--check`, it lists the files `bun fmt --check` reports. It applies no lint fixes. |
| `proto` | Runs `buf format -w` on each file. With `--check`, it runs `buf format -d --exit-code` and lists the files with a non-empty diff. A file that does not parse is left untouched and reported as `proto/parse`, because `buf format` would rewrite it and drop the broken tokens. A buf failure, such as an invalid `buf.yaml`, is reported with buf's message. |

aid finds buf the same way for `aid fmt` as for `aid lint`. When no buf binary is available, the proto tool is skipped and passes. See [how aid finds buf](../linting/index.md#how-aid-finds-buf).

A spec that fails to parse stays untouched, and aid reports an `openapi/parse` error for it. aid also leaves a spec untouched, with a warning, when it holds several YAML documents (`openapi/multi-document`) or when reformatting would change its data (`openapi/lossy`).
