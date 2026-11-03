---
title: Overview
description: What aid is, which sources it renders, and where to start reading.
sidebar:
  order: 0
---

![aid logo](./logo.svg)

aid is a documentation generator that ships as one executable. It turns a folder of source files into a static site that any web server can host.

aid renders five source types into one site with one theme:

- Markdown pages (`.md`), with GitHub-flavored markdown, highlighted code blocks, Mermaid diagrams, and callouts.
- HTML pages (`.html`), written as full HTML documents.
- OpenAPI specs (`.yaml`, `.yml`, `.json`), which aid detects by their top-level `openapi:` or `swagger:` key.
- Protobuf files (`.proto`).
- JSON Schema files (`.json`, `.yaml`, `.yml`), which aid detects by their `json-schema.org` `$schema` key.

Every build also produces:

- a sidebar built from the folder tree and `_meta.yaml` files;
- a search index over every page, whatever its source type;
- an `llms.txt` file plus a machine-readable copy of each page (`.md`, `.json`, or `.proto`).

The same executable runs a dev server with live reload (`aid dev`), lints the sources (`aid lint`), and formats them (`aid fmt`).

> [!WARNING]
> aid is pre-release. Some commands and settings exist but do nothing yet, for example `aid init`. The [status page](./status.html) lists what works and what does not.

## Where to go next

- [Getting started](./getting-started/index.md): build a first site by hand.
- [Installation](./getting-started/installation.md): set up aid from source.
- [Commands](./commands/index.md): what each `aid` command does.
- [Configuration](./configuration/index.md): how `aid.yaml` loads and what each key changes.
- [Content types](./content-types/index.md): markdown, HTML, OpenAPI, Protobuf, JSON Schema, images, navigation, and links.
- [Linting](./linting/index.md) and [formatting](./formatting/index.md): check and fix sources with the bundled tools.
- [Dev server](./dev-server/index.md): preview the site with live reload.
- [Theming](./theming/index.md): change colors and fonts with Tailwind.
- [Search](./search/index.md): the built-in search box and how it ranks pages.
- [llms.txt](./llms-txt/index.md): the file aid writes for language models.
- [Deployment](./deployment/index.md): host the built site.
- [Reference](./reference/index.md): generated tables for the CLI, `aid.yaml`, and frontmatter.
- [Contributing](./contributing/index.md): work on aid itself.
