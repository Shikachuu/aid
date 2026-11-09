---
paths:
  - "src/**"
  - "scripts/**"
  - "packages/proto-ui/src/**"
  - ".github/workflows/**"
  - "mise.toml"
  - "docs/**"
---

# Keep the docs site in sync

`docs/` is aid's documentation, built by aid. Behavior changes ship their docs in the same change.

- After a change that alters what users or contributors see (commands, flags, config keys, frontmatter, outputs, errors, CI, setup), run the `docs-sync` skill before reporting the work as done.
- Pure refactors, test-only changes, and comment-only changes skip it. Say so in the report.
- `docs/content/reference/**` is generated: run `bun run gen-docs`, never edit it by hand.
- Pages under `docs/content` follow `.claude/skills/docs-sync/references/page-conventions.md` and `writing-rules.md`.
