import { type Child, RawHtml } from "../../jsx-runtime"
import { type SchemaDocument, type SchemaNode, typeLabel } from "../../renderers/jsonschema/model"

type PageJsonSchemaProps = {
  title: string
  doc: SchemaDocument
  descriptionHtml: Map<string, string>
  exampleHtml: string[]
}

const VARIANT_LABEL = { oneOf: "One of", anyOf: "Any of", allOf: "All of" } as const

/**
 * Render a JSON Schema reference: one collapsible block per field, the
 * schema example, and an anchored section per definition.
 */
export function PageJsonSchema({ title, doc, descriptionHtml, exampleHtml }: PageJsonSchemaProps) {
  const root = doc.root
  return (
    <article class="aid-page aid-page-jsonschema">
      <h1>{title}</h1>
      <p class="aid-schema-meta">
        <Chip kind="type">{typeLabel(root)}</Chip>
        {root.format ? <Chip kind="format">{root.format}</Chip> : null}
        <Flags node={root} />
        {doc.dialect ? <Chip kind="dialect">{dialectLabel(doc.dialect)}</Chip> : null}
      </p>
      <Description text={root.description} descriptionHtml={descriptionHtml} />
      <Values node={root} />
      {root.properties.length > 0 ? <h2 id="properties">Properties</h2> : null}
      <Children node={root} descriptionHtml={descriptionHtml} depth={0} />
      <Constraints node={root} />
      {exampleHtml.length > 0 ? (
        <section class="aid-schema-example">
          <h2 id="schema-example">
            {exampleHtml.length > 1 ? "Schema examples" : "Schema example"}
          </h2>
          {exampleHtml.map((html) => (
            <RawHtml key={html} html={html} />
          ))}
        </section>
      ) : null}
      {doc.definitions.length > 0 ? (
        <section class="aid-schema-definitions">
          <h2 id="definitions">Definitions</h2>
          {doc.definitions.map((def) => (
            <section key={def.elementId} class="aid-schema-definition" id={def.elementId}>
              <h3 class="aid-schema-definition-title">
                <code>{def.label}</code>
                <Flags node={def} />
              </h3>
              <Title node={def} />
              <TypeLine node={def} />
              <Description text={def.description} descriptionHtml={descriptionHtml} />
              <Values node={def} />
              <Children node={def} descriptionHtml={descriptionHtml} depth={0} />
              <Constraints node={def} />
            </section>
          ))}
        </section>
      ) : null}
    </article>
  )
}

function SchemaField({
  node,
  descriptionHtml,
  depth,
}: {
  node: SchemaNode
  descriptionHtml: Map<string, string>
  depth: number
}) {
  return (
    <details class="aid-schema-field" id={node.elementId} open={depth < 2}>
      <summary class="aid-schema-field-summary">
        <code class="aid-schema-field-name">{node.label}</code>
        {node.kind === "pattern" ? <Chip kind="pattern">pattern</Chip> : null}
        {node.kind === "additional" ? <Chip kind="pattern">additional properties</Chip> : null}
        <Flags node={node} />
      </summary>
      <div class="aid-schema-field-body">
        <Title node={node} />
        <TypeLine node={node} />
        <Description text={node.description} descriptionHtml={descriptionHtml} />
        <Values node={node} />
        <Children node={node} descriptionHtml={descriptionHtml} depth={depth + 1} />
        <Constraints node={node} />
      </div>
    </details>
  )
}

function Flags({ node }: { node: SchemaNode }) {
  return (
    <>
      {node.required ? <Chip kind="required">required</Chip> : null}
      {node.deprecated ? <Chip kind="deprecated">deprecated</Chip> : null}
      {node.nullable ? <Chip kind="nullable">nullable</Chip> : null}
      {node.readOnly ? <Chip kind="readonly">read-only</Chip> : null}
      {node.writeOnly ? <Chip kind="writeonly">write-only</Chip> : null}
    </>
  )
}

function Chip({ kind, children }: { kind: string; children?: Child }) {
  return <span class={`aid-schema-chip aid-schema-chip-${kind}`}>{children}</span>
}

