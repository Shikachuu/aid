# HTML pages

Drop full `.html` files into `<contentDir>` and aid renders them as first-class pages — wrapped in the same Layout that markdown and OpenAPI pages use, with the same theming, dark mode, navigation, and AI-button toolbar.

## Source shape

The input **must** be a full HTML document. Body fragments are not supported in v0.1.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>About the Project</title>
  <meta name="description" content="One-line summary of the page.">
</head>
<body>
  <h1>About the Project</h1>
  <p>Prose, images, mermaid blocks — anything you'd write in a static HTML page.</p>
</body>
</html>
```

aid sniffs for `<html` and `<body` opening tags in the raw source before parsing. If either is missing, the build fails with the source path and a clear error.

## Metadata

`<head>` is dropped — aid's Layout owns `<html>`, `<head>`, and the document chrome. Two tags are read first and promoted onto the page:

| Source tag | Used for |
|---|---|
| `<title>X</title>` | The document `<title>`, the page title in nav/llms.txt, and the search index entry. |
| `<meta name="description" content="X">` | `<meta name="description">` in the output, and the llms.txt one-line summary. |

Empty `<title></title>` is treated as absent. When `<title>` is missing entirely, the title falls back to the filename basename (`about.html` → `about`).

Other `<head>` content (custom `<script>`, `<link>`, additional `<meta>`) is currently discarded. See **Out of scope** below.

## Outputs

Same routing model as markdown — extension stripped, path-based.

| Source | URL | On disk |
|---|---|---|
| `docs/about.html` | `/about` | `<outputDir>/about/index.html` |
| `docs/about.html` (sidechain) | `/about.md` | `<outputDir>/about.md` |
| `docs/index.html` | `/` | `<outputDir>/index.html` + `<outputDir>/index.md` |

The `.md` sidechain is produced by converting the body subtree through `rehype-remark` + `remark-stringify`. Colocated image hrefs are rewritten **once** (before the HTML/MD branches fork), so both outputs reference the same public URL.

## Colocated images

Relative `<img src>` values pointing at files next to the HTML source are copied into the route's output directory and rewritten to public hrefs — same rules as markdown's `![alt](./hero.png)`.

| Source | Rewritten to |
|---|---|
| `<img src="./hero.svg">` next to `docs/about.html` | `<img src="/about/hero.svg">` |
| `<img src="../shared/diagram.svg">` | resolved relative to the source dir |
| `<img src="https://…">` | left untouched |
| `<img src="/already-absolute.png">` | left untouched |

A relative src that resolves outside `<contentDir>` is a hard error — same boundary check the markdown renderer applies.

## Mermaid

A `<pre class="mermaid">` or `<div class="mermaid">` block in the body flips the page's `hasMermaid` flag, so the lazy mermaid bundle gets injected into the page. The block content is preserved verbatim — the client-side mermaid runtime renders it the same way it would a fenced ```` ```mermaid ```` block from a markdown source.

```html
<pre class="mermaid">
graph TD
  A --> B
</pre>
```

## Error behavior

| Condition | Outcome |
|---|---|
| File missing `<html>` or `<body>` | Build fails with the source path. |
| Empty file | Same — fails the sniff. |
| Colocated `<img src>` escapes `<contentDir>` | Build fails with the offending path. |
| Colocated `<img src>` points at a missing file | Non-fatal vfile warning; src left untouched in both HTML and `.md` outputs. |

## Out of scope (v0.1)

- **Body-fragment input.** The full-document requirement is intentional — it makes the metadata source unambiguous and keeps the parser path single-mode.
- **Custom `<head>` passthrough.** Author-supplied `<script>` / `<link>` / extra `<meta>` tags are dropped. Use the Tailwind entry or the (forthcoming) partial-override system if you need to extend the Layout chrome.
- **`<meta>` keys beyond `description`.** Open Graph, Twitter Card, robots, etc. are read by the browser but not promoted onto the page record. Layout will grow these surfaces later.
- **Heading collection.** Headings are not yet extracted from HTML bodies into `searchTokens.headings`; the array is left empty. Will land alongside the cross-format search builder.
