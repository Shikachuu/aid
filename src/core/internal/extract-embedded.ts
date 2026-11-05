import { chmod, lstat, mkdir, rename, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

/**
 * Copy an embedded file to a reusable temp path and return it. Bunfs paths can
 * be read but not exec'd or `dlopen`'d.
 */
export const extractEmbedded = async (
  src: string,
  prefix: string,
  name: string,
  mode?: number,
): Promise<string> => stableTempFile(prefix, name, await Bun.file(src).bytes(), mode)

/**
 * Write `bytes` to a per-user temp file once and reuse it on later runs, so
 * each aid process does not leave another copy of a native binary behind.
 */
export const stableTempFile = async (
  prefix: string,
  name: string,
  bytes: Uint8Array | string,
  mode?: number,
): Promise<string> => {
  const data = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes
  const dir = join(
    tmpdir(),
    `aid-${process.getuid?.() ?? 0}-${prefix}-${Bun.hash(data).toString(36)}`,
  )
  const dst = join(dir, name)
  await ensurePrivateDir(dir)
  const existing = Bun.file(dst)
  if ((await existing.exists()) && Bun.hash(await existing.bytes()) === Bun.hash(data)) {
    if (mode !== undefined) {
      await chmod(dst, mode)
    }
    return dst
  }
  const partial = `${dst}.${process.pid}.tmp`
  try {
    await Bun.write(partial, data)
    if (mode !== undefined) {
      await chmod(partial, mode)
    }
    await rename(partial, dst)
  } catch (err) {
    await rm(partial, { force: true })
    throw err
  }
  return dst
}

const ensurePrivateDir = async (dir: string): Promise<void> => {
  try {
    await mkdir(dir, { mode: 0o700 })
    return
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
      throw err
    }
  }
  const info = await lstat(dir)
  const uid = process.getuid?.()
  if (!info.isDirectory() || (uid !== undefined && info.uid !== uid) || (info.mode & 0o077) !== 0) {
    throw new Error(`aid: refusing to use ${dir}: it is not a private directory owned by you.`)
  }
}
