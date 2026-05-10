import { dirname, resolve as resolvePath } from "node:path"
import { fileURLToPath } from "node:url"
import { findUserConfig } from "./config-resolve"
import { bufDefault } from "./configs/buf.default"
import type { Diagnostic, ToolResult } from "./diagnostics"

const USER_CONFIGS = ["buf.yaml", "buf.yml"] as const

let cachedBin: string | null | undefined

/**
 * Locate the `buf` binary. Tries the @bufbuild/buf npm package first, then
 * falls back to `$PATH`. Returns `null` if buf isn't available.
 */
export const resolveBufBinary = async (): Promise<string | null> => {
  if (cachedBin !== undefined) return cachedBin
  try {
    const pkgUrl = import.meta.resolve("@bufbuild/buf/package.json")
    const pkgPath = pkgUrl.startsWith("file://") ? fileURLToPath(pkgUrl) : pkgUrl
    const binPath = resolvePath(dirname(pkgPath), "bin", "buf")
    if (await Bun.file(binPath).exists()) {
      cachedBin = binPath
      return binPath
    }
  } catch {
    // fall through
  }
  cachedBin = Bun.which("buf")
  return cachedBin
}

const writeTempBufConfig = async (): Promise<string> => {
  const tmp = process.env.TMPDIR ?? "/tmp"
  const path = `${tmp}/aid-buf-${process.pid}-${Date.now()}.yaml`
  await Bun.write(path, bufDefault)
  return path
}

type BufJsonError = {
  path?: string
  start_line?: number
  start_column?: number
  end_line?: number
  end_column?: number
  type?: string
  message?: string
}

const parseBufOutput = (stdout: string): Diagnostic[] => {
  const out: Diagnostic[] = []
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim()
    if (trimmed.length === 0) continue
    try {
      const j = JSON.parse(trimmed) as BufJsonError
      out.push({
        file: j.path ?? "",
        line: j.start_line,
        col: j.start_column,
        severity: "error",
        code: j.type ?? "buf",
        message: j.message ?? "",
      })
    } catch {
      // ignore non-JSON lines
    }
  }
  return out
}

/** Run `buf lint` over the project. Skips silently when buf isn't installed. */
export const lintProto = async (paths: string[], dir: string): Promise<ToolResult> => {
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
  const args = ["lint", "--error-format=json"]
  if (tempCfg !== null) args.push("--config", tempCfg)
  args.push(dir)
  const proc = Bun.spawn([bin, ...args], { stdout: "pipe", stderr: "pipe", cwd: dir })
  const stdout = await new Response(proc.stdout).text()
  await new Response(proc.stderr).text()
  const exitCode = await proc.exited
  const diagnostics = parseBufOutput(stdout)
  return { tool: "proto", ok: exitCode === 0 && diagnostics.length === 0, diagnostics }
}
