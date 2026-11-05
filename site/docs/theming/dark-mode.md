---
title: Dark mode
description: How theme.dark_mode derives, keeps, or strips the dark palette, and how off pins the page, Mermaid, and OpenAPI pages to light.
sidebar:
  order: 1
---

aid switches to a dark palette when the reader's OS or browser prefers dark, through `@media (prefers-color-scheme: dark)`. The `theme.dark_mode` key in `aid.yaml` decides where that palette comes from.

```yaml
theme:
  dark_mode: auto # auto | manual | off
```

| Value | Effect |
| --- | --- |
| `auto` (default) | aid derives a dark value for every `oklch()` color token and appends it to your stylesheet. |
| `manual` | aid leaves your stylesheet as written. You write the dark values. |
| `off` | aid removes every `prefers-color-scheme: dark` block from your stylesheet and keeps the whole page light. |

See [the `theme` keys](../reference/configuration.md#theme) in the configuration reference.

## Auto

Before Tailwind compiles the stylesheet, aid reads every `@theme` block in it, including the bundled theme that `@import "aid/theme";` pulls in. For each `--color-*` token whose value is `oklch(L C H)` or `oklch(L C H / A)`, aid inverts the lightness: L becomes 100 - L. Chroma, hue, and alpha stay the same. aid appends the results at the end of the stylesheet:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-aid-bg: oklch(1% 0 0);
    --color-aid-text: oklch(80% 0 0);
    --color-aid-muted: oklch(50% 0 0);
    --color-aid-border: oklch(10% 0 0);
    --color-aid-accent: oklch(40% 0.15 250);
    /* ... one line per oklch() color token */
  }
}
```

aid reads lightness as a percentage (`60%`) or a fraction (`0.6`), and always writes a percentage. A mid-range token such as `--color-aid-muted` at 50% keeps the same value in dark mode. Tokens that are not colors, such as `--font-aid-sans`, are skipped.

A `--color-*` token in any other format, such as `#ff0000` or `rgb()`, gets no dark value and keeps its light value in dark mode. aid prints a warning for each one during the build. Convert hex, `rgb()`, and `hsl()` tokens to `oklch()`, or use `manual`.

```text
dark-mode auto-derivation skipped --color-brand: only oklch() colours are supported. Use theme.dark_mode: "manual" or convert to oklch.
```

> [!NOTE]
> In `auto` mode, aid appends the derived block after everything you wrote. If you also write your own dark value for a token, the derived value wins. Switch to `manual` to control the dark palette yourself.

## Manual

With `manual`, aid does not add or remove anything. Write the dark values as a `:root` rule inside a media query:

```css
@import "tailwindcss";
@import "aid/theme";

@theme {
  --color-aid-accent: oklch(55% 0.13 175);
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-aid-bg: oklch(18% 0.01 250);
    --color-aid-text: oklch(92% 0 0);
    --color-aid-muted: oklch(65% 0 0);
    --color-aid-border: oklch(30% 0 0);
    --color-aid-accent: oklch(75% 0.13 175);
  }
}
```

Use `:root`, not `@theme`, inside the media query. Tailwind 4 moves `@theme` content out of `@media` blocks when it compiles, so a `@theme` block inside the query would apply in light mode too. Any token you leave out keeps its light value in dark mode.

## Off

With `off`, aid deletes every `@media (prefers-color-scheme: dark) { ... }` block from the stylesheet text before Tailwind compiles it. Every page carries `data-aid-dark-mode="off"` on its `<html>` element, and the rest of the page follows that attribute:

- The bundled theme sets `color-scheme: light` instead of `light dark`, so the Shiki code colors, which Shiki writes as `light-dark(<light>, <dark>)`, resolve to their light values.
- Mermaid diagrams use Mermaid's `default` theme on any OS (see [Mermaid diagrams](#mermaid-diagrams)).
- OpenAPI pages tell Scalar to stay in light mode.

Tailwind `dark:` utilities in your HTML or templates still work. Tailwind generates their `prefers-color-scheme: dark` queries after aid has stripped the stylesheet, so aid does not remove them.

The attribute holds `auto` or `manual` for the other two values. Target it from your own CSS, for example `:root[data-aid-dark-mode="off"]`.

## Mermaid diagrams

aid renders Mermaid diagrams in the browser. It picks Mermaid's `dark` theme when the OS prefers dark and the `default` theme otherwise. When the OS color scheme changes, aid renders every diagram on the page again with the matching theme. With `theme.dark_mode: off`, aid always picks the `default` theme.

## Limitations

> [!WARNING]
> Not implemented yet: a dark mode toggle. The header has no toggle button, and the only switch between light and dark is the OS or browser color scheme.
