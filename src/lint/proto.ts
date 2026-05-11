import { chmod, mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import bufDarwinArm64 from "@bufbuild/buf-darwin-arm64/bin/buf" with { type: "file" }
import bufDarwinX64 from "@bufbuild/buf-darwin-x64/bin/buf" with { type: "file" }
import bufLinuxArm64 from "@bufbuild/buf-linux-aarch64/bin/buf" with { type: "file" }
import bufLinuxX64 from "@bufbuild/buf-linux-x64/bin/buf" with { type: "file" }
import { findUserConfig } from "./config-resolve"
import { bufDefault } from "./configs/buf.default"
import type { Diagnostic, ToolResult } from "./diagnostics"

const USER_CONFIGS = ["buf.yaml", "buf.yml"] as const

let cachedBin: string | null | undefined

const pickEmbeddedBuf = (): string | null => {
  if (process.platform === "darwin") {
    return process.arch === "arm64" ? bufDarwinArm64 : bufDarwinX64
  }
  if (process.platform === "linux") {
    return process.arch === "arm64" ? bufLinuxArm64 : bufLinuxX64
  }
  return null
}

// bunfs paths can be read but not exec'd by posix_spawn; extract to real FS.
const extractEmbeddedBuf = async (embedded: string): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "aid-buf-"))
  const dst = join(dir, "buf")
  await Bun.write(dst, Bun.file(embedded))
  await chmod(dst, 0o755)
  return dst
}

/**
 * Locate the `buf` binary. In compiled binaries the per-platform buf is
 * embedded via `with { type: "file" }` and extracted to a temp path on first
 * call (bunfs paths can't be exec'd directly). In dev runs the embedded path
 * resolves to a real node_modules file. Falls back to `$PATH` when neither is
 * available.
 */
export const resolveBufBinary = async (): Promise<string | null> => {
  if (cachedBin !== undefined) return cachedBin
  const embedded = pickEmbeddedBuf()
  if (embedded !== null && (await Bun.file(embedded).exists())) {
    cachedBin = embedded.startsWith("/$bunfs/") ? await extractEmbeddedBuf(embedded) : embedded
    return cachedBin
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
