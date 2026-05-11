/** SSE path the dev server exposes; the client script connects here. */
export const RELOAD_PATH = "/__aid/reload"

/**
 * Client-side dev runtime: connects to the SSE channel, reloads the page on
 * `reload` events, and renders a fullscreen overlay on `error` events. The
 * overlay is removed on the next successful reload.
 */
export const RELOAD_CLIENT_SCRIPT = `
(function() {
  var OVERLAY_ID = "__aid-error-overlay";
  function removeOverlay() {
    var el = document.getElementById(OVERLAY_ID);
    if (el) el.remove();
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function(c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function showOverlay(payload) {
    removeOverlay();
    var root = document.createElement("div");
    root.id = OVERLAY_ID;
    root.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(20,20,24,0.92);color:#fafafa;font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;padding:32px;overflow:auto;backdrop-filter:blur(4px);";
    var title = "<div style=\\"font:600 18px/1.3 ui-sans-serif,system-ui,sans-serif;color:#ff6b6b;margin-bottom:12px;\\">aid: build failed</div>";
    var msg = "<div style=\\"white-space:pre-wrap;color:#fafafa;margin-bottom:16px;\\">" + escapeHtml(payload.message || "Unknown error") + "</div>";
    var file = payload.file ? "<div style=\\"color:#a1a1aa;margin-bottom:12px;\\">" + escapeHtml(payload.file) + "</div>" : "";
    var stack = payload.stack ? "<pre style=\\"white-space:pre-wrap;color:#a1a1aa;font-size:12px;\\">" + escapeHtml(payload.stack) + "</pre>" : "";
    root.innerHTML = title + file + msg + stack;
    document.body.appendChild(root);
  }
  var es = new EventSource(${JSON.stringify(RELOAD_PATH)});
  es.addEventListener("reload", function() { location.reload(); });
  es.addEventListener("error-detail", function(ev) {
    try { showOverlay(JSON.parse(ev.data)); } catch (_) { showOverlay({ message: ev.data }); }
  });
  es.addEventListener("clear-error", function() { removeOverlay(); });
})();
`.trim()
