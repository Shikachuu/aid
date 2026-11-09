---
title: Commands
description: The aid commands, what each one does, and the exit codes they return.
sidebar:
  order: 0
---

`aid` has six commands. Running `aid` with no command prints the help. The [CLI reference](../reference/cli.md) lists every argument and flag.

| Command | What it does | Details |
| --- | --- | --- |
| `aid init [dir]` | Not implemented yet. Prints an error and exits 1. | [aid init](./init.md) |
| `aid build [dir]` | Builds the static site into the output folder (`dist/` by default). | [aid build](./build.md) |
| `aid dev [dir]` | Builds the site, serves it on `http://localhost:3000/`, and rebuilds and reloads on every change. | [Dev server](../dev-server/index.md) |
| `aid lint [dir]` | Runs the bundled linters: markdownlint, Spectral for OpenAPI, `bun lint` for JS and TS, the CSS checks, and `buf` for Protobuf. | [Linting](../linting/index.md) |
| `aid fmt [dir]` | Runs the bundled formatters for markdown, OpenAPI, JS, TS, JSON, CSS, and Protobuf. | [Formatting](../formatting/index.md) |
| `aid help [command]` | Prints the help for aid or for one command. | [CLI reference](../reference/cli.md#aid-help) |

Every command takes the project folder as an optional first argument. Without it, aid uses the current folder.

`aid --version` prints the version from `package.json`. Every command accepts `--help` (`-h`).

## Exit codes

| Code | When |
| --- | --- |
| 0 | The command finished without an error. |
| 1 | The command threw an error: an invalid `aid.yaml`, a failed build, a dev-server port already in use, an invalid `--port`, or `aid init`. An expected error prints one line that starts with `aid:`. An unexpected error prints its message and stack trace. |
| 1 | `aid lint` or `aid fmt` found a problem in at least one tool's files. With `aid fmt --check`, a file that needs formatting counts as a problem. |
| 1 | `aid help` received an unknown command name. |

`aid dev` keeps running after a failed rebuild. It prints the error, shows it in the browser, and keeps serving the last successful build. It exits 0 when it receives Ctrl-C (`SIGINT`) or `SIGTERM`, or when `aid.yaml` changes.
