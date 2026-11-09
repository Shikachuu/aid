---
title: Theming
description: How aid compiles your Tailwind stylesheet, which design tokens and class hooks the bundled theme exposes, and how to override them.
sidebar:
  order: 0
---

aid styles every page with one Tailwind 4 stylesheet. You change the look by overriding the bundled theme's design tokens and by styling its `.aid-*` class hooks from your own stylesheet.

## Use it

Create `main.css` next to `aid.yaml`. This site's own stylesheet changes one token, the accent color:

```css
@import "tailwindcss";
@import "aid/theme";

@theme {
  --color-aid-accent: oklch(55% 0.13 175);
}
```

Run `aid build` or `aid dev`. aid compiles the stylesheet, writes it as `main.<hash>.css` in the output folder, and links it from every page.

## The stylesheet entry

The `stylesheet` key in `aid.yaml` names the entry file, relative to the project directory or as an absolute path. It defaults to `main.css`. See [the configuration reference](../reference/configuration.md).

- When the file exists, aid compiles it.
- When the default `main.css` does not exist, aid compiles its bundled theme, `src/theme/main.css` in the aid repository.
- When a `stylesheet` you set does not exist, the build stops with an error that names the path.

`@import "tailwindcss";` resolves to the copy of Tailwind inside aid. Your project needs no `package.json` and no `npm install`.

