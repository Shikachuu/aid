---
title: Getting started
description: Create a minimal aid project by hand, preview it with aid dev, and build it with aid build.
sidebar:
  order: 0
---

A minimal aid project is a config file and one markdown page. This page builds one by hand, because `aid init` does not create projects yet.

> [!WARNING]
> Not implemented yet: `aid init` prints `aid init <dir>: not implemented` and exits 1. See [aid init](../commands/init.md).

The commands below call `aid`. Until aid has a release, `aid` means `bun src/cli/index.ts` run from a checkout of the aid repository. [Installation](./installation.md) sets that up.

## Create the files

Make this tree:

```text
my-docs/
├── aid.yaml
├── main.css          (optional)
└── docs/
    └── index.md
```

`aid.yaml` needs one key:

```yaml
name: My Docs
```

aid fills every other key with its default. The [configuration reference](../reference/configuration.md#full-default-config) shows the full result.

`docs/index.md` is the home page. Its frontmatter sets the page title and the description that search and `llms.txt` use:

```md
---
title: Welcome
description: Home page of My Docs.
---

This is the home page.
```

aid renders the frontmatter `title` as the page heading, so the body does not need an H1.

`main.css` is the Tailwind entry point. Without it, aid compiles its bundled theme. Add it when you want to change colors or fonts:

```css
@import "tailwindcss";
@import "aid/theme";

@theme {
  --color-aid-accent: oklch(55% 0.13 175);
}
```

`@import "aid/theme"` pulls in aid's default theme. [Theming](../theming/index.md) lists the tokens you can override.

## Preview it

```sh
aid dev my-docs
```

The dev server prints its address:

```text
[aid] dev server listening at http://localhost:3000/
```

The default address is `http://localhost:3000/`. `--port` and `--host` change it. The server rebuilds and reloads the browser when a file under `docs/` or `static/` changes, or when `main.css` changes. A change to `aid.yaml` stops the server; start it again to load the new config. [Dev server](../dev-server/index.md) has the details.

The dev server writes its builds to `my-docs/.aid/dev/`, not to `dist/`.

## Build it

```sh
aid build my-docs
```

aid writes the site to `my-docs/dist/`. For this project the output holds:

- `index.html`, the rendered home page;
- `index.md`, the machine-readable copy of the home page;
- `llms.txt`;
- `main.<hash>.css`, the compiled stylesheet;
- `aid-web.<hash>.js`, the browser script that runs search;
- `search-index.<hash>.js`, the search index.

[aid build](../commands/build.md) explains every output file. Add `--clean` to delete `dist/` before the build.

## Add more pages

Every supported file under `docs/` becomes a page. The file path sets the URL:

| Source | URL |
| --- | --- |
| `docs/index.md` | `/` |
| `docs/guide.md` | `/guide` |
| `docs/guides/index.md` | `/guides` |
| `docs/guides/setup.md` | `/guides/setup` |
| `docs/api.yaml` (an OpenAPI spec) | `/api` |
| `docs/events.proto` | `/events` |

A file or folder whose name starts with `_` is skipped. Link between pages by their source path, for example `[setup](./guides/setup.md)`; aid rewrites the link to the page URL. [Content types](../content-types/index.md) covers each source type, and the repository's `tests/fixtures/sample-site` folder has one page of each.
