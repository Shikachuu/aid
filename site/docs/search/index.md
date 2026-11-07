---
title: Search
description: How aid builds one MiniSearch index over markdown, HTML, OpenAPI, proto, and JSON Schema pages at build time, and how the search box queries it in the browser.
sidebar:
  order: 9
---

aid builds one full-text index over every page at build time and ships it as a static file. The search box in the header loads the index on first use and searches it in the browser. Search needs no server.

## Use it

Search is on by default. Type in the header's search box:

- results update 80 ms after the last keystroke;
- the list shows at most 8 results, each with a page-kind badge, the title, and the URL;
- the arrow keys move the selection, Enter opens the selected result, and Esc clears the box while the list is open. While an input method editor (IME) composes text, these keys go to the IME.
- the list hides when the box loses focus and shows the same results again when it regains focus;
- aid searches only the first 100 characters of a query.

## Configure it

The `search` keys in `aid.yaml` are listed in the [configuration reference](../reference/configuration.md#search).

```yaml
search:
  typo_tolerance: 0.2
  weights:
    openapi: 2
```

- `search.enabled: false` removes the search box from every page, and aid does not write the index file.
- `search.typo_tolerance` sets the fuzzy match distance as a fraction of the term length. `0.2` allows one edit per five characters. `0` turns fuzzy matching off.
- `search.weights` multiplies the score of every result of one page kind: `markdown`, `html`, `openapi`, `proto`, or `jsonschema`. The defaults give OpenAPI pages the highest weight, and proto and JSON Schema pages the next highest.

## What each page kind indexes

Every entry has four fields: `title`, `headings`, `body`, and `extras`.

| Kind | `title` | `headings` | `body` | `extras` |
| --- | --- | --- | --- | --- |
| [Markdown](../content-types/markdown.md) | page title | the text of every heading, H1 included | the markdown source without frontmatter | none |
| [HTML](../content-types/html.md) | `<title>` or file name | the text of every `<h1>` to `<h6>` | the body text, without markup, scripts, or styles | none |
| [OpenAPI](../content-types/openapi.md) | `info.title` or file name | none | none | operation ids, paths, schema names, parameter names, operation summaries |
| [Protobuf](../content-types/proto.md) | package name or file name | none | comments on the package, services, RPCs, messages, fields, and enums | fully qualified message, enum, and service names, `<service>.<rpc>` names, field names of top-level messages |
| [JSON Schema](../content-types/jsonschema.md) | root `title` or file name | definition names | every `description` | dotted property paths, definition names |

## How it works

At build time, aid adds one entry per page to a MiniSearch index. The options live in `src/core/search-options.ts`, which the build and the browser share:

- fields `title`, `headings`, `body`, and `extras`;
- stored fields `type`, `title`, and `url`, which the results list shows;
- a score boost of 3 for `title` matches and 2 for `headings` matches.

aid serializes the index into `search-index.<hash>.js` in the output root. The file assigns the index to `window.__AID_SEARCH__`. The hash comes from the file contents, so a changed index gets a new file name.

In the browser, the base bundle `aid-web.<hash>.js` wires up the search box. On the first focus of the box, it loads the index file with a `<script>` tag and imports MiniSearch, then restores the index with `MiniSearch.loadJS`. If the index file fails to load, the bundle logs one console warning and tries again on the next focus. Each query runs with:

- prefix matching, so `conf` finds `configuration`;
- fuzzy matching at `search.typo_tolerance`;
- `boostDocument`, which multiplies each result's score by the weight of its page kind.

## Limitations

> [!WARNING]
> Not supported: results that link to a heading inside a page, highlighted matches, and a keyboard shortcut that focuses the search box.
