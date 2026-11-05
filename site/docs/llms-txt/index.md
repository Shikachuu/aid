---
title: llms.txt
description: How aid writes an llms.txt file at the site root, how to override its template, and how pages are grouped and linked in it.
sidebar:
  order: 10
---

aid writes an [llms.txt](https://llmstxt.org) file to the output root on every build. It lists every page with a link to the page's machine-readable export. You write the prose in a template, and aid fills in the page list.

## Use it

Set `name` and `description` in `aid.yaml` and build. aid writes `dist/llms.txt` from its bundled template:

```md
# {{name}}

> {{description}}

This documentation is available in machine-readable form. Append `.md` to a markdown route, `.json` to an OpenAPI or JSON Schema route, or `.proto` to a Proto route to receive the parseable variant.

{{toc}}

## Optional

{{toc:optional}}
```

The bundled template always writes the `## Optional` heading, even when no page is optional. Override the template to remove it.

## Configure it

aid reads these `aid.yaml` keys. There is no `llms_txt` block. The [configuration reference](../reference/configuration.md#top-level-keys) lists their types.

| Key | Role in llms.txt |
| --- | --- |
| `name` | `{{name}}` |
| `description` | `{{description}}`, empty when unset |
| `base_url` | Makes every page URL absolute. Also `{{base_url}}`, empty when unset. |
| `base_path` | Prefixes every page URL. |
| `dir.templates` | The folder that holds the template override. |

## Override the template

Set `dir.templates` to a folder relative to the project folder and put an `llms.txt` file in it. aid uses that file as written and replaces only the placeholders. Without the file, or with `dir.templates` unset, aid uses the bundled template.

This site sets `dir.templates: templates` and keeps its template in `site/templates/llms.txt`:

```md
# {{name}}

> {{description}}

aid builds a static documentation site from markdown, HTML, OpenAPI, and Protobuf files with one binary. Every link below points at the machine-readable variant of a page: `.md` for markdown and HTML pages, `.json` for OpenAPI pages, `.proto` for Protobuf pages.

{{toc}}

## Optional

Contributor notes: architecture, build pipeline, release process, and repository conventions.

{{toc:optional}}
```

## Placeholders

| Placeholder | Replaced with |
| --- | --- |
| `{{name}}` | `name` from `aid.yaml` |
| `{{description}}` | `description` from `aid.yaml`, or nothing |
| `{{base_url}}` | `base_url` from `aid.yaml`, or nothing |
| `{{toc}}` | One `##` section per sidebar group with the pages that are not optional |
| `{{toc:optional}}` | A flat list of the optional pages, without a heading |

A placeholder name aid does not know fails the build:

```text
aid: unknown llms.txt placeholder "{{version}}"
```

The template has no conditionals or loops. `{{toc}}` already writes its own `##` headings, so do not put it under another `##` heading.

## Sections

`{{toc}}` follows the [sidebar](../content-types/navigation.md):

- `## Docs` comes first and holds the top-level pages, including top-level folders that hold only a landing page.
- Each top-level group follows as its own section, in sidebar order, headed by the group's sidebar label. Pages inside nested groups go into the section of their top-level group.
- Inside a section, pages keep their sidebar order, with the group's landing page first.
- aid leaves out a section when all its pages are optional.

`{{toc:optional}}` lists the optional pages from every section in the same order.

## Optional pages

A markdown page with `llms: optional` in its frontmatter moves from `{{toc}}` to `{{toc:optional}}`:

```yaml
---
title: Release process
llms: optional
---
```

The only accepted value is `optional`. HTML, OpenAPI, and proto pages have no frontmatter and cannot be marked optional. This site marks every page under `contributing/` optional.

## Page lines

Each page is one bullet:

```md
- [Title](url): description
```

aid drops the `: description` part when the page has no description.

- The title is the page title, the same one search shows. A sidebar label from `_meta.yaml` or `sidebar.label` does not change it, so this site's proto example appears as `aid.example.v1`.
- The description comes from frontmatter `description` for markdown, `<meta name="description">` for HTML, `info.description` for OpenAPI, and the first paragraph of the comment above `package` for proto.
- The URL points at the page's export, not its HTML: `.md` for markdown and HTML pages, `.json` for OpenAPI pages, and `.proto` for proto pages. The root page links to `index.<ext>`.

aid builds the URL from `base_path` and the export path. With `base_url` set, it resolves that path against `base_url`, so the link is absolute. `base_url` is an origin. aid drops any path in it and uses `base_path` instead.

| `base_url` | `base_path` | Page | URL |
| --- | --- | --- | --- |
| unset | `/` | `docs/guides/intro.md` | `/guides/intro.md` |
| unset | `/docs` | `docs/api.yaml` | `/docs/api.json` |
| `https://shikachuu.github.io` | `/aid` | `site/docs/index.md` | `https://shikachuu.github.io/aid/index.md` |

## Limitations

> [!WARNING]
> Not implemented yet: the "Open in AI" button. Pages do not render it, and the `ai_targets` key in `aid.yaml` is not read.
