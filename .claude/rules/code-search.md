# Code search and library docs

`.mcp.json` registers two MCP servers: `codebase-memory-mcp` (a knowledge graph of this repo, pinned in `mise.toml`) and `context7` (current docs for third-party libraries).

## Navigating the code

- Find a function, type, or component with `search_graph`. Read its source with `get_code_snippet`, not a whole-file Read.
- Follow callers, callees, and data flow across `src/`, `packages/proto-ui`, and `scripts/` with `trace_path`. Use `query_graph` for patterns `trace_path` cannot express.
- Start with `get_architecture` when a task touches a module you have not seen in this session.
- Use Grep and rg for literal strings, config keys, error messages, markdown, CSS, and generated files.
- Read a file before editing it, even after `get_code_snippet` showed the symbol.
- `mise install` builds the index. If `index_status` reports the project as unindexed, ask the user to run `mise install` instead of calling `index_repository` yourself.

## Library docs

- Before answering from memory about a third-party API (Zod, Tailwind 4, Playwright, citty, protobufjs, Shiki), call `resolve-library-id`, then `query-docs`.
- Bun is pinned to a canary build (`1.4.4-canary.20261103.1`), so Context7's Bun docs can lag it. When they disagree with `node_modules/bun-types`, trust `bun-types`.
