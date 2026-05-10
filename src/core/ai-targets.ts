import type { AidConfig } from "./config"

export type AiButton = {
  target: "chatgpt" | "claude" | "gemini"
  label: string
  url: string
}

/**
 * Build the per-page "Open in AI" link list from configured targets and the
 * page's machine-readable URL (`.md` or `.json`).
 *
 * Stub — URL templates land with the AI integration PR.
 */
export function buildAiButtons(_config: AidConfig, _pageMachineUrl: string): AiButton[] {
  return []
}
