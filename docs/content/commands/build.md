---
title: aid build
description: What aid build writes to the output folder, what --clean does, and the errors that stop a build.
sidebar:
  order: 1
---

`aid build` renders every page under the content folder and writes a static site to the output folder. The dev server runs the same build on every change.

## Use it

```sh
aid build [dir] [--file aid.yaml] [--clean]
```

| Argument | Default | Effect |
| --- | --- | --- |
| `dir` | current folder | Project folder. aid resolves the config file and every `dir.*` path against it. |
| `--file`, `-f` | `aid.yaml` | Config file, relative to the project folder. |
| `--clean` | off | Deletes the output folder before the build. |

The [CLI reference](../reference/cli.md#aid-build) has the generated flag table.

## Output layout

aid writes to `dir.output`, which defaults to `dist`. Each page gets a folder with an `index.html`, and a machine-readable export next to that folder:

| Source | Route | Rendered page | Export |
| --- | --- | --- | --- |
| `docs/index.md` | `/` | `dist/index.html` | `dist/index.md` |
| `docs/guide.md` | `/guide` | `dist/guide/index.html` | `dist/guide.md` |
| `docs/guides/index.md` | `/guides` | `dist/guides/index.html` | `dist/guides.md` |
| `docs/about.html` | `/about` | `dist/about/index.html` | `dist/about.md` |
| `docs/api.yaml` | `/api` | `dist/api/index.html` | `dist/api.json` |
| `docs/events.proto` | `/events` | `dist/events/index.html` | `dist/events.proto` |
| `docs/user.json` | `/user` | `dist/user/index.html` | `dist/user.json` |

The export suffix depends on the source type:

- Markdown and HTML pages export `.md`. aid writes it from the parsed page, so it has no frontmatter and its image links point at the copied images.
- OpenAPI pages export `.json`, the parsed spec.
- Protobuf pages export `.proto`, the source file unchanged.
- JSON Schema pages export `.json`, the parsed schema.

The output root also holds these files:

| File | Written when |
| --- | --- |
| `main.<hash>.css` | Always. The compiled Tailwind stylesheet. |
| `aid-web.<hash>.js` | Always. The browser script for search and the header buttons. When aid runs from source, Bun also writes code-split chunks named `aid-web.<chunk>.<hash>.js`. |
| `aid-mermaid.<hash>.js` | A page has a Mermaid diagram. |
| `aid-openapi.<hash>.js`, `aid-openapi.<hash>.css` | The site has an OpenAPI page. |
| `aid-proto.<hash>.js`, `aid-proto.<hash>.css` | The site has a Protobuf page. |
| `search-index.<hash>.js` | `search.enabled` is `true`, the default. |
| `llms.txt` | Always. See [llms.txt](../llms-txt/index.md). |

The `<hash>` is a hash of the file contents. Unchanged content keeps its file name across builds, and changed content gets a new one.

aid also copies two kinds of files:

- every file under `dir.static` (default `static`), to the same relative path under the output root;
- every image or file that a markdown or HTML page links with a relative path, into that page's output folder. `![logo](./logo.svg)` in `docs/guides/index.md` lands at `dist/guides/logo.svg`.

## Stale files and --clean

Without `--clean`, aid overwrites the files it writes and deletes nothing. After you delete or rename a page, its old folder and export stay in the output. Old hashed assets stay as well.

`--clean` deletes the whole output folder before the build. Use it in CI and before a deploy.

> [!CAUTION]
> `--clean` deletes everything in `dir.output`, including files that aid did not write. Do not point `dir.output` at a folder that holds anything else.

Every build refuses a `dir.output` that is, contains, or sits inside `dir.content`, `dir.static`, or `dir.templates`. `--clean` also refuses a `dir.output` that is not a subdirectory of the project, and it resolves symlinks first, so a link cannot point the delete at your sources. A plain build may still write to a folder outside the project, such as `../public`.

## How it works

aid runs the build in this order:

1. It loads and validates `aid.yaml`. See [configuration](../configuration/index.md).
2. It finds every page under `dir.content` and, at the same time, copies `dir.static` to the output. A path segment that starts with `_` excludes the file.
3. It renders every page in parallel. Markdown and HTML pages copy their colocated images and resolve their relative links during this step.
4. It builds the sidebar from the folder tree, the page frontmatter, and each folder's `_meta.yaml`.
5. It collects every broken link, image, and `_meta.yaml` entry from steps 3 and 4 and reports them together.
6. It writes the browser scripts that at least one page needs.
7. It builds the search index.
8. It builds `llms.txt`.
9. It compiles the Tailwind stylesheet. Tailwind scans the rendered pages for class names.
10. It writes every page, export, `llms.txt`, and the search index.

aid registers every page, export, copied file, `llms.txt`, and the search index by output path. Two different sources that target the same output path stop the build.

## Errors

Any error stops the build, and `aid build` exits 1. aid writes the output only after every page, asset, and bundle is ready, so a failed build leaves the output folder as it was. `--clean` runs first, so with it the folder is gone.

| Cause | Message | Fix |
| --- | --- | --- |
| Two sources map to the same route, for example `docs/guide.md` and `docs/guide/index.md` | `aid: route collision: both "<a>" and "<b>" resolve to <route>` | Rename or move one source. |
| A file or folder name in the content folder holds `#`, `?`, or `%` | `aid: "<file>" maps to route <route>, and "#", "?" and "%" cannot appear in a URL path unescaped` | Rename the file or folder. |
| A folder symlink in the content or static folder points back at that folder or one of its parents | `aid: "<link>" is a symlink to <target>, which contains it` | Remove the symlink. |
| Two sources target the same output file, for example `static/logo.svg` and a `docs/logo.svg` linked from `docs/index.md` | `aid: asset collision: both "<a>" and "<b>" target <path>` | Rename one of the files. |
| A page's image path leaves `dir.content`, for example `![x](../../shared/x.png)` | `aid: colocated asset "<file>" referenced from <page> escapes contentDir (<dir>)` | Move the image under `dir.content`, or put it in `dir.static` and link it by absolute URL. |
| A frontmatter key has the wrong type | `aid: invalid frontmatter in <file>:` followed by the key path and the expected type | Fix the key. See the [frontmatter reference](../reference/frontmatter.md#markdown-frontmatter). |
| Frontmatter is a YAML list or a single value | `aid: invalid frontmatter in <file>: frontmatter must be a YAML mapping, not a scalar or sequence` | Write the frontmatter as `key: value` lines. |
| An `.html` page is a fragment | `aid: HTML page <file> must be a full HTML document with <html> and <body>` | Wrap the content in `<html>` and `<body>`. |
| A link, link fragment, image, or `_meta.yaml` entry does not resolve | `aid: <n> broken references`, then one line per problem | Fix each listed line. |
| `llms.txt` template uses an unknown placeholder | `aid: unknown llms.txt placeholder "{{<name>}}"` | Use one of the placeholders that [llms.txt](../llms-txt/index.md) lists. |
| A `_meta.yaml` file has the wrong shape | `aid: invalid <file>: <details>` | Give each entry only `label` (text) and `order` (number). See the [`_meta.yaml` reference](../reference/frontmatter.md#_metayaml). |

### Broken references

aid does not stop at the first broken reference. It collects them all and prints one report:

```text
aid: 2 broken references
  docs/index.md:5:5  link/missing  link "./nope.md" targets a page that does not exist
  docs/index.md:5:24  link/anchor  link "./guides/intro.md#missing" targets a heading or id that does not exist
```

Each line holds the file, line, and column, a code, and the reason:

| Code | Meaning |
| --- | --- |
| `link/missing` | The link targets a page or file that does not exist. |
| `link/excluded` | The link targets a page excluded by a `_` prefix. |
| `link/outside` | The link points outside `dir.content`. Use an absolute URL instead. |
| `link/anchor` | The link fragment matches no heading or `id` on the target page. aid does not check fragments into OpenAPI and Protobuf pages. |
| `image/missing` | A relative image path matches no file. |
| `nav/unknown-entry` | A `_meta.yaml` key matches no page or folder next to it. |

Set `on_broken_links: warn` in `aid.yaml` to print the report and finish the build anyway. [Links](../content-types/links.md) explains how aid resolves each kind of link.
