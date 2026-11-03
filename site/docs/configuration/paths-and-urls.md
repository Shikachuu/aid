---
title: Paths and URLs
description: How the dir keys, base_path, and base_url decide where aid reads and writes files and which URLs it generates.
sidebar:
  order: 1
---

Four `dir` keys set the folders aid reads and writes. `base_path` sets the URL prefix of every link aid generates, and `base_url` makes the links in `llms.txt` absolute.

## Folders

aid resolves every `dir` key and `stylesheet` against the project folder: the `dir` argument of `aid build` or `aid dev`, or the current folder. The location of the config file does not matter.

| Key | Default | What aid does with it |
| --- | --- | --- |
| `dir.content` | `docs` | Turns every `.md`, `.html`, and `.proto` file, and every OpenAPI `.yaml`, `.yml`, or `.json` file, into a page. A path segment that starts with `_` excludes the file. |
| `dir.output` | `dist` | `aid build` writes the site here. `aid dev` does not use it and builds into `.aid/dev/` instead. |
| `dir.static` | `static` | Copies every file to the same relative path under the output root. A missing folder copies nothing. |
| `dir.templates` | empty | Reads an `llms.txt` template from this folder, and Tailwind scans its `.tsx`, `.ts`, and `.html` files for class names. Empty means no folder. |

`dir.templates` does not hold page templates. The page layout is built into aid. See [llms.txt](../llms-txt/index.md) for the template format.

## base_path

`base_path` is the URL prefix for a site hosted under a sub-path. The default is `/`. This site sets `base_path: /aid` because GitHub Pages serves it at `https://shikachuu.github.io/aid/`.

aid adds `base_path` to every URL it generates:

| Source | URL with `base_path: /aid` |
| --- | --- |
| `docs/index.md` | `/aid` |
| `docs/commands/build.md` | `/aid/commands/build` |
| `[errors](./commands/build.md#errors)` | `/aid/commands/build#errors` |
| `![logo](./logo.svg)` in `docs/index.md` | `/aid/logo.svg` |
| `static/schemas/aid.schema.json` | `/aid/schemas/aid.schema.json` |
| The compiled stylesheet | `/aid/main.<hash>.css` |

The same prefix applies to the sidebar links, the site name link in the header, the browser scripts, the search index file, the URLs in search results, and the links in `llms.txt`.

aid does not change URLs that you write as absolute paths. A link to `/schemas/aid.schema.json` stays as written and misses the prefix. To link a file in `dir.static`, write the prefix yourself (`/aid/schemas/aid.schema.json`), or put the file next to the page and link it with a relative path. [Links](../content-types/links.md) covers which links aid rewrites.

Start `base_path` with `/`. aid does not check the value, and a value without the leading slash produces relative URLs that break on nested pages. A trailing slash is optional.

## base_url

`base_url` is the origin of the published site, for example `https://shikachuu.github.io`. It is optional and must be a full URL. aid uses it only in `llms.txt`.

Without `base_url`, the links in `llms.txt` are root-relative:

```md
- [Commands](/aid/commands.md): The aid commands, what each one does, and the exit codes they return.
```

With `base_url`, aid joins it with `base_path` and the page's export path, and the links become absolute:

```md
- [Commands](https://shikachuu.github.io/aid/commands.md): The aid commands, what each one does, and the exit codes they return.
```

aid keeps only the origin of `base_url`. A path in it is dropped: `base_url: https://example.com/docs` gives the same links as `https://example.com`. Put the path in `base_path` instead.

An `llms.txt` template can also print the raw value with the `{{base_url}}` placeholder.

## The dev server and base_path

`aid dev` serves the site under `base_path`, so local URLs match the deployed ones. With `base_path: /aid` and the default port:

- `http://localhost:3000/aid/` and `http://localhost:3000/aid` serve the home page.
- `http://localhost:3000/aid/commands/build` serves `commands/build/index.html`.
- Any path outside `/aid`, such as `http://localhost:3000/`, gets a `302` redirect to `/aid/`.

The dev server keeps its live-reload channel at `/__aid/reload`, outside `base_path`. [Dev server](../dev-server/index.md) covers the rest.
