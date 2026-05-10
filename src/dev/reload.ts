/**
 * SSE endpoint registration + the small client-side snippet injected into
 * pages in dev mode that reconnects on disconnect and reloads on message.
 *
 * Stub.
 */
export const RELOAD_PATH = "/__aid/reload"

export const RELOAD_CLIENT_SCRIPT = `
(function() {
  var es = new EventSource(${JSON.stringify(RELOAD_PATH)});
  es.onmessage = function() { location.reload(); };
})();
`.trim()
