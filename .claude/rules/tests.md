---
paths:
  - "tests/**"
  - "src/**/*.test.ts"
---

# Tests

- **`bun test` only.** Do not introduce vitest, jest, node:test, or any other runner. The Bun runner is the contract.
- Fixtures live in `tests/fixtures/`. Add new fixtures alongside the existing `sample-site/` rather than inventing new top-level layouts.
- Snapshot files (if introduced) commit alongside the test that produced them.
- Prefer integration tests that exercise the public surface (CLI, public exports). Unit-test internals only when the integration test can't isolate the behavior.
- Test files use `.test.ts`. They are picked up automatically by `bun test`.
