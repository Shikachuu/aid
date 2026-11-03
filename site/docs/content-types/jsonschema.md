---
title: JSON Schema pages
description: How aid renders JSON Schema files as static field reference pages, with type chips, collapsible fields, resolved $refs, and a generated example.
sidebar:
  order: 6
---

aid turns every JSON Schema file in the content folder into a field reference page. The build renders the whole page to static HTML, so it needs no browser bundle and works without JavaScript. The [aid.yaml JSON Schema](../reference/aid-schema.json) page of this site is built from aid's own published config schema.

## Use it

Put a schema anywhere in the content folder, for example `docs/user.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "User",
  "description": "An account that can sign in.",
  "type": "object",
  "required": ["id"],
  "properties": {
    "id": { "type": "string", "format": "uuid", "description": "Stable identifier." },
    "tags": { "type": "array", "items": { "type": "string" }, "uniqueItems": true },
    "address": { "$ref": "#/$defs/Address" }
  },
  "$defs": {
    "Address": {
      "type": "object",
      "properties": { "city": { "type": "string" } }
    }
  }
}
```

`aid build` writes the page to `dist/user/index.html` and the schema to `dist/user.json`. The page title is `User`, and the description is "An account that can sign in."

## Detection

A `.json`, `.yaml`, or `.yml` file in the content folder becomes a JSON Schema page when its top-level `$schema` value starts with `http://json-schema.org/` or `https://json-schema.org/`.

- aid first looks for that `$schema`, quoted or not, in the first 64 KiB of the file. A file without a match is skipped.
- A file with a match is parsed, and only a top-level `$schema` counts. A data file that embeds a schema fragment deeper down stays skipped.
- A file with a match that fails to parse becomes a page anyway, so the build reports the syntax error instead of dropping the file.
- aid checks for OpenAPI first, so an OpenAPI 3.1 spec whose models carry `$schema` keys stays an OpenAPI page.
- A file whose `$schema` points somewhere else, such as a `biome.json`, is skipped. A schema without a `$schema` key is skipped too. Add the key to publish it.

To keep a schema in the content folder out of the site, start its file name or a parent folder name with `_`, such as `_internal.json`.

