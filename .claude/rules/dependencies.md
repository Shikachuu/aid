# Dependencies

## Bun stdlib first

Before adding any npm dependency, check whether Bun's built-ins cover it:

- `Bun.serve` is an HTTP, WebSocket, and SSE server.
- `Bun.file` and `Bun.write` do file IO.
- `Bun.Glob` does globbing.
- `Bun.YAML` parses and stringifies YAML.
- `Bun.CryptoHasher` does hashing.
- `Bun.build` is the bundler.
- `Bun.password` does argon2 and bcrypt.
- The `with { type: "file" }` import attribute embeds a file as an import.

Reject duplicates. If a function in Bun's stdlib exists, use it.

## Always ask before changing dependencies

`bun add`, `bun install`, `bun update`, `bun remove`, and `bun pm *` are **not** in the permissions allowlist. They prompt the user every time, by design.

- Propose the change in chat first.
- Let the permission prompt fire when you call the command. Do not try to bypass it.
- Batch dependency changes so each logical change needs one approval, not one per package.

## Always install through mise

The canonical command is `mise install`, **not** `bun install`. `mise.toml` has a `postinstall` hook that runs `bun install --cpu='*' --os='*'`, then `bun scripts/stage-natives.ts`, then `bun run -F @aid/proto-ui build`. The `--cpu` and `--os` flags make every platform subpackage of `@tailwindcss/oxide` and `@bufbuild/buf` land in `node_modules` for cross-compilation. A bare `bun install` filters out the platform-mismatched packages without a warning and breaks the compile pipeline.

- Run `mise install` after pulling and whenever `package.json` or `bun.lock` changes.
- `bun add <pkg>` is still fine for the metadata write, but follow it with `mise install` to run the install with the correct flags.
- Never suggest `bun install` on its own in docs or scripts.

## When a dependency is approved

- Install the **current latest** (`bun add pkg`). Do not pin an older version by hand unless there is a specific compatibility reason. If there is one, document it inline.
- Pin the resolved version in `package.json` with an explicit caret range (e.g. `"zod": "^4.4.3"`). `bun add` writes this range by default. Never leave a dependency as `"*"`, because that hides the actual resolution behind `bun.lock` and makes the metadata non-reproducible. Platform-specific subpackages (e.g. `@bufbuild/buf-darwin-arm64`) stay exact-pinned to match their parent.
- Bump a binary family (`@bufbuild/buf`, `@tailwindcss/oxide`, Biome) with its platform subpackages in the same change, then run `bun run deps:binaries`. It prints the exact commands and fails on any drift.
- Reuse what is already in the repo before adding a new package in the same space.
- Do not add peer dependencies, runtime polyfills, or shims without explicit user direction.
