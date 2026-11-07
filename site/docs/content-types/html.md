---
title: HTML pages
description: How aid renders full .html documents - the required shape, the metadata it keeps from <head>, images, links, mermaid, search, and the .md export.
sidebar:
  order: 2
---

aid renders every `.html` file in the content folder as a page in the site layout. It keeps the `<body>`, lifts the title and description out of `<head>`, and drops the rest of `<head>`. The [status page](../status.html) of this site is an HTML page.

## Use it

Write `docs/about.html` as a full document:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>About the project</title>
  <meta name="description" content="Who maintains the project and how to reach them.">
</head>
<body>
  <h1>About the project</h1>
  <p>Maintained by the docs team. <a href="./guides/intro.md">Start here</a>.</p>
  <img src="./team.png" alt="The team">
</body>
</html>
```

`aid build` writes the page to `dist/about/index.html` and its export to `dist/about.md`.

## Document shape

The source must contain an `<html>` and a `<body>` opening tag. aid checks the raw text before it parses the file, because the HTML parser adds missing wrappers on its own. A body fragment or an empty file fails the build.

## Metadata

aid reads two tags from `<head>` and discards the rest, including `<script>`, `<link>`, `<style>`, and every other `<meta>`.

| Source tag | Used for |
| --- | --- |
| `<title>` | The page title in `<title>`, the sidebar, search results, and llms.txt. aid trims it. An empty or missing `<title>` falls back to the file name without `.html`. |
| `<meta name="description" content="...">` | `<meta name="description">` on the rendered page and the page's line in llms.txt. |

aid does not insert an H1 into HTML pages. Write your own `<h1>` in the body.

HTML pages have no frontmatter, so set their sidebar label and order in the folder's `_meta.yaml`. See [navigation](./navigation.md#_metayaml). HTML pages cannot be marked `llms: optional`.

## Body

aid parses the body with `rehype-parse`, rewrites images and links, and writes it back out with `rehype-stringify` inside `<article class="aid-page aid-page-html">`. Attribute quoting and whitespace may change. Elements, attributes, and inline `<script>` tags in the body stay.

- A relative `<img src>` is copied next to the rendered page and rewritten. See [images and static files](./images-and-static.md).
- A relative `<a href>` is rewritten to the target's route URL and checked. See [links](./links.md).
- aid does not add ids or anchor links to headings. Write an `id` attribute on any element you want to link to with a `#fragment`.

## Mermaid diagrams

A `<pre class="mermaid">` element in the body loads the mermaid browser bundle on that page, and mermaid renders the diagram in the browser.

```html
<pre class="mermaid">
flowchart LR
  A --> B
</pre>
```

## Search

aid indexes the title, the text of the body, and the text of every `<h1>` to `<h6>` heading. The body text leaves out markup and the contents of `<script>`, `<style>`, and `<template>`. See [search](../search/index.md).

## The .md export

aid converts the rewritten body to markdown with `rehype-remark` and `remark-stringify` and writes it to `<route>.md`. The export uses the same rewritten link and image URLs as the page. aid drops the `<head>`, so the export has no title line unless the body has an `<h1>`.

## Errors

| Condition | Result |
| --- | --- |
| The source has no `<html>` or no `<body>` tag | The build fails: `aid: HTML page <path> must be a full HTML document with <html> and <body>. Body fragments are not supported in v0.1.` |
| A relative `<img src>` points at a missing file | `image/missing` in the [broken-reference report](./links.md#broken-reference-check) |
| A relative `<img src>` resolves outside the content folder | The build fails with `colocated asset "<path>" ... escapes contentDir` |
| A relative `<a href>` does not resolve | `link/missing`, `link/excluded`, `link/outside`, or `link/anchor` in the broken-reference report |

## Limitations

> [!WARNING]
> Not supported: body fragments, custom `<head>` content, `<meta>` tags other than `description`, and `srcset`. aid only rewrites the `src` attribute of `<img>`. It leaves `srcset`, `<source>`, `<video>`, and CSS `url()` references as written.
