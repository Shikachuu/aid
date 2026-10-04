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
    if ((token.type === "link" || token.type === "image") && !SAFE_HREF.test(token.href)) {
      token.href = "#"
    }
  },
})

/**
 * Render a proto comment from markdown to HTML. Raw HTML in the comment comes out escaped. Links
 * and images with a scheme other than http, https or mailto, such as `javascript:`, get `#` as
 * their URL.
 */
export const renderDocMarkdown = (raw: string): string => marked.parse(raw) as string
