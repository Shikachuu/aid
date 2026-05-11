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

## Always install through mise

The canonical command is `mise install`, **not** `bun install`. `mise.toml` has a `postinstall` hook that runs `bun install --cpu='*' --os='*'` — required so every platform subpackage of `@tailwindcss/oxide` and `@bufbuild/buf` lands in `node_modules` for cross-compilation. A bare `bun install` silently filters the platform-mismatched ones and breaks the compile pipeline.

- After pulling, or whenever `package.json` / `bun.lock` changes: `mise install`.
- `bun add <pkg>` is still fine for the metadata write, but follow it with `mise install` to materialise the install with the correct flags.
- Never suggest `bun install` on its own in docs or scripts.

## When a dep is approved

- Install the **current latest** (`bun add pkg`). No manual older pins unless there's a specific compatibility reason — document it inline if so.
- Pin the resolved version in `package.json` with an explicit caret range (e.g. `"zod": "^4.4.3"`) — `bun add` writes this by default. Never leave a dep as `"*"`; that hides the actual resolution behind `bun.lock` and makes the metadata non-reproducible. Platform-specific subpackages (e.g. `@bufbuild/buf-darwin-arm64`) stay exact-pinned to match their parent.
- Reuse what's already in the repo before reaching for a new package in the same space.
- Don't add peer deps, runtime polyfills, or shims without explicit user direction.
