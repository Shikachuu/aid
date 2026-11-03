# Research: aid compared with other documentation tools

Status: historical research brief. The project chose Bun and TypeScript; see `site/docs/contributing/build-pipeline.md` for the current design.

_Date: 2026-05-10_

## Problem statement

aid (see `PRODUCT_OVERVIEW.md`) is a single-binary static documentation generator. It renders markdown, HTML, OpenAPI v2 and v3, and Protocol Buffers as colocated, path-routed pages. One Tailwind 4 theme styles every renderer. aid bundles linters and formatters and writes `llms.txt` plus per-page `.md` and `.json` exports.

When this brief was written, the repo had only the spec. We checked whether any existing tool already covers aid's combination of features, what moving to those tools would cost, and whether aid is worth building.

## Constraints

1. **Single binary.** No runtime dependency on Node, Python, or a JVM.
2. **Colocated formats.** Markdown, HTML, OpenAPI, and proto files sit side by side in any folder, and the file type picks the renderer.
3. **Interactive OpenAPI and proto UIs.** Both render as interactive reference pages, not static markdown.
4. **One Tailwind 4 theme** for prose, the OpenAPI reference UI, and the proto UI.
5. **LLM exports by default.** Each page has `.md` or `.json` versions, plus a spec-compliant `llms.txt`.
6. **Bundled linting and formatting** for markdown, OpenAPI, proto, CSS, and HTML.
7. Static output that S3, GitHub Pages, or nginx can serve without a runtime.

## Options evaluated

Three families of tools:

- **A. General-purpose static site generators with plugins.** Docusaurus, VitePress, Astro Starlight, MkDocs Material, Hugo, Nextra, Zola.
- **B. API-doc-first products.** Mintlify, Fern, ReadMe, Bump.sh, Stoplight, Scalar, Redocly, Swagger UI / SwaggerHub, Buf BSR.
- **C. Custom pipeline.** Scalar or Redocly CLI, protoc-gen-doc or sabledocs, Hugo or Zola, Tailwind standalone, Spectral, Buf, Biome, and a custom llms.txt script.

## Capability matrix

Legend: yes = native, partial = partial or via plugin, no = missing or stale.

| Capability | aid | Docusaurus | VitePress | Starlight | MkDocs Material | Hugo | Mintlify | Fern | Redocly | Scalar | Buf BSR | Custom pipeline |
| --------------------------------------------------- | --- | ---------- | --------- | --------- | --------------- | ---- | -------- | ---- | ------- | ------ | ------- | --------------- |
| Single binary / zero runtime | yes (macOS and Linux only) | no | no | no | no | yes | no | no | no | no | no | no |
| Interactive OpenAPI UI | yes | yes | yes | yes | partial (md-only) | partial | yes | yes | yes | yes | no | yes |
| Interactive proto UI | yes | partial (stale [1]) | no | no | partial (md-only) | no | no | yes | no | no | yes [2] | partial (stale [1]) |
| Markdown, HTML, OpenAPI, and proto colocated | yes | no | no | no | partial | no | no | no | no | no | no | no |
| One theme across all renderers | yes | partial | partial | partial (best of the JS tools) | yes (md-only) | no | yes | yes | yes | yes (OAS) | no | partial |
| llms.txt native | yes | partial (plugin) | partial (plugin) | partial (plugin) | partial (plugin) | partial | yes | partial | yes | partial | no | no (DIY) |
| One CLI lints and formats markdown, OpenAPI, proto, CSS, and HTML | yes | no | no | no | no | no | no | partial | partial | no | partial (proto) | no |
| Static output you can ship anywhere | yes | yes | yes | yes | yes | yes | no (SaaS) | partial | yes | yes | no | yes |
| OSS / no per-seat pricing | yes | yes | yes | yes | yes | yes | no | partial | partial | yes | partial | yes |

[1] `docusaurus-protobuffet` (last release May 2024) and `pseudomuto/protoc-gen-doc` (last release February 2022) are unmaintained.