`aid dev` rebuilds when the stylesheet file changes, but not when a file it imports changes. See [the dev server page](../dev-server/index.md#what-the-watcher-watches).

`aid lint` checks the stylesheet for invalid CSS and compiles it with Tailwind, so an unknown utility in `@apply` fails the lint run before it fails a build. See [the CSS checks](../linting/index.md#css-checks).

### Why `@import "aid/theme"` matters

Before it compiles, aid replaces `@import "aid/theme";` with the full text of the bundled theme. The bundled theme holds the design tokens and every rule for the `.aid-*` classes.

Your stylesheet replaces the bundled theme. If it does not import `aid/theme`, the pages keep their `.aid-*` classes but nothing styles them: no sidebar grid, no header layout, no callout colors. Keep the import, and put your overrides after it so they win.

## Design tokens

The bundled theme defines these tokens in `@theme`. Tailwind turns each one into a CSS variable and a utility, such as `bg-aid-bg` or `text-aid-accent`.

| Token | Default | Used for |
| --- | --- | --- |
| `--color-aid-bg` | `oklch(99% 0 0)` | page and dropdown background |
| `--color-aid-text` | `oklch(20% 0 0)` | body text |
| `--color-aid-muted` | `oklch(50% 0 0)` | secondary text, hover backgrounds, inline code background |
| `--color-aid-border` | `oklch(90% 0 0)` | borders and dividers |
| `--color-aid-accent` | `oklch(60% 0.15 250)` | the current nav link, and the accent on API and proto pages |
| `--color-aid-note` | `oklch(55% 0.15 250)` | `NOTE` callouts |
| `--color-aid-tip` | `oklch(55% 0.14 150)` | `TIP` callouts |
| `--color-aid-important` | `oklch(55% 0.18 300)` | `IMPORTANT` callouts |
| `--color-aid-warning` | `oklch(55% 0.13 75)` | `WARNING` callouts |
| `--color-aid-caution` | `oklch(55% 0.19 25)` | `CAUTION` callouts |
| `--font-aid-sans` | system UI font stack | body text |
| `--font-aid-mono` | system monospace stack | code |

Write colors as `oklch()`. With the default `theme.dark_mode: auto`, aid derives the dark palette from `oklch()` tokens only. See [dark mode](./dark-mode.md).

### API and proto pages

OpenAPI pages render with Scalar, and proto pages render with aid's proto UI. Each has its own variables. The bundled theme maps your tokens onto them, so one override changes all page types.

| aid token | Scalar variable, on `.aid-page-openapi` | Proto UI variable, on `.aid-page-proto .proto-root` |
| --- | --- | --- |
| `--color-aid-text` | `--scalar-color-1` | `--proto-color-text` |
| `--color-aid-muted` | `--scalar-color-2` | `--proto-color-muted` |
| `--color-aid-bg` | `--scalar-background-1` | `--proto-color-bg` |
| `--color-aid-border` | `--scalar-border-color` | `--proto-color-border` |
| `--color-aid-accent` | `--scalar-color-accent` | `--proto-color-accent` |
| `--font-aid-sans` | `--scalar-font` | `--proto-font-sans` |
| `--font-aid-mono` | `--scalar-font-code` | `--proto-font-mono` |

The theme sets these inside `:where(...)`, which has zero specificity, so any rule you write for the same variable wins.

## Which classes Tailwind keeps

Tailwind only emits utilities that it finds in the files it scans. aid points it at three sources:

- aid's own theme components.
- `dir.templates`, when set: every `.ts`, `.tsx`, and `.html` file in it.
- The final HTML of every page aid renders, layout included.

Because aid scans the rendered HTML, a Tailwind class in raw HTML inside a markdown page, or in an HTML page, works without extra config. A class that appears in none of these sources is not in the output.

## Class hooks

Every element aid renders carries a stable `.aid-*` class. Style these, not the element structure.

| Class | Element |
| --- | --- |
| `aid-body` | `<body>` |
| `aid-header` | top bar |
| `aid-brand` | site name link in the header |
| `aid-search` | search box wrapper |
| `aid-search-results` | search results dropdown |
| `aid-search-result`, `aid-search-result-title`, `aid-search-result-url`, `aid-search-badge` | one search result and its parts |
| `aid-shell` | grid that holds the sidebar and the main column |
| `aid-sidebar` | sidebar `<aside>` |
| `aid-sidebar-disclosure`, `aid-sidebar-toggle` | the `<details>` around the nav and its "Menu" `<summary>`; below the `md` breakpoint (48rem) the nav collapses behind the summary, and from `md` up the summary is hidden and the nav always shows |
| `aid-nav` | sidebar `<nav>` |
| `aid-nav-list`, `aid-nav-item`, `aid-nav-group` | nav lists and items; `aid-nav-group` marks an item with children |
| `aid-nav-link`, `aid-nav-label` | a nav link, or a folder label without a page; the current page's link has `aria-current="page"` |
| `aid-main` | `<main>` |
| `aid-page` | the `<article>` of every page |
| `aid-page-markdown`, `aid-page-html`, `aid-page-openapi`, `aid-page-proto`, `aid-page-jsonschema` | the page kind, on the same `<article>` |
| `aid-callout`, `aid-callout-note`, `aid-callout-tip`, `aid-callout-important`, `aid-callout-warning`, `aid-callout-caution` | a callout and its type |
| `aid-callout-title` | the callout title line |
| `aid-heading-link`, `aid-heading-anchor` | the `#` link appended to each heading |
| `aid-footer` | `<footer>` |
| `aid-schema-meta` | the chip row under a JSON Schema page title |
| `aid-schema-fields`, `aid-schema-children` | the top-level field list, and the indented list of nested fields |
| `aid-schema-field`, `aid-schema-field-summary`, `aid-schema-field-name`, `aid-schema-field-body` | one collapsible field `<details>`, its summary row, its name, and its body |
| `aid-schema-chip` | every chip |
| `aid-schema-chip-required`, `aid-schema-chip-deprecated`, `aid-schema-chip-nullable`, `aid-schema-chip-readonly`, `aid-schema-chip-writeonly`, `aid-schema-chip-type`, `aid-schema-chip-format`, `aid-schema-chip-pattern`, `aid-schema-chip-dialect` | the chip kind, on the same `<span>` |
| `aid-schema-title` | a field or definition `title` |
| `aid-schema-type-line`, `aid-schema-type` | the `Type:` line and the type name |
| `aid-schema-description` | a rendered `description` |
| `aid-schema-value`, `aid-schema-value-label`, `aid-schema-value-item` | an allowed values, value, default, or example line and its parts |
| `aid-schema-variants`, `aid-schema-variants-label` | a `oneOf`, `anyOf`, or `allOf` group and its label |
| `aid-schema-constraints`, `aid-schema-constraints-summary`, `aid-schema-constraint-list`, `aid-schema-constraint` | the constraints toggle, its summary, its `<dl>`, and one keyword row |
| `aid-schema-example` | the schema example section |
| `aid-schema-definitions`, `aid-schema-definition`, `aid-schema-definition-title` | the definitions section, one definition, and its heading |

## Style the hooks

The aid repository writes CSS with Tailwind directives only: `@theme` for tokens, `@apply` for rules, and `@layer` to order them. Follow the same style in your stylesheet. Put rules for the class hooks in `@layer components`, after the `aid/theme` import, so they come after the bundled rules in the same layer:

```css
@import "tailwindcss";
@import "aid/theme";

@theme {
  --color-aid-accent: oklch(55% 0.13 175);
}

@layer components {
  .aid-footer {
    @apply p-8 text-sm text-aid-muted;
  }

  .aid-callout {
    @apply rounded-md;
  }

  .aid-schema-chip-required {
    @apply bg-aid-caution text-aid-bg;
  }
}
```

## Limitations

> [!WARNING]
> Not implemented yet: component and template overrides. You cannot replace the header, sidebar, footer, or page layout. `dir.templates` holds only an `llms.txt` template, plus files Tailwind scans for class names. Change the look through tokens and class hooks only.
