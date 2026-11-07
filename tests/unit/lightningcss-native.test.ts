import { afterEach, describe, expect, test } from "bun:test"
import { pickLightningcssBinding } from "../../src/core/internal/lightningcss-native"

const original = { platform: process.platform, arch: process.arch }

const pretend = (platform: string, arch: string) => {
  Object.defineProperty(process, "platform", { value: platform, configurable: true })
  Object.defineProperty(process, "arch", { value: arch, configurable: true })
}

afterEach(() => {
  pretend(original.platform, original.arch)
})

describe("pickLightningcssBinding", () => {
  test.each([
    ["darwin", "arm64", "lightningcss-darwin-arm64"],
    ["darwin", "x64", "lightningcss-darwin-x64"],
  ])("picks the %s-%s binding", (platform, arch, subpkg) => {
    pretend(platform, arch)
    expect(pickLightningcssBinding(true)?.subpkg).toBe(subpkg)
  })

  test.if(process.platform === "linux")("picks the glibc binding on this Linux host", () => {
    expect(pickLightningcssBinding(true)?.subpkg).toBe(`lightningcss-linux-${process.arch}-gnu`)
  })

  test.each([
    ["linux", "ia32"],
    ["darwin", "ppc64"],
    ["win32", "x64"],
  ])("throws for %s-%s in a compiled binary", (platform, arch) => {
    pretend(platform, arch)
    expect(() => pickLightningcssBinding(true)).toThrow(
      new RegExp(`^aid: unsupported platform ${platform}-${arch}\\.`),
    )
  })

  test("returns null for an unsupported host when running from source", () => {
    pretend("linux", "ia32")
    expect(pickLightningcssBinding(false)).toBeNull()
  })
})
