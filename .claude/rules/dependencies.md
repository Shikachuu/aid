# Dependencies

## Bun stdlib first

Before adding any npm dep, check whether Bun's built-ins cover it:

- `Bun.serve` — HTTP + WebSocket + SSE server
- `Bun.file` / `Bun.write` — file IO
- `Bun.Glob` — globbing
- `Bun.YAML` — YAML parse/stringify
- `Bun.CryptoHasher` — hashing
- `Bun.build` — bundler
- `Bun.password` — argon2/bcrypt
- `with { type: "file" }` import attribute — embed a file as an import

Reject duplicates. If a function in Bun's stdlib exists, use it.

## Always ask before mutating deps

`bun add`, `bun install`, `bun update`, `bun remove`, and `bun pm *` are **not** in the permissions allowlist. They prompt the user every time, by design.

- Propose the change in chat first.
- Let the harness prompt fire when you call the command; don't try to bypass it.
- Batch dep changes thoughtfully — one approval per logical change, not one per package.

## When a dep is approved

- Install the **current latest** (`bun add pkg`). No manual older pins unless there's a specific compatibility reason — document it inline if so.
- Reuse what's already in the repo before reaching for a new package in the same space.
- Don't add peer deps, runtime polyfills, or shims without explicit user direction.
