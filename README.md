# aid

> Single-binary documentation generator for markdown, HTML, OpenAPI, and Protocol Buffers.

Generates a cohesive, themed documentation site from your existing content with one CLI command. Markdown and OpenAPI specs and `.proto` files coexist in the same folder tree. Tailwind 4 theming applies to every page type, including the OpenAPI and proto reference UIs. An LLM-ready layer (`llms.txt`, per-page `.md` and `.json` exports, an "Open in AI" button) ships by default. Cross-format search is precomputed at build time and instant in the browser.

## Status

Early scaffold. Not yet usable.

## Quick start (development)

```bash
bun install
bun run typecheck
bun test
```

## Documentation

Spec lives in [`docs/PRODUCT_OVERVIEW.md`](docs/PRODUCT_OVERVIEW.md). Architectural research in `docs/RESEARCH_*.md`. Implementation plan at the path tracked in the repo's plan file.

## License

MIT — see [LICENSE](LICENSE).
