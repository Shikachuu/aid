---
paths:
  - "tests/**"
  - "src/**/*.test.ts"
---

# Tests

- **`bun test` only.** Do not introduce vitest, jest, node:test, or any other runner. Every test must run under `bun test`.
- Fixtures live in `tests/fixtures/`. Add new fixtures alongside the existing `sample-site/` rather than inventing new top-level layouts.
- If you add snapshot files, commit them with the test that produced them.
- Prefer integration tests that exercise the public interface (the CLI and public exports). Unit-test internals only when the integration test cannot isolate the behavior.
- Test files use `.test.ts`. `bun test` finds them without configuration.
