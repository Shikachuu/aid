import type { ProtoMessage } from "../parser"
import { DocBlock } from "./DocBlock"
import { EntityHeader } from "./EntityHeader"
import { EnumBlock } from "./EnumBlock"
import { printMessage } from "./print-proto"
import { TypeRef } from "./TypeRef"
import { ViewSource } from "./ViewSource"

type MessageBlockProps = {
  message: ProtoMessage
  baseHref?: string
}

export const MessageBlock = ({ message, baseHref }: MessageBlockProps) => {
  const visibleFields = message.fields.filter((f) => !f.oneofName)
  return (
    <section className="proto-message">
      <EntityHeader
        kind="message"
        name={message.name}
        fqn={message.fqn}
        deprecated={message.deprecated}
      />
      <DocBlock raw={message.comment} />
      {visibleFields.length > 0 ? (
        <table className="proto-field-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Type</th>
              <th>Rule</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {visibleFields.map((f) => (
              <tr key={f.name} className="proto-field-row">
                <td className="proto-field-number">{f.number}</td>
                <td className="proto-field-name">{f.name}</td>
                <td className="proto-field-type">
                  {f.mapKey ? (
                    <>
                      <span className="proto-type-scalar">map&lt;</span>
                      <TypeRef reference={f.mapKey} baseHref={baseHref} />
                      <span className="proto-type-scalar">, </span>
                      <TypeRef reference={f.type} baseHref={baseHref} />
                      <span className="proto-type-scalar">&gt;</span>
                    </>
                  ) : (
                    <TypeRef reference={f.type} baseHref={baseHref} />
                  )}
                </td>
                <td className="proto-field-rule">{f.rule === "singular" ? "" : f.rule}</td>
                <td className="proto-field-doc">
                  <DocBlock raw={f.comment} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {message.oneofs.map((o) => (
        <section key={o.name} className="proto-oneof">
          <h3 className="proto-oneof-name">oneof {o.name}</h3>
          <DocBlock raw={o.comment} />
          <ul className="proto-oneof-fields">
            {message.fields
              .filter((f) => f.oneofName === o.name)
              .map((f) => (
                <li key={f.name} className="proto-oneof-field">
                  <span className="proto-field-number">{f.number}</span>{" "}
                  <span className="proto-field-name">{f.name}</span>{" "}
                  <TypeRef reference={f.type} baseHref={baseHref} />
                  <DocBlock raw={f.comment} />
                </li>
              ))}
          </ul>
        </section>
      ))}
      <ViewSource declaration={printMessage(message)} />
      {message.nestedMessages.length > 0 || message.nestedEnums.length > 0 ? (
        <div className="proto-nested">
          {message.nestedMessages.map((nm) => (
            <MessageBlock key={nm.fqn} message={nm} baseHref={baseHref} />
          ))}
          {message.nestedEnums.map((ne) => (
            <EnumBlock key={ne.fqn} enumEntity={ne} />
          ))}
        </div>
      ) : null}
    </section>
  )
}
