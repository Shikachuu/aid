import { resolve as resolvePath } from "node:path"
import bufDarwinArm64 from "@bufbuild/buf-darwin-arm64/bin/buf" with { type: "file" }
import bufDarwinX64 from "@bufbuild/buf-darwin-x64/bin/buf" with { type: "file" }
import bufLinuxArm64 from "@bufbuild/buf-linux-aarch64/bin/buf" with { type: "file" }
import bufLinuxX64 from "@bufbuild/buf-linux-x64/bin/buf" with { type: "file" }
import { extractEmbedded } from "../core/internal/extract-embedded"
import { findUserConfig } from "./config-resolve"
import { bufDefault } from "./configs/buf.default"
import type { Diagnostic, ToolResult } from "./diagnostics"
import { USER_CONFIGS } from "./discovery"

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

/**
 * Locate the `buf` binary. In compiled binaries the per-platform buf is
 * embedded via `with { type: "file" }` and extracted to a temp path on first
 * call (bunfs paths can't be exec'd directly). In dev runs the embedded path
 * resolves to a real node_modules file. Falls back to `$PATH` when neither is
 * available.
 */
export const resolveBufBinary = async (): Promise<string | null> => {
  if (cachedBin !== undefined) {
    return cachedBin
  }
  const embedded = pickEmbeddedBuf()
  if (embedded !== null && (await Bun.file(embedded).exists())) {
    cachedBin = embedded.startsWith("/$bunfs/")
      ? await extractEmbedded(embedded, "buf", "buf", 0o755)
      : embedded
    return cachedBin
  }
  cachedBin = Bun.which("buf")
  return cachedBin
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
    if (trimmed.length === 0) {
      continue
    }
    const j = tryParseJson(trimmed)
    if (j !== null) {
      out.push({
        file: j.path ?? "",
        line: j.start_line,
        col: j.start_column,
        severity: "error",
        code: j.type ?? "buf",
        message: j.message ?? "",
      })
    }
  }
  return out
}

const tryParseJson = (line: string): BufJsonError | null => {
  try {
    return JSON.parse(line) as BufJsonError
  } catch {
    return null
  }
}

/** Run `buf lint` over the project. Returns a `skipped` result when no `buf` binary is available. */
export const lintProto = async (paths: string[], dir: string): Promise<ToolResult> => {
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
  const config =
    (await findUserConfig(dir, USER_CONFIGS.proto)) === null ? ["--config", bufDefault] : []
  const root = resolvePath(dir)
  const { stdout, exitCode } = await Bun.$`${bin} lint --error-format=json ${config} ${root}`
    .cwd(root)
    .nothrow()
    .quiet()
  const diagnostics = parseBufOutput(stdout.toString())
  return { tool: "proto", ok: exitCode === 0 && diagnostics.length === 0, diagnostics }
}
