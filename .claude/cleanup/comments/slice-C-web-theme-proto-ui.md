# Comment cleanup: slice C (src/web, src/theme, packages/proto-ui, assets/scaffold)

Source: comment-auditor, whole-tree audit. Verdict: REQUEST CHANGES.

## Must kill

### Stubs

These are TODO equivalents with no tracked issue. Implement the stub or remove it. Coordinate with the ponytail pass.

- src/web/ai-button.ts:3 "Stub." and :9 the empty click handler comment.
- src/web/dark-mode.ts:5 "Stub." and :13 "cycle theme + persist". The handler is empty.
- src/theme/partials.ts:8-9 on `resolvePartial`: the params are unused and it returns `fallback`.

### Entry-point narration

- src/web/mermaid-entry.ts:3-7, src/web/openapi-entry.ts:3-12, src/web/proto-entry.ts:3-9 -> delete.

### Generated header

- src/web/_bundled.ts:1-15: the header is emitted by the template in scripts/bundle-web.ts:126-146. Change the template, not the generated file. A bigger fix is to emit `_bundled.ts` to a gitignored path, which removes the "git checkout before committing" workflow. That is a ponytail item.

### src/theme/main.css

- :3-8: override instructions. These belong in the docs.
- :21-24, :37-40, :136-139: section banners.
- :70-75: restates the `@apply`.
- :80-85: the Scalar token bridge narration. Its last sentence justifies raw CSS that .claude/rules/css.md forbids.
- :97-103: the proto-ui token bridge narration.

## Correctness

- packages/proto-ui/src/components/DocBlock.tsx:23: `biome-ignore noDangerouslySetInnerHtml` with the reason "comments come from trusted .proto source files; v1 does not sanitize".
  - `marked.parse(raw)` goes into `dangerouslySetInnerHTML` without sanitizing.
  - `ProtoReference` accepts `protoText` and `protoUrl` from any consumer, and the package claims "consumable by any React app".
  - A `<script>` or `<img onerror>` in a `.proto` comment therefore executes, which is an XSS bug.
  - Fix: escape raw HTML (override marked's `html` renderer) or sanitize the output, then drop the suppression.

## Nits: wrong or too long

- packages/proto-ui/src/hydrate.tsx:7-12 says "hydrate", but the code calls `createRoot`. Rewrite it.
- packages/proto-ui/src/components/MessageBlock.tsx:12 says "Heading level", but `depth` only feeds `data-depth`.
- src/web/dark-mode.ts:1-4 describes behavior that is not implemented.
- src/web/mermaid.ts:1-8: "~600 kB" is unverified, and the doc narrates the implementation.
- src/theme/components/PageProto.tsx:10-16 and PageHtml.tsx:9-14 narrate internals. State the contract only.
- src/theme/components/Layout.tsx:16, :18, :26, :28 restate the conditionals.
- Layout.tsx:30-33 duplicates Header.tsx:8.
- Layout.tsx:20-24: shorten the symptom list.
- src/theme/components/SearchBox.tsx:14-19 lists data attributes. The doc on `weights` at :10 narrates `boostDocument`.
- packages/proto-ui/src/hooks/useProtoAst.ts:4-8, :24-29: the SWR / react-query filler.
- ProtoReference.tsx:9-13 duplicates the union.
- ProtoReference.tsx:22 restates the prop. :20 "(defaults to '')" is wrong.
- packages/proto-ui/scripts/build.ts:12-15: the export names `./sync` and `./async` may be stale (`./unstable/*`). Trim the perf narration.
- packages/proto-ui/src/parser.ts:130-131: keep the first sentence and drop the second.
- packages/proto-ui/src/tailwind-entry.css:6-10: drop "Site-wide design tokens belong in @theme".
- assets/scaffold/main.css:3-12, :15-17: user-facing scaffold docs. Keep them, and drop the duplicated "via @theme" sentence.

## Nits: JSDoc that restates the name

- src/theme/components/Header.tsx:5, SearchBox.tsx:4

## Nits: exports missing JSDoc

- src/theme/components:
  - AIButton.tsx:1, DarkToggle.tsx:1, Footer.tsx:3
  - Header.tsx:12, Layout.tsx:9, :38, Nav.tsx:3
  - PageHtml.tsx:4, PageIndex.tsx:3, PageMarkdown.tsx:4, :9
  - PageOpenAPI.tsx:4, :11, PageProto.tsx:3
- src/web/_bundled.ts:17-22: the generator must emit a one-line JSDoc per export.
- packages/proto-ui/src/components:
  - DeprecatedBadge:1, DocBlock:4, :9, EntityHeader:4, :18
  - EnumBlock:8, :12, FileSourceLink:1, :6
  - MessageBlock:9, :21, PackageHeader:4, :10
  - ProtoReference:19, :28, RpcSignature:4, :9
  - ServiceBlock:8, :13, Sidebar:3, :8
  - TypeRef:3, :19, ViewSource:3, :7
  - print-proto.ts:65, :74
- packages/proto-ui/src/hooks/useProtoAst.ts:15
- packages/proto-ui/src/hydrate.tsx:5
- packages/proto-ui/src/parser.ts:3, :5, :16, :29, :35, :42, :51, :63, :73, :82, :84

## Kept

- assets/scaffold/aid.yaml:1: modeline.
- src/theme/main.css:115-120: the Shiki dual-theme vendor contract.
- src/web/search.ts:85: browser blur-before-click ordering.
- packages/proto-ui/src/parser.ts:130 (first sentence): protobufjs `resolveAll` throws.
- packages/proto-ui/src/components/DocBlock.tsx:5: protobufjs strips the comment markers.
- packages/proto-ui/src/parser.ts:6-25, :92, :113-120, print-proto.ts:24-28, search.ts:8-14, PageOpenAPI.tsx:6, PageProto.tsx:5, SearchBox.tsx:1, :6, :8, Header.tsx:8: contract docs.
