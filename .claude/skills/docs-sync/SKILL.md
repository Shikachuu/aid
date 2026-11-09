---
name: docs-sync
description: Use when a change in the aid repo alters behavior that users or contributors see and the documentation site under site/ must follow, or when writing, editing, or reorganizing pages in site/docs. Covers CLI commands and flags, the aid.yaml config schema, frontmatter and _meta.yaml, build outputs, renderers, links and navigation, lint and fmt tools, the dev server, theming, search, llms.txt, CI, release, and dev setup. Activate when the user says "update the docs", "sync the docs with this change", "document this feature", "the docs are out of date", "add a docs page for X", "regenerate the reference pages", "run gen-docs", "check the docs site builds", or "which docs does this change affect", and proactively after finishing a change under src/, scripts/, packages/proto-ui/, or .github/workflows/ that changes behavior. Do not use for JSDoc or code comments, or for refactors, test-only, or comment-only changes with no behavior change.
---

# docs-sync

Keep `site/docs` true to the code after a change. The site is aid's own documentation, built by aid.

## 1. Scope the change

```sh
bun run docs:affected --base origin/main
```

It prints every page mapped to a changed source file (`review`, or `changed` when the change already touches it) and every changed source file no page maps (`unmapped`). Read each listed page in full. For `unmapped` files, decide whether readers see the behavior. If they do, add the file to `DOCS_MAP` in `scripts/docs-affected.ts`.

## 2. Read the change

Run `git diff origin/main...HEAD` on the mapped sources. Write down what a reader would notice:

- commands, flags, defaults, and exit codes;
- config keys, frontmatter keys, and `_meta.yaml` keys;
- output files and their paths;
- error messages and diagnostic codes;
- stubs that became real, and features that were removed;
- CI, release, and dev-setup steps.

If the list is empty, stop and report that no page needs a change.

## 3. Regenerate the reference pages

- If `src/core/config.ts` changed, run `bun run emit-schema` first.
- Always run `bun run gen-docs`.
- Never edit `site/docs/reference/**` or `site/static/schemas/**` by hand.

## 4. Edit the pages

Follow [references/page-conventions.md](references/page-conventions.md) and [references/writing-rules.md](references/writing-rules.md). Use [references/page-template.md](references/page-template.md) for a new feature page.

- Check every sentence you write against the code. Do not describe planned behavior.
- When a stub changes, update its `> [!WARNING]` callout, `site/docs/status.html`, and the Status line in `README.md`.
- A new page goes in the folder of its feature. Give it frontmatter `title`, `description`, and `sidebar.order`. A new top-level folder needs an entry in `site/docs/_meta.yaml`. Add the page to `DOCS_MAP`.
- Link pages by relative source path. The build fails on broken links, anchors, and images.

## 5. Verify

All of these must pass:

```sh
bun run gen-docs --check
bun run docs:build
bun run docs:lint
bun test tests/unit/docs-map.test.ts tests/unit/gen-docs.test.ts
```

For a visual check, run `bun run docs:dev` and open `http://localhost:3000/aid/`.

## 6. Report

List the pages you changed, the pages you reviewed and left unchanged (with the reason), and anything you could not verify.
