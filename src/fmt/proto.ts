import { parseProto } from "@aid/proto-ui/parser"
import { type Diagnostic, processFailure, type ToolResult } from "../lint/diagnostics"
import { BUF_SKIPPED, resolveBufBinary } from "../lint/proto"

const BUF_DIFF_EXIT = 100

/**
 * Format `.proto` files through `buf format`. In `check` mode, list the files
 * whose diff is non-empty. `buf format` rewrites a file it cannot parse and
 * drops tokens, so a file must parse first; otherwise it is left untouched and
 * reported. A buf failure, such as a broken `buf.yaml`, carries buf's message.
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
    return BUF_SKIPPED
  }
  const mode = opts.check ? ["-d", "--exit-code"] : ["-w"]
  const wouldChange: string[] = []
  const diagnostics: Diagnostic[] = []
  for (const file of paths) {
    const parseError = syntaxError(await Bun.file(file).text())
    if (parseError !== null) {
      diagnostics.push({ file, severity: "error", code: "proto/parse", message: parseError })
      continue
    }
    const run = await Bun.$`${bin} format ${mode} ${file}`.cwd(dir).nothrow().quiet()
    if (opts.check && run.exitCode === BUF_DIFF_EXIT) {
      wouldChange.push(file)
    } else if (run.exitCode !== 0) {
      const output = {
        exitCode: run.exitCode,
        stdout: run.stdout.toString(),
        stderr: run.stderr.toString(),
      }
      diagnostics.push(processFailure("buf", output, file, "proto/format"))
    }
  }
  return {
    tool: "proto",
    ok: wouldChange.length === 0 && diagnostics.length === 0,
    diagnostics,
    wouldChange: opts.check ? wouldChange : undefined,
  }
}

const syntaxError = (source: string): string | null => {
  try {
    parseProto(source)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}
