---
title: OpenAPI pages
description: How aid detects OpenAPI and Swagger specs, parses and upgrades them to OpenAPI 3.1, renders them with Scalar, and exports them as JSON.
sidebar:
  order: 3
---

aid turns every OpenAPI or Swagger spec in the content folder into an API reference page. It parses the spec at build time and Scalar renders it in the browser. The [configuration schema](../reference/config-schema.yaml) page of this site is an OpenAPI page built from `site/docs/reference/config-schema.yaml`.

## Use it

Put a spec anywhere in the content folder, for example `docs/api.yaml`:

```yaml
openapi: 3.1.0
info:
  title: Pets API
  version: 1.0.0
  description: Create, list, and adopt pets.
paths:
  /pets:
    get:
      operationId: listPets
      summary: List all pets
      responses:
        "200":
          description: A list of pets.
```

`aid build` writes the page to `dist/api/index.html` and the export to `dist/api.json`. The page title and sidebar label are "Pets API".

## Detection

aid only reads `.yaml`, `.yml`, and `.json` files as specs when the first 64 KiB holds a version key.

- In YAML, a line must start with `openapi:` or `swagger:` followed by a version number, quoted or not.
- In JSON, the file must contain `"openapi": "<digit>...` or `"swagger": "<digit>...`.

aid skips any other YAML or JSON file without a warning. The file name does not matter for rendering.

## Parsing

aid runs the spec through `@scalar/openapi-parser` at build time, in three steps:

1. `normalize` reads the YAML or JSON text into an object. A source that is not a mapping fails the build.
2. `upgrade` converts Swagger 2.0 and OpenAPI 3.0 to OpenAPI 3.1.
3. `dereference` resolves the `$ref` pointers inside the file.

aid does not load other files. A `$ref` to another file, such as `./schemas/pet.yaml#/Pet`, stays unresolved, and aid prints a warning. The build continues and the page renders with the `$ref` left in place.

```text
aid: <abs path>/docs/api.yaml: <root> — Can't resolve external reference: ./schemas/pet.yaml
```

## Title and description

- The title is `info.title`. A spec without one uses the file name without its extension. The title fills `<title>`, the page H1, the sidebar label, and search results.
- `info.description` becomes the page's line in [llms.txt](../llms-txt/index.md). aid does not write it into `<meta name="description">` or the search index.

OpenAPI pages have no frontmatter, so set the sidebar label and order in the folder's `_meta.yaml`. See [navigation](./navigation.md#_metayaml).

## Rendering

The page holds the parsed spec as JSON in `<script type="application/json" id="aid-openapi-spec">` next to an empty mount element. A browser bundle built from `@scalar/api-reference` reads the JSON and mounts Scalar with these settings, set in `src/web/openapi-entry.ts`:

- the `modern` layout;
- Scalar's own search box hidden, because aid's search indexes the spec;
- Scalar's own dark mode toggle hidden;
- Scalar's agent feature turned off.

aid emits the Scalar bundle and its stylesheet only when the site has at least one OpenAPI page, and only OpenAPI pages load them. The bundled theme maps aid's color and font tokens onto Scalar's `--scalar-*` CSS variables.

## The .json export

aid writes the parsed spec to `<route>.json` as indented JSON. It is OpenAPI 3.1 after the upgrade and `$ref` resolution, not the source text. A Swagger 2.0 source exports as OpenAPI 3.1.

## Search

aid indexes the title and these fields of the spec, so a search for an operation id finds the page:

- operation ids;
- path templates, such as `/pets/{id}`;
- schema names under `components.schemas`;
- parameter names;
- operation summaries.

OpenAPI pages rank higher than markdown pages by default through `search.weights.openapi`. See [search](../search/index.md).

## Linking into a spec

Markdown and HTML pages can link to a spec by its source file, for example `[API](./api.yaml)`. aid checks that the page exists. It does not check `#fragment` links into OpenAPI pages, because Scalar creates the element ids in the browser.

## Linting

> [!WARNING]
> `aid lint` only lints OpenAPI files named `openapi.yaml`, `openapi.yml`, `openapi.json`, `*.openapi.yaml` (and `.yml`, `.json`), or files under an `openapi/` folder. A spec named `api.yaml` renders as a page, but `aid lint` skips it. See [lint defaults](../reference/lint-defaults.md).

## Limitations

> [!WARNING]
> Not supported: `$ref` pointers to other files, frontmatter-style `sidebar` or `llms` settings, and Scalar configuration from `aid.yaml`.
