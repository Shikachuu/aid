# `aid dev`

Local dev server with hot reload. Runs the same build pipeline as `aid build` into a scratch directory, serves it over HTTP, and reloads connected browsers on every successful rebuild.

## Command

```
aid dev [dir] [--file aid.yaml] [--port N] [--host H]
```

| Flag | Default | Role |
|---|---|---|
| `dir` (positional) | current directory | Project root (where `aid.yaml` lives). |
| `--file` / `-f` | `aid.yaml` | Config filename, relative to `dir` (use for `.yml` or alt configs). |
| `--port` | `dev.port` from config (3000) | Listening port. Integer 0–65535. |
| `--host` | `dev.host` from config (`localhost`) | Listening host. |

CLI flags win over config; config wins over defaults.

## Config

```yaml
# aid.yaml
base_path: "/"      # served URL prefix; browser opens http://host:port<base_path>/

dev:
  port: 3000
  host: "localhost"
```

`base_path: "/docs"` makes the server redirect `/` → `/docs/`; everything below the prefix is served, everything above 404s.

## What gets watched

Everything the build pipeline reads from is watched recursively:

| Source | Watched | On change |
|---|---|---|
| `<contentDir>` (default `docs/`) | yes | rebuild |
| `<staticDir>` (default `static/`) | yes | rebuild |
| `<templatesDir>` (if `dir.templates` set) | yes | rebuild |
| `aid.yaml` | yes | **process exits** — restart `aid dev` to pick up the new config |
| Tailwind dependency set (auto-detected from compile output) | yes | rebuild |

Anything under `.aid/` is filtered out so aid's own writes can't loop back into the watcher. Watcher events are batched on a 100ms debounce; files whose `mtimeMs` hasn't advanced are dropped (works around macOS emitting read events).

## Rebuild model

- **Double-buffered output.** Builds alternate between `.aid/dev/build-a/` and `.aid/dev/build-b/`. The server serves whichever buffer was most recently built; the other one is being written to. Readers never see a half-written `dist/`.
- **Serial with one queued slot.** While a build is in flight, change events coalesce into a single pending rebuild. Saving five files in quick succession triggers at most two builds (the current one plus one trailing).
- **No in-memory fast path.** Output goes to disk — same code path as `aid build`. Per-build durations are logged: `[aid] rebuilt in 217ms`.

## Hot reload

The server injects a small SSE client into every served HTML response. It connects to `/__aid/reload` and listens for three events:

| Event | Effect |
|---|---|
| `reload` | `location.reload()` — fired after every successful rebuild. |
| `error-detail` | Renders a fullscreen error overlay over the page. |
| `clear-error` | Removes the overlay (fired alongside the next successful rebuild). |

No browser plugin needed. The SSE channel has `idleTimeout: 0` so the connection stays open indefinitely.

## Error behavior

When a build throws, the current buffer keeps serving (last successful output stays live). New connections also receive the `error-detail` frame, so a refresh during a broken state still shows the overlay.

When the **first** build (before any buffer is live) fails, every non-SSE request returns a minimal HTML bootstrap page that hosts the overlay — there is no prior site to fall back to.

## Scratch directory layout

```
<projectDir>/
├── .aid/
│   ├── .gitignore        # auto-written: "*"
│   └── dev/
│       ├── build-a/
│       └── build-b/
```

`.aid/` is created on first run and ignored from git via the auto-written `.gitignore`. Safe to delete between sessions.

## Lifecycle

1. Load config, resolve paths.
2. Write `.aid/.gitignore`.
3. Kick off the initial build into buffer A.
4. Start `Bun.serve` on `host:port`.
5. Start the watcher.
6. Loop: change → debounce → rebuild → flip buffer → broadcast `reload`.
7. SIGINT / SIGTERM → stop the watcher and the server, exit 0.

If `aid.yaml` changes mid-session: the server broadcasts an error frame telling the user to restart, then exits 0.

## Limitations (v0)

- No WebSocket — SSE only. Fine for one-way server→browser notifications; no client→server channel.
- The whole site rebuilds on every change. Incremental rebuild is not implemented.
- `aid.yaml` changes require a manual restart.
- The dev server has no auth and binds to `localhost` by default — don't expose it to a public network without a reverse proxy.
