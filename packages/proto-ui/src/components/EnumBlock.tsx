import type { ProtoEnum } from "../parser"
import { DeprecatedBadge } from "./DeprecatedBadge"
import { DocBlock } from "./DocBlock"
import { EntityHeader } from "./EntityHeader"
import { printEnum } from "./print-proto"
import { ViewSource } from "./ViewSource"

type EnumBlockProps = {
  enumEntity: ProtoEnum
}

/** Render an enum with its doc comment, value table and reconstructed declaration. */
export const EnumBlock = ({ enumEntity }: EnumBlockProps) => (
  <section className="proto-enum">
    <EntityHeader
      kind="enum"
      name={enumEntity.name}
      fqn={enumEntity.fqn}
      deprecated={enumEntity.deprecated}
    />
    <DocBlock raw={enumEntity.comment} />
    <table className="proto-enum-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Name</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {enumEntity.values.map((v) => (
          <tr key={v.name} className="proto-enum-row">
            <td className="proto-enum-number">{v.number}</td>
            <td className="proto-enum-name">
              {v.name}
              {v.deprecated ? (
                <>
                  {" "}
                  <DeprecatedBadge />
                </>
              ) : null}
            </td>
            <td className="proto-enum-doc">
              <DocBlock raw={v.comment} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    <ViewSource declaration={printEnum(enumEntity)} />
  </section>
)
