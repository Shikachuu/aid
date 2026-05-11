# `llms.txt` generation

aid emits a [`llms.txt`](https://llmstxt.org) discovery file at the site root on every build. The prose is yours; the routing is auto-generated.

## File layout

| Path | Role |
|---|---|
| `<templatesDir>/llms.txt` | **Optional** template. If present, aid uses it verbatim and only substitutes placeholders. |
| `<outputDir>/llms.txt` | Build output. Always emitted (bundled default kicks in when no template exists). |

`<templatesDir>` resolves from `dir.templates` in `aid.yaml`. The default is `""` (no template directory) — drop a path there to activate the override.

```
my-docs/
├── aid.yaml
├── docs/                  # content
├── templates/             # config: dir.templates = "templates"
│   └── llms.txt           # your override
└── dist/
    └── llms.txt           # generated
```

## Config

Only existing top-level fields feed the generator — no `llms_txt` block today.

| `aid.yaml` field | Role in `llms.txt` |
|---|---|
| `name` | H1 / `{{name}}` |
| `description` | Blockquote summary / `{{description}}` |
| `base_url` | When set, every TOC bullet becomes an absolute URL. Empty → path-only. `{{base_url}}` |
| `base_path` | Prepended to every TOC URL (e.g. `/docs/api.json`). |
| `dir.templates` | Where aid looks for `llms.txt`. |
| `dir.output` | Where the rendered `llms.txt` is written. |

## Template variables

Substituted by a tiny `{{name}}` / `{{name:arg}}` engine. Unknown placeholders fail the build with the offending name in the message.

| Placeholder | Expands to |
|---|---|
| `{{name}}` | `config.name` |
| `{{description}}` | `config.description` (empty string if unset) |
| `{{base_url}}` | `config.base_url` (empty string if unset) |
| `{{toc}}` | Grouped TOC of every **non-optional** page (see "Grouping" below) |
| `{{toc:optional}}` | Flat bullet list of pages marked optional, **no `## Optional` heading** — write that yourself in the template |

There is no conditional / loop syntax. If you need a structure the engine can't express, override the template and rely on the placeholders aid provides.

## Bundled default template

When no override exists, aid uses:

```markdown
# {{name}}

> {{description}}

This documentation is available in machine-readable form. Append `.md` to a markdown route or `.json` to an OpenAPI/proto route to receive the parseable variant.

{{toc}}

## Optional

{{toc:optional}}
```

Sites with no optional pages still get a `## Optional` heading with an empty body. Override the template if that bothers you.

## TOC behavior (`{{toc}}`)

- **Grouping**: by the first path segment under the content root.
  - `docs/index.md`, `docs/api.yaml` → grouped under `## Docs` (root-level files).
  - `docs/guides/intro.md` → `## Guides`.
  - `docs/getting-started/x.md` → `## Getting Started` (slugs are title-cased, `-` / `_` become spaces).
- **Order**: `Docs` is pinned first; all other groups alphabetical. Inside each group, bullets are sorted by route path.
- **Bullet shape**: `- [Title](url): description` — the `: description` suffix is omitted when none exists.
- **Title source**: frontmatter `title` first, then the page's H1, then the filename.
- **Description source**: markdown frontmatter `description`, or OpenAPI `info.description`. Proto: none today.

## Link URLs

Every bullet links to the **machine-readable** variant, not the rendered HTML.

| Page kind | URL suffix |
|---|---|
| `.md` (markdown) | `.md` |
| `.html` | `.md` |
| OpenAPI (`.yaml` / `.yml` / `.json`) | `.json` |
| `.proto` | `.json` |

The root route `/` collapses to `/index.<suffix>` to match the file aid actually writes.

Examples (assuming `base_url: "https://docs.example.com"`, `base_path: "/docs"`):

| Route | TOC URL |
|---|---|
| `/` (markdown) | `https://docs.example.com/docs/index.md` |
| `/api` (openapi) | `https://docs.example.com/docs/api.json` |
| `/guides/intro` (markdown) | `https://docs.example.com/docs/guides/intro.md` |

With `base_url` unset the same routes emit path-only URLs (`/docs/index.md`, `/docs/api.json`, …).

## Marking pages optional

Mark a markdown page so it ships in `{{toc:optional}}` instead of `{{toc}}`:

```markdown
---
title: Changelog
llms: optional
---

# Changelog
```

The only accepted value is the string `optional`. Non-markdown pages (OpenAPI, proto, HTML) cannot be marked optional in v1.

## Custom template example

`templates/llms.txt`:

```markdown
# {{name}}

> {{description}}

Welcome. The canonical docs live at {{base_url}}. All routes below link to
machine-readable variants — feel free to fetch them directly.

{{toc}}

## Reference (deep-dive)

{{toc:optional}}
```

The auto-generated `{{toc}}` block already contains `## Docs`, `## Guides`, etc. — don't wrap it in another H2.