The route is the file path without its extension, so `docs/user.json` is `/user`. See [content types](./index.md#routes).

## The page

The page has these parts, in order:

- an H1 with the root `title`, or the file name when the schema has no title;
- chips for the root type and the dialect, such as `JSON Schema 2020-12` or `JSON Schema draft-07`;
- the root `description`;
- a "Properties" section with one collapsible block per property;
- a "Schema example" block;
- a "Definitions" section with one block per `$defs` or `definitions` entry.

Each property block shows its name, followed by a chip for each of these flags:

| Chip | Shown when |
| --- | --- |
| `required` | the parent's `required` list names the property, or the property has draft-03 `required: true` |
| `deprecated` | `deprecated: true` |
| `nullable` | `type` lists `"null"`, or the property has `nullable: true` |
| `read-only`, `write-only` | `readOnly: true`, `writeOnly: true` |

The block body shows:

- the field's `title`, when it has one;
- the type line, for example `Type: string` with a `uuid` format chip, or `array<string>`, `[string, integer]` for a tuple (`[string, ...integer]` when more items follow), `Base & (string | integer)` for an `allOf` that does not merge, or a definition name such as `Address`;
- the `description`;
- `Allowed values`, `Value`, `Default`, and `Example` lines from `enum`, `const`, `default`, and `examples`;
- nested fields for object properties, `patternProperties`, `additionalProperties`, tuple and array items, and `oneOf`, `anyOf`, and `allOf` options;
- an "All schema constraints and annotations" toggle with every other keyword and its JSON value, such as `minLength`, `pattern`, `uniqueItems`, `$comment`, or `x-*` extensions.

Top-level properties and their children start open. Deeper levels start collapsed.

Without a `type`, aid infers one: `properties` means `object`, `items` means `array`, and `enum` or `const` values give their JSON types. A `true` subschema shows as `any`, and `false` as `never`.

Descriptions render as markdown with GFM. Raw HTML in a description shows as escaped text, so a placeholder such as `<host>:<port>` stays readable, and a link or image URL with a scheme other than `http`, `https`, or `mailto`, such as `javascript:`, becomes `#`. Relative links resolve like links in markdown pages: `[setup](./setup.md#install)` rewrites to the route URL, and a link to a missing page or heading fails the build. A relative image such as `![diagram](./diagram.png)` is copied next to the page, and a missing image fails the build. See [links](./links.md).

## $ref resolution

aid resolves `$ref` inside the same file: JSON pointers such as `#/$defs/Address` or `#/definitions/Address`, `#` for the root, `$anchor` names, and embedded `$id` URLs.

- A resolved `$ref` expands inline under the field and shows the target name as its type. Keywords next to the `$ref` apply on top of the target. A `description` replaces the target's, and `properties` and `required` combine with the target's, so `{"$ref": "#/$defs/Base", "properties": {...}}` extends `Base`. A property declared on both sides keeps both declarations: an override that only adds a `description` keeps the target's type and format.
- A `$ref` back to a schema that is already open on the current path, such as a tree node that contains itself, does not expand again. Its type links to the definition section when the target is a root `$defs` or `definitions` entry, or to the top of the page for `#`. A cycle through any other pointer, such as `#/properties/node`, shows the type name without a link.
- Expansion stops 32 levels deep. A field at that depth lists its nested keywords as JSON in its constraints toggle instead of as fields.
- A relative `$ref` to another schema file, such as `./address.json#/$defs/Street`, links to that file's page when it is a JSON Schema page in the content folder. A `$defs` or `definitions` fragment links to the matching definition section.
- A remote `http://` or `https://` `$ref` shows its last path segment as the type, links to the URL, and prints a warning: `aid: <file>: unresolved $ref "<ref>"`. aid does not fetch it.
- Any other `$ref` that does not resolve shows its last path segment without a link and prints the same warning. The build continues.

An `allOf` whose members are objects with compatible keywords merges into one field list, with `properties` and `required` combined. An `allOf` with conflicting keywords, or one whose `$ref`s lead back to itself, shows as an "All of" group of options instead.

## Schema example

When the root has an `examples` array, the page shows each entry. Otherwise aid builds one example from the schema. For each field it takes the first of these that exists:

1. the first entry of `examples`;
2. `example`, `default`, or `const`;
3. the first `enum` value;
4. a value built from the type: an object with an entry per property, an array with one item, `true`, `null`, `minimum` or `0` for numbers, and for strings a sample for the formats `date-time`, `date`, `time`, `email`, `uri`, `url`, `hostname`, `uuid`, `ipv4`, and `ipv6`, or `"string"` otherwise.

`oneOf` and `anyOf` use their first option. A recursive `$ref` is left out of the example. aid stops building the example after 2000 values, so a very large schema gets a partial example.

## Anchors

Every field and definition has an `id`, so other pages can link into the schema:

- root properties are `prop-<name>`, and nested ones join their path with dots, such as `prop-address.city`;
- array items add `items`, and tuple items add their position, such as `prop-tags.items`;
- definitions are `def-<name>`, and their fields are `def-<name>.<field>`.

Characters other than letters (including non-ASCII ones), digits, `_`, `~`, and `-` become `-`, so a property named `a.b` gets `prop-a-b` and never clashes with a nested `a.b` path. A repeated id gets a `-2` suffix. Unlike OpenAPI and proto pages, aid checks `#fragment` links into JSON Schema pages, so `[name](./user.json#prop-name)` fails the build when the field does not exist.

## The .json export

The export at `<route>.json` is the parsed schema written as JSON with two-space indentation. A YAML source becomes JSON. [llms.txt](../llms-txt/index.md) links to the export, and the page uses the first paragraph of the root `description` as its llms.txt description.

## Search

aid indexes the title, every description, the definition names as headings, and the dotted path of every property, such as `address.city`. JSON Schema pages rank above markdown pages by default through `search.weights.jsonschema`. See [search](../search/index.md).

## Styling

Every element carries an `aid-schema-*` class, and the chips use aid's color tokens: `required` uses the caution color, `deprecated` the warning color, the type the accent color, the format the tip color, and `nullable` the important color. Override them like any other class hook. See [theming](../theming/index.md#class-hooks).

## Errors

A file that is not valid JSON or YAML fails the build:

```text
aid: failed to parse JSON Schema at <abs path>/docs/user.json: <parser message>
```

A root that is not an object or a boolean fails with `the root is not an object or boolean schema`.

A schema with the same route as another source, such as `user.json` next to `user.md`, fails the build with a route collision. Rename one, or start the schema's file name with `_` to keep it out of the site. See [content types](./index.md#errors).

A broken relative link in a description fails the build with `link/missing` or `link/anchor`, like a broken link in a markdown page. The report names the schema file without a line number, because the link sits inside a JSON string.

## Limitations

> [!WARNING]
> Not supported: fetching remote `$ref` URLs, meta-schema validation in `aid lint`, and frontmatter. Set the sidebar label and order of a schema page in the folder's `_meta.yaml`, as for OpenAPI and proto pages. See [navigation](./navigation.md#_metayaml).
