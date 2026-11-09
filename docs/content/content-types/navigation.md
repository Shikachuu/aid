---
title: Navigation
description: How aid builds the sidebar from the content folder, and how frontmatter and _meta.yaml files set labels and order.
sidebar:
  order: 8
---

aid builds the sidebar from the folder structure of the content folder. Every page appears in it. Folders become groups, and labels and order come from `_meta.yaml` files and page frontmatter.

## Folders and pages

- A page becomes a link with its title as the label.
- A folder becomes a group with its pages and subfolders inside.
- A folder's landing page is its `index` page, such as `guides/index.md`, or a page with the folder's name next to the folder, such as `guides.md` next to `guides/`. The landing page is the group's link. Both at once fail the build with a route collision.
- A folder that holds only its landing page renders as a plain link, not a group.
- A folder without a landing page shows a label without a link. aid builds that label from the folder name in title case: `getting-started` becomes "Getting Started".

The link to the current page carries `aria-current="page"`. The bundled theme styles it.

## Order and labels

Each page and folder has a label and an optional order. aid takes them from the first source that sets them:

1. the entry for the page or folder in the `_meta.yaml` of the folder that contains it;
2. the page's frontmatter `sidebar.label` and `sidebar.order`, for a folder the frontmatter of its landing page;
3. the page title as the label, or the title-cased name for a folder without a landing page.

aid sorts siblings by `order`, ascending. Entries without an `order` come after every entry with one. Ties sort by name, except that the root page comes before other entries with the same order.

### Frontmatter

A markdown page sets its own label and order:

```yaml
---
title: Installing the command line tool
sidebar:
  label: Installation
  order: 2
---
```

HTML, OpenAPI, and proto pages have no frontmatter. Set their label and order in `_meta.yaml`.

### _meta.yaml

A `_meta.yaml` file in any content folder maps the names of the pages and subfolders in that folder to `label` and `order`. A page's name is its file name without the extension. In the content root, the key `index` addresses the root page. A `_meta.yaml` entry wins over frontmatter. The [frontmatter reference](../reference/frontmatter.md#_metayaml) lists the keys.

This site's `docs/content/_meta.yaml` orders every top-level section:

```yaml
index: { order: 0 }
getting-started: { order: 1 }
commands: { order: 2 }
configuration: { order: 3 }
content-types: { order: 4 }
linting: { order: 5 }
formatting: { order: 6 }
dev-server: { order: 7 }
theming: { order: 8 }
search: { order: 9 }
llms-txt: { order: 10, label: llms.txt }
deployment: { order: 11 }
status: { order: 12 }
reference: { order: 13 }
contributing: { order: 14 }
```

`docs/content/content-types/_meta.yaml` labels the [proto example](./proto-example.proto) page, which has no frontmatter and would otherwise show its package name, `aid.example.v1`:

```yaml
proto-example: { label: Proto example, order: 5 }
```

To order or label a folder's landing page, use the folder's entry in the parent `_meta.yaml`. The key `index` only works in the content root.

## Errors

- A `_meta.yaml` key that matches no page or folder next to it is a `nav/unknown-entry` problem in the [broken-reference report](./links.md#broken-reference-check). The build fails unless `on_broken_links` is `warn`.
- A `_meta.yaml` that is not a mapping of names to `label` and `order`, including an entry with any other key, fails the build:

```text
aid: invalid <abs path>/docs/_meta.yaml: <validation error>
```

## llms.txt

[llms.txt](../llms-txt/index.md) follows the sidebar. Each top-level group becomes a section with the group's label, in sidebar order.

## Narrow screens

On screens narrower than 48rem, the sidebar sits above the page and collapses behind a "Menu" button. It needs no JavaScript.

## Limitations

> [!WARNING]
> Not supported: collapsible groups, hiding a page from the sidebar, external links in the sidebar, and a `nav` key in `aid.yaml`.
