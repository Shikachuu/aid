/** SSE path of the reload channel. The server matches it before stripping `base_path`, so it works under any base path. */
export const RELOAD_PATH = "/__aid/reload"

/**
 * Client injected into every HTML page the dev server sends. It is plain ES5
 * in a string because the server inlines it as is, without the bundler. The
 * SSE events it handles are `reload`, `error-detail` and `clear-error`.
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
    var stack = payload.stack ? "<pre style=\\"white-space:pre-wrap;color:#a1a1aa;font-size:12px;\\">" + escapeHtml(payload.stack) + "</pre>" : "";
    root.innerHTML = title + msg + stack;
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
