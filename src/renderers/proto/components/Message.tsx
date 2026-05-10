import type { ProtoMessage } from "../parser"

export function Message({ message }: { message: ProtoMessage }) {
  return (
    <section class="aid-proto-message">
      <h3>{message.name}</h3>
      {message.comment ? <p class="aid-proto-comment">{message.comment}</p> : null}
    </section>
  )
}
