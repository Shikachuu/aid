import type { ToolResult } from "../lint/diagnostics"
import { resolveBufBinary } from "../lint/proto"

/**
 * Format `.proto` files through `buf format`. In `check` mode, list the files
 * whose diff is non-empty. Returns a `skipped` result when no `buf` binary is
 * available.
 */
export const formatProto = async (
  paths: string[],
  dir: string,
  opts: { check: boolean },
): Promise<ToolResult> => {
  if (paths.length === 0) {
    return { tool: "proto", ok: true, diagnostics: [] }
  }
  const bin = await resolveBufBinary()
  if (bin === null) {
    return {
      tool: "proto",
      ok: true,
      diagnostics: [],
      skipped: true,
      reason: "buf binary not available — install `@bufbuild/buf` or put `buf` on PATH",
    }
  }
  const mode = opts.check ? ["-d", "--exit-code"] : ["-w"]
  const wouldChange: string[] = []
  let ok = true
  for (const file of paths) {
    const { stdout, exitCode } = await Bun.$`${bin} format ${mode} ${file}`
      .cwd(dir)
      .nothrow()
      .quiet()
    if (exitCode !== 0) {
      ok = false
    }
    if (opts.check && stdout.length > 0) {
      wouldChange.push(file)
    }
  }
  return { tool: "proto", ok, diagnostics: [], wouldChange: opts.check ? wouldChange : undefined }
}
