/** Error payload sent to the client overlay when a rebuild throws. */
export type DevErrorPayload = {
  message: string
  file?: string
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

export function createDevState(buffers: { a: string; b: string }): DevState {
  return {
    currentDir: null,
    buffers,
    errorState: null,
    sseClients: new Set(),
  }
}

const encoder = new TextEncoder()

/** Push an SSE `event: <event>` frame with a JSON or string data payload to every connected client. */
export function broadcast(state: DevState, event: string, data: string): void {
  const frame = encoder.encode(`event: ${event}\ndata: ${data}\n\n`)
  for (const ctrl of state.sseClients) {
    try {
      ctrl.enqueue(frame)
    } catch {
      state.sseClients.delete(ctrl)
    }
  }
}

/** Format a `DevErrorPayload` as a JSON string suitable for an SSE data line. */
export function serializeError(err: DevErrorPayload): string {
  return JSON.stringify(err)
}

/** Turn an arbitrary thrown value into a `DevErrorPayload`. */
export function toErrorPayload(err: unknown): DevErrorPayload {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack }
  }
  return { message: String(err) }
}
