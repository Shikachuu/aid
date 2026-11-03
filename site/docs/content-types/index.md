---
title: Content types
description: How aid finds source files in the content folder, turns each one into a route, and which of the four page kinds it becomes.
sidebar:
  order: 4
---

aid builds one page from every markdown, HTML, OpenAPI, and Protobuf file in the content folder. The content folder is `dir.content` in `aid.yaml`. It defaults to `docs`, and this site uses `site/docs`.

## Page kinds

| Kind | Source files | Rendered | Export |
| --- | --- | --- | --- |
| [Markdown](./markdown.md) | `.md` | at build time | `.md`, re-serialized from the parsed tree |
| [HTML](./html.md) | `.html`, full documents only | at build time | `.md`, converted from the body |
| [OpenAPI](./openapi.md) | `.yaml`, `.yml`, `.json` with an `openapi` or `swagger` version key | in the browser by Scalar | `.json`, the normalized OpenAPI 3.1 spec |
| [Protobuf](./proto.md) | `.proto` | in the browser by `@aid/proto-ui` | `.proto`, the source file unchanged |

Every kind gets the same layout, sidebar, search box, and stylesheet. Colocated images and other files are covered in [images and static files](./images-and-static.md), the sidebar in [navigation](./navigation.md), and link rewriting in [links](./links.md).

## Discovery

aid scans the content folder with the glob `**/*.{md,html,yaml,yml,json,proto}`.

- aid skips every file with a path segment that starts with `_`, such as `_drafts/plan.md` or `guides/_snippet.md`. This rule also keeps `_meta.yaml` files out of the page list. aid has no include mechanism, so an excluded file does not appear anywhere in the output.
- Files with other extensions never become pages. aid copies them into the output only when a page links to them or when they sit in the static folder.
- aid reads the first 64 KiB of every `.yaml`, `.yml`, and `.json` file. A YAML file becomes an OpenAPI page when a line starts with `openapi:` or `swagger:` followed by a version number, such as `openapi: 3.1.0` or `swagger: "2.0"`. A JSON file becomes an OpenAPI page when it holds `"openapi": "3...` or `"swagger": "2...` with a string value that starts with a digit. aid skips every other YAML and JSON file without a warning, so data files can live next to pages.

## Routes

The route path is the source path relative to the content folder, without its extension. A file named `index` takes the route of its folder, and routes have no trailing slash.

| Source | Route | Rendered file | Export |
| --- | --- | --- | --- |
| `docs/index.md` | `/` | `dist/index.html` | `dist/index.md` |
| `docs/about.html` | `/about` | `dist/about/index.html` | `dist/about.md` |
| `docs/guides/index.md` | `/guides` | `dist/guides/index.html` | `dist/guides.md` |
| `docs/guides/intro.md` | `/guides/intro` | `dist/guides/intro/index.html` | `dist/guides/intro.md` |
| `docs/api.yaml` | `/api` | `dist/api/index.html` | `dist/api.json` |
| `docs/billing.proto` | `/billing` | `dist/billing/index.html` | `dist/billing.proto` |

The public URL is `base_path` followed by the route. This site sets `base_path: /aid`, so the route `/content-types/markdown` is served at `/aid/content-types/markdown`. See [paths and URLs](../configuration/paths-and-urls.md) for how `base_path` and `base_url` combine.

## Exports

Every page also writes one machine-readable export next to its route folder, at `<route>.<ext>`. The root route writes `index.<ext>`. [llms.txt](../llms-txt/index.md) links to these exports instead of the HTML pages.

- Markdown pages export `.md`, re-serialized from the parsed tree without frontmatter.
- HTML pages export `.md`, converted from the `<body>`.
- OpenAPI pages export `.json`, the parsed spec after the upgrade to OpenAPI 3.1 and `$ref` resolution.
- Proto pages export `.proto`, a byte-for-byte copy of the source. The proto page loads this file in the browser.

## Errors

Two sources that resolve to the same route fail the build. `guides.md` next to `guides/index.md` is the common case, and `api.md` next to an OpenAPI `api.yaml` is another.

```text
aid: route collision — both "<abs path>/docs/guides.md" and "<abs path>/docs/guides/index.md" resolve to /guides. Rename one (e.g. drop the index.md, or move the bare .md into a subdirectory).
```

An export that lands on the path of another output file, such as `static/api.json` next to an OpenAPI page at `/api`, fails the build with an asset collision. See [images and static files](./images-and-static.md#errors).
