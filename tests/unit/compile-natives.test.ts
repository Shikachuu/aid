import { describe, expect, test } from "bun:test"
import path from "node:path"
import { compileTarget, nativeStubs } from "../../scripts/compile"
import { TARGETS } from "../../scripts/natives"

const SRC = path.join(import.meta.dir, "../../src")

const nativeAssets = async (entry: string, target: (typeof TARGETS)[number]) => {
  const result = await Bun.build({
    entrypoints: [path.join(SRC, entry)],
    target: "bun",
    plugins: [nativeStubs(target)],
    define: {
      "process.platform": JSON.stringify(target.platform),
      "process.arch": JSON.stringify(target.arch),
    },
  })
  expect(result.success).toBe(true)
  return result.outputs.filter((o) => o.kind === "asset").map((o) => path.basename(o.path))
}

describe("nativeStubs", () => {
  test.each(TARGETS.map((t) => [t.triple, t] as const))(
    "%s embeds only its own lightningcss binding and buf binary",
    async (_triple, target) => {
      const lcss = await nativeAssets("core/internal/lightningcss-native.ts", target)
      expect(lcss).toHaveLength(1)
      expect(lcss[0]).toStartWith(target.lcssSubpkg)
      const buf = await nativeAssets("lint/proto.ts", target)
      expect(buf.filter((name) => name.startsWith("buf"))).toHaveLength(1)
    },
  )
})

describe("compileTarget", () => {
  test("refuses to compile without the generated browser bundle", async () => {
    const target = TARGETS[0] as (typeof TARGETS)[number]
    const missing = path.join(import.meta.dir, "no-such-bundle.ts")
    await expect(compileTarget(target, "/dev/null", { bundled: missing })).rejects.toThrow(
      `${missing} is missing. Run \`bun scripts/bundle-web.ts\` first.`,
    )
  })
})
