import { describe, expect, test } from "bun:test"
import path from "node:path"
import { compileTarget, nativeStubs, selectTargets } from "../../scripts/compile"
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

describe("selectTargets", () => {
  test("selects every target without --target", () => {
    expect(selectTargets([])).toEqual(TARGETS)
  })

  test.each(TARGETS.map((t) => [t.outSuffix, t] as const))(
    "--target %s selects only that target",
    (outSuffix, target) => {
      expect(selectTargets(["--target", outSuffix])).toEqual([target])
    },
  )

  test("rejects an unknown target, a missing value, and a positional argument", () => {
    expect(() => selectTargets(["--target", "windows-x64"])).toThrow("unknown --target windows-x64")
    expect(() => selectTargets(["--target"])).toThrow()
    expect(() => selectTargets(["linux-x64"])).toThrow()
  })
})

describe("compile.ts --target", () => {
  test("exits 1 on an unknown target and lists the known ones", async () => {
    const proc = Bun.spawn([process.execPath, "scripts/compile.ts", "--target", "windows-x64"], {
      cwd: path.join(import.meta.dir, "../.."),
      stdout: "pipe",
      stderr: "pipe",
    })
    expect(await proc.exited).toBe(1)
    const stderr = await new Response(proc.stderr).text()
    expect(stderr).toStartWith("[compile] unknown --target windows-x64")
    expect(stderr).toContain("linux-x64")
  })

  test("exits 1 with a one-line message when --target has no value", async () => {
    const proc = Bun.spawn([process.execPath, "scripts/compile.ts", "--target"], {
      cwd: path.join(import.meta.dir, "../.."),
      stdout: "pipe",
      stderr: "pipe",
    })
    expect(await proc.exited).toBe(1)
    const stderr = await new Response(proc.stderr).text()
    expect(stderr).toStartWith("[compile] ")
    expect(stderr.trim().split("\n")).toHaveLength(1)
  })
})
