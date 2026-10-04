/** Error payload sent to the client overlay when a rebuild throws. */
export type DevErrorPayload = {
  message: string
  stack?: string
}

/** Shared, mutable dev session state. Server, watcher, and rebuild loop all see the same instance. */
export type DevState = {
  /** Subdir currently served. Null while the very first build is in flight or failed. */
  currentDir: string | null
  /** The two double-buffered output directories. */
  buffers: { a: string; b: string }
  /** Latest error, if any. Cleared on the next successful build. */
  errorState: DevErrorPayload | null
  /** Connected SSE clients. */
  sseClients: Set<ReadableStreamDefaultController<Uint8Array>>
}

const encoder = new TextEncoder()

/** Encode one SSE frame carrying `event` and a string `data` payload. */
export function sseFrame(event: string, data: string): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${data}\n\n`)
}

/** Push an SSE frame to every connected client, dropping clients whose stream has closed. */
export function broadcast(state: DevState, event: string, data: string): void {
  const frame = sseFrame(event, data)
  for (const ctrl of state.sseClients) {
    try {
      ctrl.enqueue(frame)
    } catch {
      state.sseClients.delete(ctrl)
    }
  }
}

/** Turn an arbitrary thrown value into a `DevErrorPayload`. */
export function toErrorPayload(err: unknown): DevErrorPayload {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack }
  }
  return { message: String(err) }
}
