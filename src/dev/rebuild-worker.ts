/// <reference lib="webworker" />

/**
 * Long-lived rebuild worker. Receives `{ changedPaths }` messages, re-renders
 * affected routes, runs Tailwind on the new candidate set, and posts back
 * `{ updates: [{ route, html, css }] }`.
 *
 * Stub. Wired up once the build pipeline lands.
 */
self.addEventListener("message", () => {
  // postMessage({ updates: [] });
})

export {}
