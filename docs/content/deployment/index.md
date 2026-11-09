---
title: Deployment
description: Host the output of aid build on any static file server, with the settings a sub-path host needs.
sidebar:
  order: 0
---

`aid build` writes plain static files: HTML pages, CSS, JavaScript, the machine-readable exports, and `llms.txt`. aid has no server component and no host-specific output, so any server that returns files from a folder can host the site. [GitHub Pages](./github-pages.md) has a workflow that builds and deploys a site from your repository.

## Before you deploy

- Build with `aid build --clean`. Without `--clean`, pages you deleted stay in the output folder and get deployed.
- Set `base_path` when the host serves the site under a sub-path. A site at `https://example.com/docs/` needs `base_path: /docs`. Without it, every link, stylesheet, and script points at the domain root and fails to load.
- Set `base_url` to the site origin, for example `https://example.com`, so the links in `llms.txt` are absolute.
- Upload the contents of `dir.output` (default `dist/`), not the folder itself.

[Paths and URLs](../configuration/paths-and-urls.md) explains how `base_path` and `base_url` combine.

## What the host must do

aid writes each page as `<route>/index.html` and links to it without a trailing slash, for example `/docs/guides/setup`. The host must answer that URL with `guides/setup/index.html`, either directly or through a redirect to `/docs/guides/setup/`.

Files named `<name>.<hash>.<ext>`, such as `main.<hash>.css`, get a new name when their content changes. A host may cache them for a long time. Pages, exports, and `llms.txt` keep their names across builds.

> [!WARNING]
> Not implemented yet: aid does not generate a `404.html`, `sitemap.xml`, `robots.txt`, or canonical link tags. To ship a `404.html` or `robots.txt`, put it in `dir.static`; aid copies it to the output root unchanged.
