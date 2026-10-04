import { chmod, mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

/**
 * Copy an embedded file to `<tmpdir>/aid-<prefix>-XXXXXX/<name>` and return the
 * new path. Bunfs paths can be read but not exec'd or `dlopen`'d.
 */
export const extractEmbedded = async (
  src: string,
  prefix: string,
  name: string,
  mode?: number,
): Promise<string> => {
  const dst = join(await mkdtemp(join(tmpdir(), `aid-${prefix}-`)), name)
  await Bun.write(dst, Bun.file(src))
  if (mode !== undefined) {
    await chmod(dst, mode)
  }
  return dst
}
