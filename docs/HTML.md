# HTML pages

aid renders every full `.html` file in `<contentDir>` as a page. It wraps each one in the same Layout that markdown and OpenAPI pages use, with the same theming and toolbar. The Layout's navigation, dark-mode toggle, and "Open in AI" button are not implemented yet.

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

aid sniffs for `<html` and `<body` opening tags in the raw source before parsing. If either is missing, the build fails, and the error names the source path.

## Metadata

aid drops `<head>`, because its Layout renders `<html>`, `<head>`, and the document chrome. Before it drops `<head>`, aid copies two tags onto the page:

| Source tag | Used for |
| --- | --- |
| `<title>X</title>` | The document `<title>`, the page title in llms.txt, and the search index entry. |
| `<meta name="description" content="X">` | `<meta name="description">` in the output, and the llms.txt one-line summary. |

aid treats an empty `<title></title>` as missing. When `<title>` is missing, the title falls back to the filename without its extension (`about.html` becomes `about`).

aid discards all other `<head>` content (custom `<script>`, `<link>`, additional `<meta>`). See "Out of scope" below.

## Outputs

HTML pages follow the markdown routing model. aid strips the extension and derives the route from the file path.

| Source | URL | On disk |
| --- | --- | --- |
| `docs/about.html` | `/about` | `<outputDir>/about/index.html` |
| `docs/about.html` (sidechain) | `/about.md` | `<outputDir>/about.md` |
| `docs/index.html` | `/` | `<outputDir>/index.html` and `<outputDir>/index.md` |

aid produces the `.md` sidechain by converting the body subtree with `rehype-remark` and `remark-stringify`. aid rewrites colocated image hrefs once, before it builds the HTML and `.md` outputs, so both outputs reference the same public URL.

## Colocated images

aid copies each file that a relative `<img src>` points at into the route's output directory and rewrites the src to a public href. Markdown's `![alt](./hero.png)` follows the same rules.

| Source | Rewritten to |
| --- | --- |
| `<img src="./hero.svg">` next to `docs/about.html` | `<img src="/about/hero.svg">` |
| `<img src="../shared/diagram.svg">` | aid resolves it relative to the source directory |
| `<img src="https://...">` | left unchanged |
| `<img src="/already-absolute.png">` | left unchanged |

A relative src that resolves outside `<contentDir>` fails the build. The markdown renderer applies the same boundary check.

## Mermaid

A `<pre class="mermaid">` or `<div class="mermaid">` block in the body sets the page's `hasMermaid` flag, and the Layout injects the lazy mermaid bundle into the page. aid keeps the block content as-is. The mermaid runtime in the browser renders it the same way it renders a fenced ```` ```mermaid ```` block from a markdown source.

```html
<pre class="mermaid">
graph TD
  A --> B
</pre>
```

## Error behavior

| Condition | Outcome |
| --- | --- |
| File missing `<html>` or `<body>` | Build fails with the source path. |
| Empty file | The build fails, because the file has neither tag. |
| Colocated `<img src>` escapes `<contentDir>` | Build fails with the offending path. |
| Colocated `<img src>` points at a missing file | aid records a non-fatal vfile warning and leaves the src unchanged in both outputs. |

## Out of scope (v0.1)

- **Body-fragment input.** The full-document requirement is deliberate. Metadata always comes from `<head>`, and the parser handles one input shape.
- **Custom `<head>` passthrough.** aid drops author-supplied `<script>`, `<link>`, and extra `<meta>` tags. To change the Layout chrome, use the Tailwind entrypoint. Template overrides are not implemented yet.
- **`<meta>` keys beyond `description`.** aid drops Open Graph, Twitter Card, robots, and other `<meta>` tags. Layout support for them is planned.
- **Heading collection.** The HTML renderer does not extract headings into `searchTokens.headings`, so search matches HTML pages on title and body only.
