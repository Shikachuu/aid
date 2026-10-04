---
paths:
  - "schemas/**"
  - "**/*.schema.json"
---

# Generated artifacts

`schemas/aid.schema.json` is **emitted**, not authored. The source of truth is the Zod schema in `src/core/config.ts`.

- Never hand-edit `schemas/aid.schema.json`.
- To change the schema, edit `src/core/config.ts`, then run `bun run emit-schema`.
- CI runs `bun run scripts/emit-schema.ts --check` and fails the build on drift.
- Do not add ad-hoc validation that duplicates Zod rules. Extend the Zod schema instead, so the runtime validator and the published JSON Schema stay identical.
