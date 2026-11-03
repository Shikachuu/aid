---
title: Protobuf pages
description: How aid renders .proto files - build-time parsing for the title, description, and search, and the @aid/proto-ui reference that renders in the browser.
sidebar:
  order: 4
---

aid turns every `.proto` file in the content folder into an API reference page. The build parses the file for its title, description, and search entries. The page itself is a shell. In the browser, a React component from `@aid/proto-ui` fetches the `.proto` file and renders the reference. The [proto example](./proto-example.proto) page of this site is built from `site/docs/content-types/proto-example.proto`.

## Use it

Put a `.proto` file anywhere in the content folder, for example `docs/billing.proto`:

```proto
syntax = "proto3";

// Charges customers and issues refunds.
package acme.billing.v1;

service BillingService {
  // Charges a customer once.
  rpc Charge(ChargeRequest) returns (ChargeResponse);
}

message ChargeRequest {
  // Amount in cents.
  int64 amount = 1;
}

message ChargeResponse {
  string charge_id = 1;
}
```

`aid build` writes the page shell to `dist/billing/index.html` and copies the source to `dist/billing.proto`. The page title is `acme.billing.v1`, and the description is "Charges customers and issues refunds."

## Build time

aid parses the file with `protobufjs` and reads:

- the title, which is the `package` name, or the file name without `.proto` when the file has no package;
- the description, which is the first paragraph of the `//` comment block directly above `package`, with line breaks joined into one line. An empty `//` line starts a new paragraph. Blank lines between the comment and `package` are allowed, but any other statement in between, such as `syntax` or `option`, ends the block;
- the search entries listed in [search](#search).

A syntax error that `protobufjs` cannot parse fails the build.

The description goes into [llms.txt](../llms-txt/index.md). aid does not write it into `<meta name="description">`. Proto pages have no frontmatter, so set their sidebar label and order in the folder's `_meta.yaml`. This site gives `proto-example.proto` the label "Proto example" there. See [navigation](./navigation.md#_metayaml).

## In the browser

The page holds an H1 with the title and a mount element whose `data-proto-url` holds the absolute URL of the `.proto` export, including `base_path`. The `aid-proto` bundle fetches that file, parses it again with the same parser, and renders `ProtoReference` from `@aid/proto-ui` in place of the "Loading proto documentation" text. A failed fetch or parse shows `Failed to load proto:` and the error.

aid emits the proto bundle and its stylesheet only when the site has at least one proto page, and only proto pages load them. The bundled theme maps aid's color and font tokens onto the `--proto-*` CSS variables.

The reference contains:

- a sidebar inside the page, grouped into Services, Messages, and Enums, that links to each top-level entity;
- a package header with the package name and the package comment;
- one section per service, with each RPC as a signature such as `rpc WatchPages(WatchPagesRequest) returns (stream WatchPagesResponse);`, including `stream` on either side;
- one section per message, with a field table of number, name, type, rule (`repeated`, `optional`, or `required`), and comment, and `map<K, V>` for map fields;
- each `oneof` as its own block under the message, listing its member fields;
- nested messages and enums below their parent message;
- one section per enum, with a table of number, name, and comment;
- a `deprecated` badge on deprecated services, messages, enums, and enum values;
- a "view source" toggle on each entity with its declaration, rebuilt without options and reserved ranges;
- a copy-link button on each entity heading.

> [!WARNING]
> The reference shows no `deprecated` badge on deprecated fields or RPCs yet.

## Cross-links

Every entity heading has its fully qualified name as its `id`, for example `aid.example.v1.Page` or `aid.example.v1.Page.Heading`. Each RPC has the id `<service>.<rpc>`, for example `aid.example.v1.PageService.GetPage`.

- A field or RPC type defined in the same file links to its entity on the page.
- A `google.protobuf.*` well-known type, such as `google.protobuf.Timestamp`, links to its entry on protobuf.dev.
- Any other type that does not resolve, such as a type from another imported file, renders as plain text.

> [!WARNING]
> `protobufjs` resolves types in declaration order and stops at the first type it cannot resolve, such as a type from an imported file. Types referenced after that point lose their cross-links. `proto-example.proto` declares its only imported type, `google.protobuf.Timestamp`, in its last field for this reason.

aid does not check `#fragment` links from markdown or HTML pages into proto pages, because the ids exist only after the browser renders the reference.

## Comments

Comments above services, RPCs, messages, fields, oneofs, enums, and enum values render as markdown through `marked`. Raw HTML in a comment is escaped and shows as text. A link or image URL with a scheme other than `http`, `https`, or `mailto`, such as `javascript:`, becomes `#`.

## The .proto export

The export at `<route>.proto` is the source file unchanged. The page fetches it, and [llms.txt](../llms-txt/index.md) links to it.

## Search

aid indexes the title, the comments on the package, services, RPCs, messages, fields, and enums, and these names:

- message and enum names, fully qualified, including nested ones;
- service names, fully qualified;
- RPC names as `<service>.<rpc>`;
- field names of top-level messages.

Proto pages rank above markdown pages by default through `search.weights.proto`. See [search](../search/index.md).

## Limitations

> [!WARNING]
> Not supported: imports across `.proto` files, cross-links between proto pages, and `#fragment` checks into proto pages.
