---
paths:
  - "**/*.css"
---

# CSS: Tailwind directives only

Never write raw CSS rules. Every rule must flow through a Tailwind 4 directive.

Allowed directives:

- `@apply` — compose utility classes into a rule
- `@theme` — declare design tokens (colors, fonts, spacing, …)
- `@utility` — define a new utility class
- `@layer` — `@layer base | components | utilities`
- `@variant` — register a custom variant
- `@source` — point Tailwind at additional content roots
- `@config` — load a JS/TS Tailwind config (rarely needed in v4)
- `@reference` — reference another stylesheet for `@apply` lookups
- `@plugin` — register a Tailwind plugin

Patterns:

- Design tokens go inside `@theme { ... }`, not as bare CSS custom properties at `:root`.
- One-off utility classes are introduced via `@utility name { @apply ... }`, not bare selectors with property declarations.
- Component-level styles use `@layer components { @apply ... }` blocks.

If you genuinely cannot express something via a directive, stop and raise it. There is almost always a directive that fits.
