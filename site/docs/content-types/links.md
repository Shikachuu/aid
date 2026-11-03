---
title: Links
description: How aid rewrites relative links to route URLs, which links it leaves alone, and how the build reports broken links, anchors, and images.
sidebar:
  order: 8
---

Link to another page by its source file with a relative path. aid rewrites the link to the target's route URL with `base_path` and fails the build when the target does not exist.

## Use it

In `docs/guides/intro.md`, with `base_path: /docs`:

```md
See [the install page](./install.md#requirements) and the [API reference](../api.yaml).
```

aid writes these links into the HTML and the `.md` export:

```html
<a href="/docs/guides/install#requirements">the install page</a>
<a href="/docs/api">API reference</a>
```

## What aid rewrites

aid rewrites markdown links, markdown reference definitions (`[ref]: ./page.md`), and `<a href>` in HTML pages. It resolves each relative path against the folder of the source file.

| Link target | Result |
| --- | --- |
| A page source: `.md`, `.html`, `.proto`, or an OpenAPI `.yaml`, `.yml`, `.json` | The route URL with `base_path` |
| A path without an extension, such as `./install` | The route URL, when a page has that route |
| A folder, such as `../guides/` | The route URL of the folder's landing page |
| Any other file, such as `./spec.pdf` | aid copies the file next to the page and links to the copy. See [images and static files](./images-and-static.md#other-linked-files). |
| `#fragment` alone | Unchanged, but checked against the current page |

aid keeps the query string and the `#fragment` of a rewritten link.

aid leaves these links unchanged and does not check them:

- absolute paths such as `/schemas/aid.schema.json`. aid does not add `base_path` to them;
- URLs with a scheme, such as `https:`, `mailto:`, or `tel:`, and protocol-relative URLs such as `//example.com`;
- raw `<a href>` tags inside markdown. Use markdown link syntax instead.

## Broken-reference check

aid collects every link and image it cannot resolve across the whole site and reports them in one message after all pages render. Each line has the source location, a code, and the reason. The lines are sorted by file, line, and column.

| Code | Cause |
| --- | --- |
| `link/missing` | The target page or file does not exist. |
| `link/excluded` | The target page exists but a `_` path segment excludes it from the build. |
| `link/outside` | The relative path leaves the content folder. Use an absolute URL for files outside it. |
| `link/anchor` | The target page exists but has no element with the `#fragment` id. |
| `image/missing` | A relative image points at a missing file. |
| `nav/unknown-entry` | A `_meta.yaml` key matches no page or folder. See [navigation](./navigation.md#errors). |

A build with two broken links prints:

```text
aid: 2 broken references
  docs/guides/intro.md:7:5  link/anchor  link "./install.md#requirments" targets a heading or id that does not exist
  docs/index.md:3:1  link/missing  link "./gone.md" targets a page that does not exist
```

The file paths are relative to the project folder.

### Fragment check

aid checks a `#fragment` against every `id` and `name` attribute on the target page, including ids that markdown headings get and ids written in raw HTML. The fragment `#top` always passes.

aid skips the check for links into OpenAPI and proto pages, because those pages create their ids in the browser.

## Configure it

`on_broken_links` in `aid.yaml` decides what the report does:

```yaml
on_broken_links: warn
```

- `error`, the default, fails the build with the report.
- `warn` prints the report and finishes the build. Broken links stay in the output as written.

In `aid dev`, a broken reference shows in an overlay in the browser, and the server keeps serving the last build that succeeded. See [the dev server](../dev-server/index.md). The key is listed in the [configuration reference](../reference/configuration.md#top-level-keys).

Two errors are not part of the report and fail the build whatever `on_broken_links` says: an image that resolves outside the content folder, and two outputs that target one file. See [images and static files](./images-and-static.md#errors).
