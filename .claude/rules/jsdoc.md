---
paths:
  - "src/**/*.{ts,tsx}"
  - "scripts/**/*.ts"
---

# JSDoc on exports

Every **exported** function, const, class, and type alias gets a JSDoc block. Internal (non-exported) helpers don't need JSDoc unless the behavior is non-obvious.

- One-line summary minimum.
- Document `@param` / `@returns` only when the type signature alone doesn't carry the intent.
- Don't restate types in JSDoc that TypeScript already encodes. JSDoc explains _why_ and _when_, not _what_.
- For exported `const` values that hold simple data (strings, numbers, plain objects), a one-line summary above the declaration is enough.

Example:

```ts
/** Compile the Tailwind entry point and return the produced CSS bytes. */
export const compileTailwind = async (entry: string): Promise<Uint8Array> => {
  // ...
}
```
