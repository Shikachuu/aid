import { Marked } from "marked"

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c)

const ALLOWED_SCHEME = /^(?:https?|mailto):/i
const RELATIVE_URL = /^[^:&\s]*(?:[/?#]|$)/

const isSafeHref = (href: string): boolean => ALLOWED_SCHEME.test(href) || RELATIVE_URL.test(href)

const marked = new Marked({
  async: false,
  renderer: {
    html: ({ text }) => escapeHtml(text),
  },
  walkTokens: (token) => {
    if ((token.type === "link" || token.type === "image") && !isSafeHref(token.href)) {
      token.href = "#"
    }
  },
})

export const renderSafeDocMarkdown = (markdown: string): string => marked.parse(markdown) as string
