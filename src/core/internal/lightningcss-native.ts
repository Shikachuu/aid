import { createRequire } from "node:module"
import lcssDarwinArm64 from "../../../vendor/natives/lightningcss-darwin-arm64.bin" with { type: "file" }
import lcssDarwinX64 from "../../../vendor/natives/lightningcss-darwin-x64.bin" with { type: "file" }
import lcssLinuxArm64 from "../../../vendor/natives/lightningcss-linux-arm64-gnu.bin" with { type: "file" }
import lcssLinuxX64 from "../../../vendor/natives/lightningcss-linux-x64-gnu.bin" with { type: "file" }
import { extractEmbedded } from "./extract-embedded"

type EmbeddedBinding = { stagedPath: string; subpkg: string }

const isGlibc = (): boolean => {
  const report = process.report.getReport() as { header?: { glibcVersionRuntime?: string } }
  return typeof report.header?.glibcVersionRuntime === "string"
}

const pickEmbedded = (): EmbeddedBinding | null => {
  if (process.platform === "darwin") {
    if (process.arch === "arm64") {
      return { stagedPath: lcssDarwinArm64, subpkg: "lightningcss-darwin-arm64" }
    }
    if (process.arch === "x64") {
      return { stagedPath: lcssDarwinX64, subpkg: "lightningcss-darwin-x64" }
    }
  }
  if (process.platform === "linux" && isGlibc()) {
    if (process.arch === "arm64") {
      return { stagedPath: lcssLinuxArm64, subpkg: "lightningcss-linux-arm64-gnu" }
    }
    if (process.arch === "x64") {
      return { stagedPath: lcssLinuxX64, subpkg: "lightningcss-linux-x64-gnu" }
    }
  }
  return null
}

/**
 * The lightningcss binding embedded for this host, or `null` when none fits.
 * A compiled binary has no other binding to fall back to, so there an
 * unsupported host (musl, or an arch other than x64 and arm64) throws.
 */
export const pickLightningcssBinding = (compiled: boolean): EmbeddedBinding | null => {
  const picked = pickEmbedded()
  if (picked === null && compiled) {
    const libc = process.platform === "linux" && !isGlibc() ? " (musl)" : ""
    throw new Error(
      `aid: unsupported platform ${process.platform}-${process.arch}${libc}. Release binaries run on glibc Linux and macOS, on x64 and arm64.`,
    )
  }
  return picked
}

let installPromise: Promise<void> | null = null

/**
 * Make lightningcss's `require('lightningcss-<platform>')` resolve inside a
 * `bun build --compile` binary, where Bun does not follow that dynamic require.
 * Call it before anything imports `lightningcss`. Idempotent.
 */
export const installLightningcssShim = (): Promise<void> => {
  installPromise ??= installOnce()
  return installPromise
}

const installOnce = async (): Promise<void> => {
  try {
    await doInstall()
  } catch (err) {
    installPromise = null
    throw err
  }
}

type ModuleNs = {
  prototype: { require: (this: unknown, id: string) => unknown }
}

const doInstall = async (): Promise<void> => {
  const picked = pickLightningcssBinding(import.meta.path.startsWith("/$bunfs/"))
  if (!picked?.stagedPath.startsWith("/$bunfs/")) {
    return
  }

  // `process.dlopen` needs a real filesystem path with a `.node` extension.
  const nodeFile = await extractEmbedded(picked.stagedPath, "lcss", `${picked.subpkg}.node`)

  const cjsRequire = createRequire(import.meta.url)
  const bindings = cjsRequire(nodeFile) as unknown

  const moduleNs = cjsRequire("node:module") as ModuleNs
  const original = moduleNs.prototype.require
  moduleNs.prototype.require = function (this: unknown, id: string): unknown {
    if (id === picked.subpkg) {
      return bindings
    }
    return original.call(this, id)
  }
}
