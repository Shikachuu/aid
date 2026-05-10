# `assets/`

Static files baked into the aid binary via Bun's `with { type: "file" }` import attribute or copied to the build output.

- `scaffold/` — copied verbatim by `aid init` to a new project directory.
- `minisearch.min.js` — emitted at build time by `scripts/bundle-web.ts` from the npm `minisearch` package; not checked in.