[2] Buf BSR has proto docs, but it is a hosted registry, not a static site generator. It offers light and dark themes only.

No column except aid's is all yes. aid did not exist yet when this brief was written, so the question was whether the gap matters.

## Closest competitors

### Fern (closest on scope)

Fern is the only competitor that handles OpenAPI, Protobuf and gRPC, and prose in one tool. Its CLI runs on Node, it centers on a hosted runtime, and Postman acquired it in January 2026, which makes its direction uncertain. It fits teams that accept a Node toolchain and a commercial product.

### Mintlify (closest on developer experience)

Mintlify handles prose, OpenAPI, llms.txt, and AI search, and its themes are easy to customize. It has no proto support. It is SaaS-only at $300-$600 per month plus per-seat fees, and Mintlify serves the output only from its own CDN.

### Hugo (closest on distribution model)

Hugo is a single Go binary with OpenAPI shortcodes (Swagger UI and Redoc embeds) and a community llms-txt module. It has no proto support, and the embedded OpenAPI UI keeps its own styles instead of the prose theme.

### Docusaurus and PaloAltoNetworks/openapi-docs

This is the most complete open-source setup for OpenAPI and prose. The OpenAPI plugin is maintained (v4.7.1, January 2026). The proto plugin, `docusaurus-protobuffet`, last released in May 2024. Theming uses React and Infima, not Tailwind, and the OpenAPI panel inherits only part of the prose styles.

### Astro Starlight and starlight-openapi

Starlight keeps OpenAPI pages closest to the prose theme among JS static site generators. It has no proto plugin and requires Node.

### Custom pipeline

A realistic set is Scalar CLI, Spectral, Buf, protoc-gen-doc or sabledocs, Hugo or Zola, Tailwind standalone, Biome, markdownlint-cli2, and a custom llms.txt walker. That is 8-11 tools across 2-3 ecosystems.

## Migration effort if we drop aid

| Path                                                | Initial setup    | 1st-year maintenance | Config files | Themes to reconcile |
| --------------------------------------------------- | ---------------- | -------------------- | ------------ | ------------------- |
| Mintlify (SaaS, no proto)                           | < 1 day          | minimal              | 1 (`mint.json`) | 1                |
| Fern (Node CLI and hosted)                          | 1-2 days         | low (managed)        | 2-3          | 1                   |
| Docusaurus, openapi-docs, protobuffet, and an llms plugin | 1 day      | medium (proto plugin stale, may need fork) | 4-5 | 2 (Infima and OAS panel) |
| Astro Starlight, starlight-openapi, and protoc-gen-doc | 1-2 days      | low-medium           | 3-4          | 2                   |
| MkDocs Material, neoteroi, sabledocs, and llmstxt   | ~1 day           | low                  | 4            | 1 (everything converted to markdown) |
| Hugo, Swagger UI shortcode, protoc-gen-doc, and an llms module | 1-2 days | medium           | 3-4          | 2-3 (prose, Swagger UI, and proto HTML) |
| Custom pipeline (Scalar, Buf, sabledocs, Hugo, and others) | 3-6 days  | 0.5-1 day per quarter | 6-8         | 3+                  |

Real-world friction:

- **Theme drift.** Redoc controls the whole page layout, which makes it hard to embed. Scalar is the only OpenAPI renderer themed through CSS variables. Each proto renderer ships its own templates and CSS.
- **Unmaintained proto renderers.** `pseudomuto/protoc-gen-doc` last shipped in February 2022, `sabledocs` is a small Python project, and `docusaurus-protobuffet` last shipped in May 2024. Teams that want themed proto docs in 2026 must maintain a fork or write their own renderer.
- **Version drift between tools.** Tailwind 3 to 4, Node major versions, Spectral ruleset updates, the Docusaurus 3.10 Tabs API refactor, and Buf's protobuf v34 breaking changes (planned for 2026 Q1) can each break CI without warning.

## Where aid differs

