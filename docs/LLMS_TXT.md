# `llms.txt` generation

aid writes a [`llms.txt`](https://llmstxt.org) discovery file at the site root on every build. You write the prose in a template, and aid generates the table of contents.

## File layout

| Path | Role |
| --- | --- |
| `<templatesDir>/llms.txt` | Optional template. If it exists, aid uses it as-is and substitutes only the placeholders. |
| `<outputDir>/llms.txt` | Build output. aid always writes it and uses the bundled default when no template exists. |

`<templatesDir>` resolves from `dir.templates` in `aid.yaml`. The default is `""`, which means no template directory. Set it to a directory path to enable the override.

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

The generator reads only existing top-level fields. There is no `llms_txt` config block.

| `aid.yaml` field | Role in `llms.txt` |
| --- | --- |
| `name` | H1 and `{{name}}` |
| `description` | Blockquote summary and `{{description}}` |
| `base_url` | When set, every table of contents (TOC) bullet uses an absolute URL. When unset, bullets use path-only URLs. Also available as `{{base_url}}`. |
| `base_path` | aid prepends it to every TOC URL (for example `/docs/api.json`). |
| `dir.templates` | Where aid looks for `llms.txt`. |
| `dir.output` | Where aid writes the rendered `llms.txt`. |

## Template variables

aid substitutes placeholders of the form `{{name}}` and `{{name:arg}}`. An unknown placeholder fails the build, and the error names it.

| Placeholder | Expands to |
| --- | --- |
| `{{name}}` | `config.name` |
| `{{description}}` | `config.description` (empty string if unset) |
| `{{base_url}}` | `config.base_url` (empty string if unset) |
| `{{toc}}` | Grouped TOC of every page not marked optional (see "TOC behavior" below) |
| `{{toc:optional}}` | Flat bullet list of pages marked optional. It has no `## Optional` heading, so write that heading in the template yourself. |

The engine has no conditional or loop syntax. If you need a structure the engine cannot express, override the template and use the placeholders aid provides.

## Bundled default template

When no override exists, aid uses:

```markdown
# {{name}}

> {{description}}

This documentation is available in machine-readable form. Append `.md` to a markdown route, `.json` to an OpenAPI route, or `.proto` to a Proto route to receive the parseable variant.

{{toc}}

## Optional

{{toc:optional}}
```

Sites with no optional pages still get a `## Optional` heading with an empty body. Override the template to remove the empty heading.

## TOC behavior (`{{toc}}`)

aid groups pages by the first path segment under the content root:

- Root-level files such as `docs/index.md` and `docs/api.yaml` go under `## Docs`.
- `docs/guides/intro.md` goes under `## Guides`.
- `docs/getting-started/x.md` goes under `## Getting Started`. aid title-cases the slug and turns `-` and `_` into spaces.

`Docs` comes first, and the other groups follow in alphabetical order. aid sorts the bullets in each group by route path.

Each bullet has the shape `- [Title](url): description`. aid omits the `: description` suffix when the page has no description.

The title comes from frontmatter `title` (or the HTML `<title>`), then the page's H1, then the filename.

The description comes from markdown frontmatter `description`, HTML `<meta name="description">`, OpenAPI `info.description`, or the first paragraph of a proto file's package comment.

## Link URLs

Every bullet links to the machine-readable variant, not the rendered HTML.

| Page kind | URL suffix |
| --- | --- |
| `.md` (markdown) | `.md` |
| `.html` | `.md` |
| OpenAPI (`.yaml` / `.yml` / `.json`) | `.json` |
| `.proto` | `.proto` |

The root route `/` maps to `/index.<suffix>` to match the file aid writes.

Examples (assuming `base_url: "https://docs.example.com"`, `base_path: "/docs"`):

| Route | TOC URL |
| --- | --- |
| `/` (markdown) | `https://docs.example.com/docs/index.md` |
| `/api` (openapi) | `https://docs.example.com/docs/api.json` |
| `/guides/intro` (markdown) | `https://docs.example.com/docs/guides/intro.md` |

With `base_url` unset, the same routes get path-only URLs (`/docs/index.md`, `/docs/api.json`, and so on).

## Marking pages optional

Mark a markdown page so it appears in `{{toc:optional}}` instead of `{{toc}}`:

```markdown
---
title: Changelog
llms: optional
---

# Changelog
```

The only accepted value is the string `optional`. Non-markdown pages (OpenAPI, proto, HTML) cannot be marked optional in v0.1.

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

The generated `{{toc}}` block already has its own H2 headings (`## Docs`, `## Guides`, and so on), so do not wrap it in another H2.
