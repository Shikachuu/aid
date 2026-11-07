/** Error payload sent to the client overlay when a rebuild throws. */
export type DevErrorPayload = {
  message: string
  stack?: string
}

/** Shared, mutable dev session state. Server, watcher, and rebuild loop all see the same instance. */
export type DevState = {
  /** Subdir currently served. Null while the first build is in flight or after it failed. */
  currentDir: string | null
  /** `rebuild` writes into whichever buffer `currentDir` does not point at. */
  buffers: { a: string; b: string }
  /** Last rebuild error, replayed to SSE clients that connect later. Cleared on the next successful build. */
  errorState: DevErrorPayload | null
  sseClients: Set<ReadableStreamDefaultController<Uint8Array>>
}

const encoder = new TextEncoder()

/** Encode one SSE frame. `data` must be a single line, which holds for JSON payloads and the empty string. */
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

/** End every SSE stream after the frames already queued, so the server can stop gracefully. */
export function closeClients(state: DevState): void {
  for (const ctrl of state.sseClients) {
    closeUnlessDisconnected(ctrl)
  }
  state.sseClients.clear()
}

function closeUnlessDisconnected(ctrl: ReadableStreamDefaultController<Uint8Array>): void {
  try {
    ctrl.close()
  } catch {
    return
  }
}

/** Normalize a thrown value for the overlay, keeping the stack when it is an `Error`. */
export function toErrorPayload(err: unknown): DevErrorPayload {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack }
  }
  return { message: String(err) }
}
