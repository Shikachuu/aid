import { chmod, realpath, rename, rm, stat } from "node:fs/promises"
import type { Diagnostic } from "./diagnostics"

const BOM = "\uFEFF"
const UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })

/** A file's text without its byte order mark, and whether it had one, so a rewrite can put it back. */
export type SourceFile = { text: string; bom: boolean }

/** The `code` of a Node.js file system error, such as `ENOENT`, for a one-line message. */
export const errorCode = (err: unknown): string =>
  err instanceof Error && "code" in err ? String(err.code) : String(err)

const readError = (file: string, message: string): Diagnostic => ({
  file,
  severity: "warn",
  code: "read-error",
  message,
})

/**
 * Read a discovered file as UTF-8. A file that vanished since discovery, that
 * aid may not read, or that is not UTF-8 comes back as a `read-error` warning,
 * so one file never aborts the run and fmt never rewrites bytes it cannot decode.
 */
export const readSource = async (file: string): Promise<SourceFile | Diagnostic> => {
  let bytes: Uint8Array
  try {
    bytes = await Bun.file(file).bytes()
  } catch (err) {
    return readError(file, `file skipped, it cannot be read (${errorCode(err)})`)
  }
  let text: string
  try {
    text = UTF8.decode(bytes)
  } catch {
    return readError(file, "file skipped, it is not valid UTF-8")
  }
  return text.startsWith(BOM) ? { text: text.slice(1), bom: true } : { text, bom: false }
}

/**
 * Replace a file through a temporary sibling and a rename, so an interrupted
 * run never leaves it half written. Keeps the byte order mark, the file mode,
 * and a symlink, whose target is the file that changes.
 */
export const writeSource = async (file: string, source: SourceFile): Promise<void> => {
  const target = await realpath(file)
  const temp = `${target}.aid-${process.pid}.tmp`
  try {
    await Bun.write(temp, source.bom ? BOM + source.text : source.text)
    await chmod(temp, (await stat(target)).mode)
    await rename(temp, target)
  } catch (err) {
    await rm(temp, { force: true })
    throw err
  }
}
