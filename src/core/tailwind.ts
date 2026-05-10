import type { BuildContext } from "./types"

export type CompileTailwindArgs = {
  ctx: BuildContext
  /** Class candidates harvested from rendered HTML + scanned TSX templates. */
  candidates: Iterable<string>
}

/**
 * Run @tailwindcss/node against the resolved entrypoint (user main.css or default)
 * with the merged candidate set. Auto-derives a dark palette when
 * config.theme.dark_mode === "auto".
 *
 * Stub — implementation lands with the Tailwind integration PR.
 */
export async function compileTailwind(_args: CompileTailwindArgs): Promise<string> {
  return ""
}
