import { createRequire } from "node:module"
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
import { extractEmbedded } from "./extract-embedded"

type EmbeddedBinding = { stagedPath: string; subpkg: string }

const pickEmbedded = (): EmbeddedBinding | null => {
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
 * Make lightningcss's `require('lightningcss-<platform>')` resolve inside a
 * `bun build --compile` binary, where Bun does not follow that dynamic require.
 * Call it before anything imports `lightningcss`. Idempotent.
 */
export const installLightningcssShim = (): Promise<void> => {
  installPromise ??= doInstall()
  return installPromise
}

type ModuleNs = {
  prototype: { require: (this: unknown, id: string) => unknown }
}

const doInstall = async (): Promise<void> => {
  const picked = pickEmbedded()
  if (picked === null) {
    return
  }

  // `process.dlopen` needs a real filesystem path with a `.node` extension.
  const nodeFile = await extractEmbedded(picked.stagedPath, "lcss", `${picked.subpkg}.node`)

  const cjsRequire = createRequire(import.meta.url)
  const bindings = cjsRequire(nodeFile) as unknown

  // Bun's compiled binary skips `Module._resolveFilename`, so patch `require` itself.
  const moduleNs = cjsRequire("node:module") as ModuleNs
  const original = moduleNs.prototype.require
  moduleNs.prototype.require = function (this: unknown, id: string): unknown {
    if (id === picked.subpkg) {
      return bindings
    }
    return original.call(this, id)
  }
}
