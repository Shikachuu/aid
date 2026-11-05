---
title: Images and static files
description: How aid copies images and other files that pages reference, and how it mirrors the static folder into the output.
sidebar:
  order: 7
---

aid puts non-page files into the output two ways. It copies each file that a markdown or HTML page references with a relative path next to that page, and it mirrors the static folder into the output root.

## Colocated images

Put an image anywhere in the content folder and reference it with a relative path. This page shows the aid logo from `site/docs/logo.svg`:

```md
![aid logo](../logo.svg)
```

![aid logo](../logo.svg)

aid resolves the path against the folder of the source file, copies the file into the page's output folder, and rewrites the reference to its public URL with `base_path`. For this page, `../logo.svg` becomes `/aid/content-types/images-and-static/logo.svg`.

- In markdown, aid rewrites image syntax: `![alt](./x.png)` and reference-style images.
- In HTML pages, aid rewrites the `src` attribute of `<img>`. It does not rewrite `srcset`, `<source>`, `<video>`, or CSS `url()`.
- aid leaves absolute paths (`/img/x.png`), `#fragment` sources, and URLs with a scheme (`https:`, `data:`) unchanged.
- aid percent-decodes the path before it looks for the file, so `./a%20b.png` finds `a b.png`. A query string or `#fragment`, as in `./icons.svg#star`, stays on the rewritten URL.
- aid does not rewrite raw `<img>` tags inside markdown. Use markdown image syntax.

The copy keeps the path relative to the source file's folder, minus any leading `../`. For a page at `guide/index.md`, `./light/logo.png` lands at `guide/light/logo.png` in the output, so it does not clash with `./dark/logo.png`. Two references that still map to one output path, such as `./icon.png` and `../icon.png`, fail the build with an asset collision. An image used by two pages is copied once into each page's folder.

aid follows symlinks only when the real path also stays inside the content folder.

## Other linked files

A relative link to a file that is not a page, such as `[the spec](./spec.pdf)` or a YAML data file, works like an image. aid copies the file next to the page and rewrites the link. A query string or `#fragment` on the link is kept. See [links](./links.md).

## Static folder

aid mirrors the static folder into the output root without changes. The folder is `dir.static` in `aid.yaml`, relative to the project folder, and it defaults to `static`. A missing static folder is fine and copies nothing.

This site keeps the published JSON Schema at `site/static/schemas/aid.schema.json`, so the build writes it to `dist/schemas/aid.schema.json`, served at `/aid/schemas/aid.schema.json`.

aid does not rewrite absolute links, so a link to a static file must include `base_path` itself, or use a full URL. Use the static folder for files that other sites or tools fetch by a fixed URL, such as `favicon.ico`, `robots.txt`, or a schema. Use colocated files for anything a page shows.

## Errors

| Condition | Result |
| --- | --- |
| A relative image points at a missing file | `image/missing` in the [broken-reference report](./links.md#broken-reference-check). The build fails unless `on_broken_links` is `warn`. |
| A relative image resolves outside the content folder, directly or through a symlink | The build fails, whatever `on_broken_links` says. |
| A relative link to a non-page file points outside the content folder | `link/outside` in the broken-reference report. |
| Two outputs target the same file | The build fails with an asset collision. |

The escape error names the image and the page:

```text
aid: colocated asset "<abs path>/shared/logo.png" referenced from <abs path>/docs/index.md escapes contentDir (<abs path>/docs). Use a top-level static/ asset or move the file under contentDir.
```

aid records every file it writes into the output folder and fails when two different sources target one path:

```text
aid: asset collision — both "<abs path>/static/llms.txt" and "<generated:llms.txt>" target <abs path>/dist/llms.txt. Rename one of the sources.
```

Common causes:

- a static file with the name of a generated file, such as `static/llms.txt` or `static/index.html`;
- a static file with the path of a page export, such as `static/api.json` next to an OpenAPI page at `/api`;
- two images with the same file name referenced from one page.
