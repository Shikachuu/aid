# aid

> Single-binary documentation generator for markdown, HTML, OpenAPI, and Protocol Buffers.

aid generates one themed documentation site from your existing content with a single CLI command. Markdown, HTML, OpenAPI specs, and `.proto` files live in the same folder tree. Tailwind 4 theming applies to every page type, including the OpenAPI and proto reference UIs. By default, every build writes `llms.txt` and a per-page `.md`, `.json`, or `.proto` export. The build also precomputes a search index over markdown, HTML, OpenAPI, and proto pages, and the browser queries it without a server.

## Status

`aid build`, `aid dev`, `aid lint`, and `aid fmt` work. `aid init`, the "Open in AI" button, and the dark-mode toggle are not implemented yet. See `site/docs/status.html` for the full list.

## Quick start (development)

```bash
mise install
bun run typecheck
bun test
```

## Documentation

The user and contributor documentation is an aid site in [`site/`](site/docs/index.md), published at <https://shikachuu.github.io/aid/>. Preview it locally with `bun run docs:dev` and open <http://localhost:3000/aid/>.

The product spec is in [`docs/PRODUCT_OVERVIEW.md`](docs/PRODUCT_OVERVIEW.md). Architectural research is in `docs/RESEARCH_*.md`.

## License

MIT. See [LICENSE](LICENSE).
