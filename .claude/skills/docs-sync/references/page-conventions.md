# Page conventions for site/docs

The site is built by aid itself (`bun run docs:build`), so every rule below is enforced by the build, by `bun run docs:lint`, or by the generated-reference check.

## Frontmatter

Every markdown page starts with:

```yaml
---
title: Sentence case title
description: One sentence that says what the page covers. Used in <meta>, search, and llms.txt.
sidebar:
  order: 2
---
```

- `sidebar.order` sorts the page among its siblings. Folder order lives in the parent folder's `_meta.yaml`, which wins over frontmatter.
- Contributor pages (everything under `contributing/`) also set `llms: optional`, so llms.txt lists them under its optional section.
- HTML pages take their title from `<title>` and their description from `<meta name="description">`.

## Headings

- Do not write an H1. aid renders the frontmatter `title` as the H1, and markdownlint MD025 counts the frontmatter title as one.
- Start the body at `##`. Do not skip levels.

## Links

- Link to other pages by their source file with a relative path: `[dev server](../dev-server/index.md)`, `[markdown](./markdown.md#frontmatter)`. aid rewrites these to route URLs and prefixes `base_path`.
- Never hard-code `/aid/...` or any absolute site path. Absolute paths are not rewritten.
- A folder's landing page is its `index.md`; link to `./folder/index.md`.
- Fragments must match a heading slug on the target page (lowercase, spaces to `-`, punctuation dropped). The build fails on a missing page, a missing heading, or a missing image.
- Raw `<a href>` inside markdown is not rewritten. Use markdown links.
- Link out to the generated pages in `reference/` instead of copying their tables. Never edit `reference/**` by hand.

## Callouts

GitHub alert syntax, marker alone on its line:

```md
> [!WARNING]
> Not implemented yet: `aid init` prints an error and exits 1.
```

- `NOTE` for context the reader may skip, `TIP` for a shortcut, `IMPORTANT` for a requirement, `WARNING` for stubs, gaps, and data loss, `CAUTION` for irreversible actions.
- Mark every stub with a `WARNING` that starts "Not implemented yet:".

## Code blocks

- Always give a language. Shiki highlights these: ts, tsx, js, jsx, json, json5, yaml, toml, html, css, md, mdx, bash, sh, shell, python, go, rust, proto, sql, docker, diff, http. Use `text` for anything else, such as directory trees or CLI output.
- Use `sh` for commands. Show the command a reader runs, then its output in a separate `text` block if the output matters.
- Use `mermaid` fences for diagrams. aid renders them in the browser.

## Images and files

- Put images next to the page that uses them and link them relatively: `![aid logo](./logo.svg)`. aid copies them next to the rendered page.
- Files outside `site/docs` cannot be linked relatively. Link to the repository on GitHub instead.

## Accuracy

- Check every claim against the code before writing it. Contributor pages may cite paths such as `src/core/pipeline.ts`.
- Do not repeat these known-wrong claims from older notes:
  - an index route ends in `/` (it does not: `guides/index.md` is `/guides`);
  - the `.md` export is the original source (it is re-serialized from the parsed tree, without frontmatter);
  - the dev server answers paths outside `base_path` with 404 (it redirects with 302);
  - the dev server watches files the stylesheet imports (it watches only the stylesheet itself);
  - the browser search runtime uses `MiniSearch.loadJSON` (it uses `loadJS`).
