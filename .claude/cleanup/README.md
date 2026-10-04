# Cleanup pass

These are research outputs from three audits, run on branch `chore/cleanup-pass`:

- `comments/` holds the comment audits (`/no-comments`, comment-auditor). There is one file per code slice.
- `ponytail/` holds the over-engineering audits (`/ponytail`, full intensity). There is one file per code slice.
- `unslop/` holds the prose audits of the docs (`/unslop`).

The code slices are:

- A: `src/core`, `src/cli`, `scripts`, and the `src` root files.
- B: `src/renderers`, `src/lint`, `src/fmt`, `src/dev`, `src/workers`, `src/search`.
- C: `src/web`, `src/theme`, `packages/proto-ui`.
- D: `tests`.

## Decisions (2026-10-04)

- `@aid/proto-ui` stays a client-side React package. The cleanup simplifies its internals and does not move proto rendering to the server.
- The cleanup deletes only code that has zero importers. The visible stubs stay: the "Open in AI" button, the dark-mode toggle, the empty nav, `aid init`, and the `ai_targets` config key.
- The cleanup fixes these bugs:
  - DocBlock XSS. Escape raw HTML through marked's renderer, with no new dependency.
  - `fmt openapi` returns `ok:true` on a parse error.
  - The watcher catch-alls swallow errors.
  - The dev watcher ignores `--file`.
  - `sfixed64` is not treated as a scalar.
  - Proto pages are missing from search.
  - The `isInside` check can be escaped through a symlink and rejects names that start with `..`.
- Dependencies:
  - Remove `markdownlint-cli2` and `remark-frontmatter`, which nothing uses.
  - Declare `markdownlint`, `rehype-parse`, `unist-util-visit` and `vfile`, which the code imports but `package.json` does not list.
- Drop Windows from `release.yml`.
- The prose and staleness fixes also cover `.claude/CLAUDE.md` and `.claude/rules/*.md`.
- Not done, listed only:
  - `release.yml` skips mise, so `stage-natives` never runs.
  - `bun publish` fails on `private: true`.
  - `release.yml` uses `bun-version: latest` instead of the pinned version.

## Execution order

1. Ponytail A, B and C run in parallel, together with the unslop part 1 and part 2 passes. Each agent owns a disjoint set of files.
2. Ponytail D (tests) runs next, together with the cross-slice items that span several owners.
3. The comment passes A to D run in parallel.
4. `/verify`.
