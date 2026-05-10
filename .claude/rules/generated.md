---
paths:
  - "schemas/**"
  - "**/*.schema.json"
---

# Generated artifacts

`schemas/aid.schema.json` is **emitted**, not authored. Source of truth is the Zod schema in `src/core/config.ts`.

- Never hand-edit `schemas/aid.schema.json`.
- To change the schema: edit `src/core/config.ts`, then run `bun run emit-schema`.
- CI runs `bun run emit-schema -- --check` and fails the build on drift.
- Don't add ad-hoc validation that duplicates Zod rules — extend the Zod schema instead so the runtime validator and the published JSON Schema stay in lockstep.
