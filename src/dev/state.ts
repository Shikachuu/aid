/** What the overlay shows for a failed build. `stack` is absent when the thrown value was not an `Error`. */
export type DevErrorPayload = {
  message: string
  stack?: string
}

/** One instance per `aid dev` session. The rebuild loop mutates it and the server reads it on every request. */
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

/** Push an SSE frame to every connected client. A client whose stream closed without a cancel is dropped and logged. */
export function broadcast(state: DevState, event: string, data: string): void {
  const frame = sseFrame(event, data)
  for (const ctrl of state.sseClients) {
    try {
      ctrl.enqueue(frame)
    } catch (err) {
      state.sseClients.delete(ctrl)
      console.warn(`[aid] dropped a reload client: ${(err as Error).message}`)
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
