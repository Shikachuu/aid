import { findUserConfig } from "../lint/config-resolve"
import { bufDefault } from "../lint/configs/buf.default"
import type { ToolResult } from "../lint/diagnostics"
import { resolveBufBinary } from "../lint/proto"

const USER_CONFIGS = ["buf.yaml", "buf.yml"] as const

const writeTempBufConfig = async (): Promise<string> => {
  const tmp = process.env.TMPDIR ?? "/tmp"
  const path = `${tmp}/aid-buf-fmt-${process.pid}-${Date.now()}.yaml`
  await Bun.write(path, bufDefault)
  return path
}

/**
 * Format `.proto` files via `buf format`. In `--check` mode, runs `buf format -d`
 * and reports files that would change. Skips silently when `buf` isn't installed.
 */
export const formatProto = async (
  paths: string[],
  dir: string,
  opts: { check: boolean },
): Promise<ToolResult> => {
  if (paths.length === 0) return { tool: "proto", ok: true, diagnostics: [] }
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
  const userConfig = await findUserConfig(dir, USER_CONFIGS)
  const tempCfg = userConfig === null ? await writeTempBufConfig() : null
  const wouldChange: string[] = []
  let ok = true

  for (const file of paths) {
    if (opts.check) {
      const args = ["format", "-d"]
      if (tempCfg !== null) args.push("--config", tempCfg)
      args.push(file)
      const proc = Bun.spawn([bin, ...args], { stdout: "pipe", stderr: "pipe", cwd: dir })
      const stdout = await new Response(proc.stdout).text()
      await new Response(proc.stderr).text()
      await proc.exited
      if (stdout.trim().length > 0) {
        wouldChange.push(file)
        ok = false
      }
    } else {
      const args = ["format", "-w"]
      if (tempCfg !== null) args.push("--config", tempCfg)
      args.push(file)
      const proc = Bun.spawn([bin, ...args], { stdout: "pipe", stderr: "pipe", cwd: dir })
      await new Response(proc.stdout).text()
      await new Response(proc.stderr).text()
      const exitCode = await proc.exited
      if (exitCode !== 0) ok = false
    }
  }
  return { tool: "proto", ok, diagnostics: [], wouldChange: opts.check ? wouldChange : undefined }
}