function Title({ node }: { node: SchemaNode }) {
  return node.title && node.title !== node.label ? (
    <p class="aid-schema-title">{node.title}</p>
  ) : null
}

function TypeLine({ node }: { node: SchemaNode }) {
  const label = <code class="aid-schema-type">{typeLabel(node)}</code>
  return (
    <p class="aid-schema-type-line">
      Type: {node.ref?.href ? <a href={node.ref.href}>{label}</a> : label}
      {node.format ? <Chip kind="format">{node.format}</Chip> : null}
    </p>
  )
}

function Description({
  text,
  descriptionHtml,
}: {
  text?: string
  descriptionHtml: Map<string, string>
}) {
  const html = text === undefined ? undefined : descriptionHtml.get(text)
  return html ? (
    <div class="aid-schema-description">
      <RawHtml html={html} />
    </div>
  ) : null
}

function Values({ node }: { node: SchemaNode }) {
  return (
    <>
      {node.enum ? <Value label="Allowed values" values={node.enum} /> : null}
      {node.const ? <Value label="Value" values={[node.const.value]} /> : null}
      {node.default ? <Value label="Default" values={[node.default.value]} /> : null}
      {node.examples.length > 0 ? (
        <Value label={node.examples.length > 1 ? "Examples" : "Example"} values={node.examples} />
      ) : null}
    </>
  )
}

function Value({ label, values }: { label: string; values: unknown[] }) {
  return (
    <p class="aid-schema-value">
      <span class="aid-schema-value-label">{label}:</span>{" "}
      {values
        .map((v) => JSON.stringify(v))
        .map((json) => (
          <code key={json} class="aid-schema-value-item">
            {json}
          </code>
        ))}
    </p>
  )
}

function Children({
  node,
  descriptionHtml,
  depth,
}: {
  node: SchemaNode
  descriptionHtml: Map<string, string>
  depth: number
}) {
  const items = node.items && !isBareItem(node.items) ? [node.items] : []
  const fields = [...node.properties, ...node.prefixItems, ...items]
  if (fields.length === 0 && node.variants.length === 0) {
    return null
  }
  return (
    <div class={depth === 0 ? "aid-schema-fields" : "aid-schema-children"}>
      {fields.map((f) => (
        <SchemaField key={f.elementId} node={f} descriptionHtml={descriptionHtml} depth={depth} />
      ))}
      {node.variants.map((group) => (
        <div key={group.kind} class="aid-schema-variants">
          <p class="aid-schema-variants-label">{VARIANT_LABEL[group.kind]}</p>
          {group.options.map((o) => (
            <SchemaField
              key={o.elementId}
              node={o}
              descriptionHtml={descriptionHtml}
              depth={depth}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function Constraints({ node }: { node: SchemaNode }) {
  if (node.constraints.length === 0) {
    return null
  }
  return (
    <details class="aid-schema-constraints">
      <summary class="aid-schema-constraints-summary">
        All schema constraints and annotations
      </summary>
      <dl class="aid-schema-constraint-list">
        {node.constraints.map(([key, value]) => (
          <div key={key} class="aid-schema-constraint">
            <dt>
              <code>{key}</code>
            </dt>
            <dd>
              <code>{JSON.stringify(value)}</code>
            </dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

function isBareItem(node: SchemaNode): boolean {
  return (
    node.properties.length === 0 &&
    node.prefixItems.length === 0 &&
    node.variants.length === 0 &&
    node.constraints.length === 0 &&
    node.examples.length === 0 &&
    !node.description &&
    !node.title &&
    !node.nullable &&
    !node.deprecated &&
    !node.readOnly &&
    !node.writeOnly &&
    !node.enum &&
    !node.const &&
    !node.default &&
    !node.format &&
    !node.ref?.href &&
    (!node.items || isBareItem(node.items))
  )
}

function dialectLabel(url: string): string {
  const version = /draft[-/]?(\d{4}-\d{2}|\d+)/i.exec(url)?.[1]
  if (!version) {
    return "JSON Schema"
  }
  return `JSON Schema ${version.includes("-") ? version : `draft-${version.padStart(2, "0")}`}`
}