1. **One binary with every piece.** It bundles interactive OpenAPI and proto renderers, the theme, linting and formatting, and the dev server. No competitor does this.
2. **One Tailwind theme across an interactive proto UI.** No maintained open-source interactive proto UI exists. This is aid's strongest advantage and was its hardest piece. aid now ships its own (`packages/proto-ui`).
3. **Colocated multi-format routing** (`api.yaml` and `events.proto` as siblings). Every competitor requires plugin-managed sections, prebuild conversion, or framework-specific layouts.
4. **Works offline, with no Node, SaaS, per-seat fee, or vendor.** Likely buyers are regulated industries (finance, defense, health), docs-as-code teams in engineering orgs, and teams that use gRPC or Connect heavily.

## Where aid loses

- **Markdown and OpenAPI without proto.** Hugo, Docusaurus, Starlight, and MkDocs already cover this, so aid's only advantage is the single binary.
- **Hosted search, AI chat, analytics, and customer key injection.** Mintlify, ReadMe, Fern, Scalar Cloud, Bump.sh, and Redocly Realm sell these features. aid is static and self-hosted and has none of them.
- **AsciiDoc users.** Most already use Antora, and aid does not read AsciiDoc.
- **Marketing reach.** Mintlify and Docusaurus have name recognition that aid will not match.

## Viability verdict

**No other tool covers aid's full feature set.** None combines a single binary, OpenAPI, proto, one theme, llms.txt, and bundled linting and formatting. The closest tools each miss at least two:

- Fern has no single binary and cannot run offline.
- Hugo and Zola have no interactive proto UI and do not theme OpenAPI pages with the prose theme.
- Docusaurus has no single binary, and its proto plugin is stale.
- Mintlify and ReadMe have no proto support and cannot be self-hosted.

The value of that combination depends on the target buyer:

- Pitched as a docs tool for teams with gRPC-first or mixed gRPC and REST APIs, aid fills a real gap. No maintained tool renders themed proto docs now that `protoc-gen-doc` has stalled.
- Pitched as another static site generator, aid loses to Hugo and Docusaurus, which have larger communities, more plugins, and years of production use.

### Biggest risk to aid

Resolved: aid built its own proto UI, `packages/proto-ui` (React and `protobufjs`), wired through `src/renderers/proto` and `src/web/proto-entry.ts`.

### Recommendation

aid is viable if the pitch is narrowed:

1. Lead with proto, OpenAPI, and prose in one site. Do not compete with Hugo on prose-only docs.
2. Validate the proto renderer plan before building anything else. If the plan is to wrap protoc-gen-doc, the one-theme claim is at risk. (Resolved: aid built its own renderer.)
3. In marketing, stress that aid works offline, has no vendor lock-in, and has no per-seat fee. SaaS competitors cannot offer these.
4. Generate llms.txt by default. Mintlify and Redocly already do, so leaving it out would put aid behind them.

If (1) and (2) hold, aid fills a gap no tool covers. If they fail, aid is another single-binary static site generator and competes with Hugo from a weaker position.

## Open questions

1. Resolved: the language is Bun and TypeScript.
2. Resolved: the OpenAPI UI is Scalar (`@scalar/api-reference`).
3. Resolved: aid built its own proto UI (`packages/proto-ui`).
4. Resolved: Tailwind runs in-process through the `@tailwindcss/node` and `@tailwindcss/oxide` npm packages, with native files staged per target.
5. Is gRPC-first the right first market, or are teams with mixed REST and proto APIs in finance and other regulated industries a better one?

## Sources

This brief did not keep the source URLs. The key references were: Mintlify pricing, Fern and the Postman acquisition (January 2026), PaloAltoNetworks/docusaurus-openapi-docs, starlight-openapi, vitepress-openapi, mkdocs neoteroi, Hugo Relearn OpenAPI shortcode, pseudomuto/protoc-gen-doc release history, sabledocs, Buf BSR docs, Tailwind standalone CLI, Redocly llms.txt blog, and Speakeasy "Choosing a docs vendor" comparison.
