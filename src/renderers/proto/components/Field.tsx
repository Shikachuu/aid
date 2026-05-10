import type { ProtoField } from "../parser"

export function Field({ field }: { field: ProtoField }) {
  return (
    <tr class="aid-proto-field">
      <td>{field.rule}</td>
      <td>{field.type}</td>
      <td>{field.name}</td>
      <td>{field.number}</td>
    </tr>
  )
}
