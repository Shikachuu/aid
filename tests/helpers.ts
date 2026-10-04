import path from "node:path"
import { AidConfigSchema, buildContext } from "../src/core/config"
import type { BuildContext } from "../src/core/types"

export function makeCtx(cwd: string, raw: Record<string, unknown> = {}): BuildContext {
  return buildContext(AidConfigSchema.parse({ name: "Test Site", ...raw }), cwd)
}

export async function makeSite(
  cwd: string,
  raw: Record<string, unknown> = {},
): Promise<BuildContext> {
  await Bun.write(path.join(cwd, "main.css"), `@import "tailwindcss";\n@import "aid/theme";\n`)
  return makeCtx(cwd, raw)
}
