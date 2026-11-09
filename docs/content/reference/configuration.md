---
title: Configuration reference
description: Every aid.yaml key with its type, default, and meaning.
sidebar:
  order: 2
---

aid reads `aid.yaml` from the project directory (`--file` picks another name). Only `name` is required. An unknown key is an error.

## Top-level keys

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `name` | string (non-empty) | required | Project display name, on one line. Required. |
| `description` | string | none | Short site description. Used as the llms.txt summary line. |
| `version` | string | none | Project version string (semver recommended). |
| `base_url` | string (URL) | none | Origin of the published site (e.g. `https://docs.example.com`), with no path. Makes llms.txt links absolute; put a sub-path in base_path. |
| `base_path` | string | `"/"` | URL path prefix for all routes. Must start with '/'; a trailing slash is dropped. Default '/'. Use '/docs' to host at example.com/docs/. |
| `stylesheet` | string | `"main.css"` | Path to the Tailwind CSS entrypoint. Applied uniformly to every page type (markdown, HTML, OpenAPI, proto). |
| `ai_targets` | list of one of `chatgpt`, `claude`, `gemini` | `["chatgpt","claude"]` | Not implemented yet: the build does not read this key. Reserved for the 'Open in AI' button targets. |
| `on_broken_links` | one of `error`, `warn` | `"error"` | What to do when a relative link, link fragment, colocated image or _meta.yaml nav entry does not resolve. 'error' fails the build; 'warn' prints the report and continues. |

## `dir`

Project directory configuration.

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `dir.content` | string | `"docs"` | Content root directory. Files here become routes. Default 'docs'. |
| `dir.output` | string | `"dist"` | Build output directory. It must not overlap the content, static, or templates directory, and `aid build --clean` deletes it. Default 'dist'. |
| `dir.templates` | string | `""` | Optional directory holding an llms.txt template override. Tailwind also scans it for class names. Empty string means the bundled defaults. |
| `dir.static` | string | `"static"` | Directory copied verbatim into the build output. Use for images, fonts, favicon, robots.txt. Default 'static'. |

## `theme`

Theme configuration.

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `theme.dark_mode` | one of `auto`, `manual`, `off` | `"auto"` | Dark mode strategy. 'auto' derives the dark palette from your light tokens. 'manual' expects explicit dark variants in main.css. 'off' disables dark mode entirely. |

## `search`

Cross-format search configuration.

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `search.enabled` | boolean | `true` | Generate the cross-format search index at build time. |
| `search.typo_tolerance` | number (min 0, max 1) | `0.2` | Fraction of term length allowed as edit distance. 0.2 = up to 1 edit per 5 chars. 0 disables typo tolerance. |
| `search.weights.markdown` | number (min 0) | `1` | Search ranking boost for markdown pages. |
| `search.weights.html` | number (min 0) | `1` | Search ranking boost for HTML pages. |
| `search.weights.openapi` | number (min 0) | `2` | Search ranking boost for OpenAPI operations and schemas. |
| `search.weights.proto` | number (min 0) | `1.5` | Search ranking boost for proto messages and RPCs. |
| `search.weights.jsonschema` | number (min 0) | `1.5` | Search ranking boost for JSON Schema fields and definitions. |

## `dev`

Dev server configuration.

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `dev.port` | integer (min 0, max 65535) | `3000` | Dev server port. |
| `dev.host` | string | `"localhost"` | Dev server host. |

## Full default config

This is the config aid builds with when `aid.yaml` holds only `name: My Docs`.

```yaml
name: My Docs
base_path: /
stylesheet: main.css
dir:
  content: docs
  output: dist
  templates: ""
  static: static
theme:
  dark_mode: auto
ai_targets:
  - chatgpt
  - claude
search:
  enabled: true
  typo_tolerance: 0.2
  weights:
    markdown: 1
    html: 1
    openapi: 2
    proto: 1.5
    jsonschema: 1.5
on_broken_links: error
dev:
  port: 3000
  host: localhost
```
