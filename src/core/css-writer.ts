import path from "node:path"
import type { BuildContext } from "./types"

/** Inputs for {@link writeCss}. */
export type WriteCssArgs = {
  ctx: BuildContext
  /** Compiled CSS string from compileTailwind. */
  css: string
}

/** Result of writing the compiled CSS to disk. */
export type WriteCssResult = {
  /** Absolute filesystem path the CSS was written to. */
  path: string
  /** Public URL path for use in <link href>. Joined against config.base_path. */
  href: string
}

/**
 * Hash the CSS via xxh64, write it to `<outputDir>/main.<hash>.css`, and
 * return the public href joined against `config.base_path`. The hash gives
 * cache-busting; xxh64 is non-cryptographic (collision risk is irrelevant
 * here — it's a content-addressing fingerprint, not a security boundary).
 */
export async function writeCss(args: WriteCssArgs): Promise<WriteCssResult> {
  const hash = Bun.hash.xxHash64(args.css).toString(16).padStart(16, "0").slice(0, 8)
  const filename = `main.${hash}.css`
  const filePath = path.join(args.ctx.outputDir, filename)
  // Bun.write auto-creates parent dirs; no explicit mkdir needed.
  await Bun.write(filePath, args.css)
  const href = path.posix.join(args.ctx.config.base_path, filename)
  return { path: filePath, href }
}
