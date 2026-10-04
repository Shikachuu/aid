---
paths:
  - "**/*.css"
---

# CSS: Tailwind directives only

Never write raw CSS rules. Every rule must use a Tailwind 4 directive.

Allowed directives:

- `@apply` composes utility classes into a rule.
- `@theme` declares design tokens (colors, fonts, spacing, and so on).
- `@utility` defines a new utility class.
- `@layer` places rules in the `base`, `components`, or `utilities` layer.
- `@variant` registers a custom variant.
- `@source` points Tailwind at additional content roots.
- `@config` loads a JS or TS Tailwind config (rarely needed in v4).
- `@reference` references another stylesheet for `@apply` lookups.
- `@plugin` registers a Tailwind plugin.

Patterns:

- Design tokens go inside `@theme { ... }`, not as bare CSS custom properties at `:root`.
- Introduce one-off utility classes with `@utility name { @apply ... }`, not with bare selectors that declare properties.
- Component-level styles use `@layer components { @apply ... }` blocks.

If no directive can express a rule, stop and raise it.
