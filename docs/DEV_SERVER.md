# `aid dev`

`aid dev` runs a local dev server with hot reload. It runs the same build pipeline as `aid build` into a scratch directory, serves the result over HTTP, and reloads connected browsers on every successful rebuild.

## Command

```
aid dev [dir] [--file aid.yaml] [--port N] [--host H]
```

| Flag | Default | Role |
| --- | --- | --- |
| `dir` (positional) | current directory | Project root (where `aid.yaml` lives). |
| `--file` / `-f` | `aid.yaml` | Config filename, relative to `dir` (use it for `.yml` or other config filenames). |
| `--port` | `dev.port` from config (3000) | Listening port. An integer from 0 to 65535. |
| `--host` | `dev.host` from config (`localhost`) | Listening host. |

CLI flags override the config file, and the config file overrides the defaults.

## Config

```yaml
# aid.yaml
base_path: "/"      # served URL prefix; browser opens http://host:port<base_path>/

dev:
  port: 3000
  host: "localhost"
```

With `base_path: "/docs"`, the server redirects `/` to `/docs/`, serves every path under the prefix, and returns 404 for every other path.

## What gets watched

The watcher recursively watches every input of the build pipeline:

| Source | Watched | On change |
| --- | --- | --- |
| `<contentDir>` (default `docs/`) | yes | rebuild |
| `<staticDir>` (default `static/`) | yes | rebuild |
| `<templatesDir>` (if `dir.templates` set) | yes | rebuild |
| Config file (`aid.yaml` or the `--file` value) | yes | The process exits. Restart `aid dev` to load the new config. |
| Tailwind entrypoint (`stylesheet`, default `main.css`) | yes | rebuild |

The watcher ignores everything under `.aid/`, so aid's own writes do not trigger rebuilds. It batches events in a 100ms debounce window. It drops files whose `mtimeMs` has not changed, because macOS emits events on reads.

## Rebuild model

- **Double-buffered output.** Builds alternate between `.aid/dev/build-a/` and `.aid/dev/build-b/`. The server serves whichever buffer was built most recently, and the next build writes to the other one. Readers never see a half-written build.
- **Serial with one queued slot.** While a build runs, change events coalesce into a single pending rebuild. Saving five files in quick succession triggers at most two builds (the running build and one more).
- **No in-memory fast path.** Each build writes to disk through the same code path as `aid build`. The server logs each build's duration, for example `[aid] rebuilt in 217ms`.

## Hot reload

The server injects a small server-sent events (SSE) client into every served HTML response. The client connects to `/__aid/reload` and listens for three events:

| Event | Effect |
| --- | --- |
| `reload` | Calls `location.reload()`. The server sends it after every successful rebuild. |
| `error-detail` | Renders a fullscreen error overlay over the page. |
| `clear-error` | Removes the overlay (sent with the next successful rebuild). |

You do not need a browser plugin. The SSE channel has `idleTimeout: 0`, so the connection stays open until the client or the server closes it.

## Error behavior

When a build throws, the server keeps serving the last successful build. New connections also receive the `error-detail` frame, so a refresh during a broken state still shows the overlay.

If the first build fails, there is no earlier build to serve. Every non-SSE request then returns a minimal HTML page that shows the overlay.

## Scratch directory layout

```
<projectDir>/
├── .aid/
│   ├── .gitignore        # auto-written: "*"
│   └── dev/
│       ├── build-a/
│       └── build-b/
```

`aid dev` creates `.aid/` on first run and writes a `.gitignore` inside it that excludes the directory from git. You can delete `.aid/` between sessions.

## Lifecycle

1. Load the config and resolve paths.
2. Write `.aid/.gitignore`.
3. Run the initial build into buffer A.
4. Start `Bun.serve` on `host:port`.
5. Start the watcher.
6. On each change, debounce, rebuild, swap the live buffer, and broadcast `reload`.
7. On SIGINT or SIGTERM, stop the watcher and the server and exit with code 0.

If the config file changes during a session, the server broadcasts an error frame that tells the user to restart, then exits with code 0.

## Limitations (v0.1)

- The server uses SSE, not WebSocket. SSE carries notifications from server to browser only, and there is no channel from browser to server.
- The whole site rebuilds on every change. Incremental rebuild is not implemented.
- Config file changes require a manual restart.
- The dev server has no auth and binds to `localhost` by default. Do not expose it to a public network without a reverse proxy.
