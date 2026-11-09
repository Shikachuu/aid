---
title: aid init
description: The aid init command is not implemented yet. This page shows the files it is meant to create and how to create them by hand.
sidebar:
  order: 2
---

`aid init` is meant to create a new aid project in a folder.

> [!WARNING]
> Not implemented yet: `aid init [dir]` prints `aid init <dir>: not implemented` and exits 1. It creates no files.

## What it is meant to create

The repository holds the starter files in `assets/scaffold/`. The `aid` command does not read that folder yet. The integration test `tests/integration/scaffold.test.ts` builds a copy of it, so the files are known to build.

| File | Content |
| --- | --- |
| `aid.yaml` | A config with `name`, `description`, and `version`, and most other keys written out with their default values. |
| `docs/index.md` | A welcome page with frontmatter and a list of next steps. |
| `main.css` | `@import "tailwindcss";`, `@import "aid/theme";`, and an empty `@theme` block with a comment that lists the theme tokens. |

## Create the files by hand

[Getting started](../getting-started/index.md) creates the same project by hand. The short version:

```sh
mkdir -p my-docs/docs
printf 'name: My Docs\n' > my-docs/aid.yaml
printf -- '---\ntitle: Welcome\n---\n\nHello.\n' > my-docs/docs/index.md
aid build my-docs
```

`main.css` is optional. Without it, aid uses its bundled theme.

You can also copy `assets/scaffold/` from a checkout of the aid repository and edit the copy.
