/// <reference lib="webworker" />

/**
 * Single-route renderer worker. Receives `{ route }`, dispatches to the
 * matching renderer (markdown / openapi / proto), and posts back
 * `{ html, searchTokens, exports }`.
 *
 * Stub.
 */
self.addEventListener("message", () => {
  // postMessage({ html: "", searchTokens: { ... }, exports: [] });
})

export {}
