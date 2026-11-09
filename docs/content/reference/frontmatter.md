---
title: Frontmatter reference
description: Markdown frontmatter keys and the _meta.yaml sidebar file.
sidebar:
  order: 3
---

## Markdown frontmatter

A markdown page may start with a YAML block between `---` lines. Other keys are allowed and ignored. Malformed YAML or a wrong type fails the build.

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | string (non-empty) | none | Page title. Used in &lt;title&gt;, the sidebar, search and llms.txt. |
| `description` | string | none | Short summary. Used in &lt;meta name="description"&gt; and llms.txt. |
| `llms` | `optional` | none | Move this page to the `## Optional` section of llms.txt. |
| `sidebar.label` | string (non-empty) | none | Sidebar label. Defaults to the page title. |
| `sidebar.order` | number | none | Sort key among siblings, ascending. Entries without one sort last, by name. |

## `_meta.yaml`

Any content folder may hold a `_meta.yaml` that maps a child name (a page file name without its extension, or a subfolder name) to sidebar overrides. In the content root, the key `index` addresses the home page. An entry here wins over the page's own `sidebar` frontmatter. A key that matches nothing is a `nav/unknown-entry` problem, which fails the build unless `on_broken_links` is `warn`.

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `label` | string (non-empty) | none | Sidebar label. Defaults to the page title. |
| `order` | number | none | Sort key among siblings, ascending. Entries without one sort last, by name. |

```yaml
getting-started: { order: 1 }
api: { label: HTTP API, order: 2 }
```
