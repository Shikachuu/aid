---
title: Configuration
description: How aid loads and validates aid.yaml, how to get editor completion, and which page covers each key.
sidebar:
  order: 0
---

`aid build` and `aid dev` read their settings from `aid.yaml` in the project folder. Only `name` is required, and it must fit on one line. A value with a line break, including a `name: |` block scalar, which keeps its trailing line break, fails with `name must be a single line`. `aid lint` and `aid fmt` do not read `aid.yaml`.

## Example

This site's own `aid.yaml`:

```yaml
# yaml-language-server: $schema=../schemas/aid.schema.json

name: aid
description: Single-binary documentation generator for markdown, HTML, OpenAPI, and Protobuf sources.
base_url: https://shikachuu-aid.pages.dev
base_path: /

dir:
  templates: templates
```

The [configuration reference](../reference/configuration.md) lists every key with its type and default. Its [full default config](../reference/configuration.md#full-default-config) section shows what aid builds with when the file holds only `name`.

## How aid loads it

1. aid reads the file named by `--file` (`-f`), relative to the project folder. The default is `aid.yaml`. Use `--file aid.yml` for the other extension.
2. `Bun.YAML` parses the file.
3. aid validates the result against its Zod schema and fills in the default of every key you leave out.
4. aid rejects keys it does not know, at every level. A misspelled key such as `base_pth` stops the command.

A missing file, a folder in place of the file, an empty file, a YAML syntax error, an unknown key, or a value of the wrong type stops the command with exit code 1. aid prints one line that names the file and, for schema errors, each key path with its problem:

```text
aid: invalid config /home/me/site/aid.yaml: name: Too small: expected string to have >=1 characters; (root): Unrecognized key: "base_pth"
```

When `aid.yaml` is missing but `aid.yml` sits next to it, the message says to pass `-f aid.yml`.

`aid dev` reads the config once at start. When `aid.yaml` changes, the dev server stops and asks you to start it again.

## Editor completion

aid publishes a JSON Schema for `aid.yaml`. Editors that use the YAML language server, such as VS Code with the Red Hat YAML extension, read a `# yaml-language-server: $schema=<url>` comment and then complete and check keys:

```yaml
# yaml-language-server: $schema=https://shikachuu-aid.pages.dev/schemas/aid.schema.json

name: My Docs
```

This site serves the schema at `schemas/aid.schema.json` under its base path, so the URL above works once CI has deployed the site to Cloudflare Pages. Inside the aid repository, point at the file with a relative path: `schemas/aid.schema.json` at the repository root. `bun run emit-schema` regenerates that file from the Zod schema, and `bun run check` fails when the two differ.

> [!NOTE]
> The files in `assets/scaffold/` and `tests/fixtures/sample-site/` point at `https://aid.tools/schemas/v0/aid.schema.json`. Nothing in the aid repository publishes a file at that address.

## Keys by feature

| Keys | What they control | Page |
| --- | --- | --- |
| `name` | The site name in the header, the browser tab title, the footer, and the `llms.txt` heading. | [Configuration reference](../reference/configuration.md#top-level-keys) |
| `description` | The summary line of `llms.txt`. | [llms.txt](../llms-txt/index.md) |
| `version` | A version string shown in the footer. | [Configuration reference](../reference/configuration.md#top-level-keys) |
| `base_path`, `base_url`, `dir.content`, `dir.output`, `dir.static` | Where aid reads and writes files, and the URLs it generates. | [Paths and URLs](./paths-and-urls.md) |
| `dir.templates` | The folder that holds an `llms.txt` template. | [llms.txt](../llms-txt/index.md) |
| `stylesheet` | The Tailwind entry point. | [Theming](../theming/index.md) |
| `theme.dark_mode` | How aid builds the dark palette. | [Dark mode](../theming/dark-mode.md) |
| `search.enabled`, `search.typo_tolerance`, `search.weights.*` | The search index and its ranking. | [Search](../search/index.md) |
| `on_broken_links` | Whether a broken link or image fails the build or only prints a warning. | [Links](../content-types/links.md) |
| `dev.port`, `dev.host` | The dev server address. | [Dev server](../dev-server/index.md) |
| `ai_targets` | Nothing yet. | This page |

> [!WARNING]
> Not implemented yet: aid validates `ai_targets` against `chatgpt`, `claude`, and `gemini`, then never reads it. It is reserved for the "Open in AI" button, which pages do not render yet. See the [status page](../status.html).
