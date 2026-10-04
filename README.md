# aid

> Single-binary documentation generator for markdown, HTML, OpenAPI, and Protocol Buffers.

aid generates one themed documentation site from your existing content with a single CLI command. Markdown, HTML, OpenAPI specs, and `.proto` files live in the same folder tree. Tailwind 4 theming applies to every page type, including the OpenAPI and proto reference UIs. By default, every build writes `llms.txt` and a per-page `.md`, `.json`, or `.proto` export. The build also precomputes a search index over markdown, HTML, OpenAPI, and proto pages, and the browser queries it without a server.

## Status

`aid build` and `aid dev` work. `aid init`, the "Open in AI" button, the dark-mode toggle, and site navigation are not implemented yet.

## Quick start (development)

```bash
mise install
bun run typecheck
bun test
```

## Documentation

The spec is in [`docs/PRODUCT_OVERVIEW.md`](docs/PRODUCT_OVERVIEW.md). Architectural research is in `docs/RESEARCH_*.md`.

## License

MIT. See [LICENSE](LICENSE).
