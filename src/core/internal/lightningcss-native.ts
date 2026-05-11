import { mkdtemp } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"
import lcssDarwinArm64 from "../../../vendor/natives/lightningcss-darwin-arm64.bin" with {
  type: "file",
}
import lcssDarwinX64 from "../../../vendor/natives/lightningcss-darwin-x64.bin" with {
  type: "file",
}
import lcssLinuxArm64 from "../../../vendor/natives/lightningcss-linux-arm64-gnu.bin" with {
  type: "file",
}
import lcssLinuxX64 from "../../../vendor/natives/lightningcss-linux-x64-gnu.bin" with {
  type: "file",
}

type Pick = { stagedPath: string; subpkg: string }

const pickEmbedded = (): Pick | null => {
  if (process.platform === "darwin") {
    if (process.arch === "arm64") {
      return { stagedPath: lcssDarwinArm64, subpkg: "lightningcss-darwin-arm64" }
    }
    return { stagedPath: lcssDarwinX64, subpkg: "lightningcss-darwin-x64" }
  }
  if (process.platform === "linux") {
    if (process.arch === "arm64") {
      return { stagedPath: lcssLinuxArm64, subpkg: "lightningcss-linux-arm64-gnu" }
    }
    return { stagedPath: lcssLinuxX64, subpkg: "lightningcss-linux-x64-gnu" }
  }
  return null
}

let installPromise: Promise<void> | null = null

/**
 * Make `require('lightningcss-<platform>')` resolvable inside a
 * `bun build --compile` binary. Bun special-cases the `.node` extension and
 * doesn't follow lightningcss's template-literal `require()` either, so the
 * native binding never reaches the bunfs through the normal paths.
 *
 * The pipeline `scripts/stage-natives.ts` copies each platform's `.node` to
 * `vendor/natives/<pkg>.bin` (a non-`.node` name keeps Bun's loader out of the
 * way). This module statically imports those `.bin` paths via
 * `with { type: "file" }`, picks the matching one at runtime, writes the bytes
 * back out as a real `.node` file in `tmpdir()` (bunfs paths can't be
 * `dlopen`'d directly), and intercepts `Module._resolveFilename` so any
 * `require('lightningcss-<platform>')` resolves to the extracted file. The
 * normal Node-API loader takes over from there. Idempotent.
 *
 * In dev (no bunfs) the static imports resolve to the staged `vendor/`
 * paths; the same write-out + resolver-hook flow runs. The hook only fires
 * for the exact subpackage specifier, so unrelated requires are untouched.
 */
export const installLightningcssShim = async (): Promise<void> => {
  if (installPromise) return installPromise
  installPromise = doInstall()
  return installPromise
}

type ModuleNs = {
  prototype: { require: (this: unknown, id: string) => unknown }
}

const doInstall = async (): Promise<void> => {
  const picked = pickEmbedded()
  if (picked === null) return

  // Copy the staged bytes out as a real `.node` file. `process.dlopen` (which
  // `require()` invokes for `.node` files) needs a real filesystem path; the
  // `.node` extension is what tells the Node-API loader to treat it as such.
  const dir = await mkdtemp(join(tmpdir(), "aid-lcss-"))
  const nodeFile = join(dir, `${picked.subpkg}.node`)
  await Bun.write(nodeFile, Bun.file(picked.stagedPath))

  // Load the native bindings once via a real CJS require so process.dlopen
  // fires and we capture the exports.
  const cjsRequire = createRequire(import.meta.url)
  const bindings = cjsRequire(nodeFile) as unknown

  // Patch `Module.prototype.require`. lightningcss's loader does
  // `require('lightningcss-<platform>')`; the patch short-circuits that
  // specifier to the pre-loaded bindings. We can't use `Module._resolveFilename`
  // because Bun's compiled binary skips it.
  const moduleNs = cjsRequire("node:module") as ModuleNs
  const original = moduleNs.prototype.require
  moduleNs.prototype.require = function (this: unknown, id: string): unknown {
    if (id === picked.subpkg) return bindings
    return original.call(this, id)
  }
}
