import { Marked } from "marked"

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c)

const SAFE_HREF = /^(?:https?:|mailto:|[^:&\s]*(?:[/?#]|$))/i

const marked = new Marked({
  async: false,
  renderer: {
    html: ({ text }) => escapeHtml(text),
  },
  walkTokens: (token) => {
    if (token.type === "link" && !SAFE_HREF.test(token.href)) {
      token.href = "#"
    }
  },
})

/** Render a proto comment as markdown. Raw HTML is escaped and links outside http, https and mailto are dropped. */
export const renderDocMarkdown = (raw: string): string => marked.parse(raw) as string
