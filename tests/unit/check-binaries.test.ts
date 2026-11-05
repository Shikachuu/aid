import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  checkFamily,
  checkRuntime,
  checkStaged,
  collectStaged,
  latestBunKeepingCanaryPin,
  main,
  misePin,
  npmLatest,
  runningBun,
  updateCommands,
  updateStatus,
} from "../../scripts/check-binaries"
import { lcssNodeFile, TARGETS } from "../../scripts/natives"

const CANARY = "1.4.4-canary.20261103.1"

describe("checkFamily", () => {
  test("passes when every member matches the parent", () => {
    const family = {
      name: "@bufbuild/buf",
      expected: "1.75.0",
      members: [
        { name: "@bufbuild/buf-darwin-arm64 (package.json)", version: "1.75.0" },
        { name: "@bufbuild/buf-darwin-arm64", version: "1.75.0" },
      ],
    }
    expect(checkFamily(family)).toEqual([])
  })

  test("names a subpackage that drifted from its parent", () => {
    const family = {
      name: "@bufbuild/buf",
      expected: "1.75.0",
      members: [{ name: "@bufbuild/buf-linux-x64 (package.json)", version: "1.69.0" }],
    }
    expect(checkFamily(family)).toEqual([
      "@bufbuild/buf-linux-x64 (package.json) is 1.69.0, expected 1.75.0 to match @bufbuild/buf",
    ])
  })

  test("names a missing platform package", () => {
    const family = {
      name: "@tailwindcss/oxide",
      expected: "4.3.4",
      members: [{ name: "@tailwindcss/oxide-linux-x64-gnu", version: null }],
    }
    expect(checkFamily(family)).toEqual([
      "@tailwindcss/oxide-linux-x64-gnu is not installed (run `mise install`)",
    ])
  })

  test("reports every drifted member, not only the first", () => {
    const family = {
      name: "@bufbuild/buf",
      expected: "1.75.0",
      members: [
        { name: "@bufbuild/buf-darwin-x64", version: "1.69.0" },
        { name: "@bufbuild/buf-linux-x64", version: null },
      ],
    }
    expect(checkFamily(family)).toHaveLength(2)
  })

  test("reports a missing parent once instead of every member", () => {
    const family = {
      name: "@bufbuild/buf",
      expected: null,
      members: [{ name: "@bufbuild/buf-linux-x64", version: "1.75.0" }],
    }
    expect(checkFamily(family)).toEqual(["@bufbuild/buf is not installed (run `mise install`)"])
  })
})

describe("checkStaged", () => {
  test("passes when the staged copy matches its source", () => {
    expect(checkStaged([{ name: "lightningcss-linux-x64-gnu", source: 1n, staged: 1n }])).toEqual(
      [],
    )
  })

  test("flags a stale staged copy", () => {
    expect(checkStaged([{ name: "lightningcss-linux-x64-gnu", source: 1n, staged: 2n }])).toEqual([
      "vendor/natives/lightningcss-linux-x64-gnu.bin is stale (run `bun scripts/stage-natives.ts`)",
    ])
  })

  test("flags a missing staged copy and a missing source separately", () => {
    expect(
      checkStaged([
        { name: "lightningcss-darwin-x64", source: 1n, staged: null },
        { name: "lightningcss-darwin-arm64", source: null, staged: 1n },
      ]),
    ).toEqual([
      "vendor/natives/lightningcss-darwin-x64.bin is missing (run `bun scripts/stage-natives.ts`)",
      "lightningcss-darwin-arm64 source binding is not installed (run `mise install`)",
    ])
  })
})

describe("checkRuntime", () => {
  const ok = { running: "1.4.4", pinned: "1.4.4", engines: ">=1.3.6", types: "1.4.4" }

  test("passes when the running Bun, the pin, engines, and types agree", () => {
    expect(checkRuntime(ok)).toEqual([])
  })

  test("flags a pin that does not satisfy engines.bun", () => {
    expect(checkRuntime({ ...ok, engines: ">=1.5.0" })).toEqual([
      'mise.toml pins Bun 1.4.4, which does not satisfy engines.bun ">=1.5.0"',
    ])
  })

  test("flags a running Bun that differs from the pin", () => {
    expect(checkRuntime({ ...ok, running: "1.3.13" })).toEqual([
      "running Bun 1.3.13, but mise.toml pins 1.4.4 (run `mise install`)",
    ])
  })

  test("checks a canary pin against engines.bun by its base version", () => {
    const canary = "1.4.4-canary.20261103.1"
    expect(checkRuntime({ ...ok, running: canary, pinned: canary })).toEqual([])
  })

  test("accepts a @types/bun patch that differs from the pin", () => {
    expect(checkRuntime({ ...ok, types: "1.4.2" })).toEqual([])
  })

  test("flags @types/bun from another minor", () => {
    expect(checkRuntime({ ...ok, types: "1.3.13" })).toEqual([
      "@types/bun is 1.3.13, but mise.toml pins Bun 1.4.4",
    ])
  })

  test("flags a missing @types/bun", () => {
    expect(checkRuntime({ ...ok, types: null })).toEqual([
      "@types/bun is not installed (run `mise install`)",
    ])
  })

  test("flags a mise.toml with no bun pin", () => {
    expect(checkRuntime({ ...ok, pinned: null })).toEqual(["mise.toml does not pin bun"])
  })
})

describe("updateCommands", () => {
  test("bumps every buf platform subpackage to the same exact version", () => {
    const [parent, subpkgs] = updateCommands({
      family: "@bufbuild/buf",
      current: "1.69.0",
      latest: "1.75.0",
    })
    expect(parent).toBe("bun add @bufbuild/buf@^1.75.0")
    expect(subpkgs).toStartWith("bun add -d --exact ")
    expect(subpkgs?.match(/@1\.75\.0/g)).toHaveLength(4)
  })

  test("bumps Tailwind in the root and in @aid/proto-ui", () => {
    const cmds = updateCommands({ family: "@tailwindcss/oxide", current: "4.3.0", latest: "4.3.4" })
    expect(cmds).toContain("bun add @tailwindcss/node@^4.3.4 @tailwindcss/oxide@^4.3.4")
    expect(cmds.some((c) => c.startsWith("bun add -d -F @aid/proto-ui "))).toBe(true)
    expect(cmds.find((c) => c.includes("--exact"))?.match(/@4\.3\.4/g)).toHaveLength(4)
  })

  test("sends lightningcss bumps through Tailwind", () => {
    const cmds = updateCommands({ family: "lightningcss", current: "1.32.0", latest: "1.33.0" })
    expect(cmds.every((c) => c.startsWith("#"))).toBe(true)
  })

  test("bumps the Bun pin, the lockfile, the runtime packages, and @types/bun", () => {
    const cmds = updateCommands({ family: "bun", current: "1.4.4", latest: "1.5.0" })
    expect(cmds).toContain("mise lock --platform linux-x64,linux-arm64,macos-arm64,macos-x64")
    expect(
      cmds.find((c) => c.includes("--exact"))?.match(/@oven\/bun-[a-z0-9-]+@1\.5\.0/g),
    ).toHaveLength(4)
    expect(cmds).toContain("bun add -d @types/bun@^1.5.0")
  })

  test("pins @types/bun to a canary's base version", () => {
    const cmds = updateCommands({
      family: "bun",
      current: "1.4.4",
      latest: "1.4.4-canary.20261103.1",
    })
    expect(cmds).toContain("bun add -d @types/bun@^1.4.4")
  })

  test("returns nothing for an unknown family", () => {
    expect(updateCommands({ family: "left-pad", current: "1.0.0", latest: "1.1.0" })).toEqual([])
  })
})

describe("updateStatus", () => {
  test("compares versions by semver, not by string", () => {
    expect(updateStatus({ family: "x", current: "1.9.0", latest: "1.10.0" })).toBe(
      "update available",
    )
    expect(updateStatus({ family: "x", current: "1.10.0", latest: "1.10.0" })).toBe("up to date")
  })

  test("does not suggest a downgrade when the pin is ahead of upstream", () => {
    expect(updateStatus({ family: "x", current: "1.5.0-canary.1", latest: "1.4.4" })).toBe(
      "ahead of upstream",
    )
  })

  test("reports a failed lookup", () => {
    expect(updateStatus({ family: "x", current: "1.0.0", latest: null })).toBe("lookup failed")
  })
})

describe("against a project root", () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "aid-check-binaries-"))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  test("misePin reads a string pin and an http:bun table", async () => {
    await Bun.write(path.join(root, "mise.toml"), '[tools]\nbun = "1.4.2"\n')
    expect(await misePin(root)).toBe("1.4.2")
    await Bun.write(path.join(root, "mise.toml"), `[tools."http:bun"]\nversion = "${CANARY}"\n`)
    expect(await misePin(root)).toBe(CANARY)
  })

  test("misePin returns null without a pin or without mise.toml", async () => {
    expect(await misePin(root)).toBeNull()
    await Bun.write(path.join(root, "mise.toml"), '[tools]\nnode = "24"\n')
    expect(await misePin(root)).toBeNull()
  })

  test("runningBun reports Bun.version for a stable pin", async () => {
    expect(await runningBun("1.4.2", root)).toBe(Bun.version)
  })

  const host = TARGETS.find((t) => t.platform === process.platform && t.arch === process.arch)

  test.skipIf(host === undefined)(
    "runningBun reports a canary pin only when the running binary is the pinned one",
    async () => {
      expect(await runningBun(CANARY, root)).toBe(`${Bun.version}+${Bun.revision.slice(0, 9)}`)
      const pinned = path.join(root, "node_modules", host?.bunSubpkg ?? "", "bin", "bun")
      await mkdir(path.dirname(pinned), { recursive: true })
      await symlink(process.execPath, pinned)
      expect(await runningBun(CANARY, root)).toBe(CANARY)
    },
  )

  test("collectStaged hashes each binding and its staged copy", async () => {
    const [same, stale] = TARGETS
    for (const t of [same, stale]) {
      const name = t?.lcssSubpkg ?? ""
      await Bun.write(path.join(root, "node_modules", name, lcssNodeFile(name)), "binding")
    }
    await Bun.write(path.join(root, "vendor/natives", `${same?.lcssSubpkg}.bin`), "binding")
    await Bun.write(path.join(root, "vendor/natives", `${stale?.lcssSubpkg}.bin`), "old")
    const problems = checkStaged(await collectStaged(root))
    expect(problems).toContain(
      `vendor/natives/${stale?.lcssSubpkg}.bin is stale (run \`bun scripts/stage-natives.ts\`)`,
    )
    expect(problems.some((p) => p.includes(`${same?.lcssSubpkg}.bin`))).toBe(false)
    expect(problems).toHaveLength(1 + (TARGETS.length - 2))
  })

  test("main exits 1 and lists the drift for an uninstalled project", async () => {
    await Bun.write(path.join(root, "package.json"), JSON.stringify({ engines: { bun: "*" } }))
    await Bun.write(path.join(root, "mise.toml"), `[tools]\nbun = "${Bun.version}"\n`)
    const errors: string[] = []
    const error = spyOn(console, "error").mockImplementation((msg: string) => errors.push(msg))
    try {
      expect(await main(["--offline"], root)).toBe(1)
    } finally {
      error.mockRestore()
    }
    expect(errors).toContain("[check-binaries] drift:")
    expect(errors).toContain("  - @bufbuild/buf is not installed (run `mise install`)")
    expect(errors).toContain("  - @types/bun is not installed (run `mise install`)")
  })

  test("main flags a @tailwindcss/node that drifted from @tailwindcss/oxide", async () => {
    const pkg = (name: string, version: string) =>
      Bun.write(path.join(root, "node_modules", name, "package.json"), JSON.stringify({ version }))
    await pkg("@tailwindcss/oxide", "4.3.4")
    await pkg("@tailwindcss/node", "4.3.3")
    const errors: string[] = []
    const error = spyOn(console, "error").mockImplementation((msg: string) => errors.push(msg))
    try {
      await main(["--offline"], root)
    } finally {
      error.mockRestore()
    }
    expect(errors).toContain(
      "  - @tailwindcss/node is 4.3.3, expected 4.3.4 to match @tailwindcss/oxide",
    )
  })
})

describe("latestBunKeepingCanaryPin", () => {
  const stable = (v: string) => () => Promise.resolve(v)

  test("keeps a canary pin that no stable release has reached", async () => {
    expect(await latestBunKeepingCanaryPin(CANARY, stable("1.4.3"))).toBe(CANARY)
  })

  test("reports the stable release of a canary's base version as an update", async () => {
    const latest = await latestBunKeepingCanaryPin(CANARY, stable("1.4.4"))
    expect(latest).toBe("1.4.4")
    expect(updateStatus({ family: "bun", current: CANARY, latest })).toBe("update available")
  })

  test("reports a newer stable for a stable pin", async () => {
    expect(await latestBunKeepingCanaryPin("1.4.2", stable("1.4.4"))).toBe("1.4.4")
  })
})

describe("npmLatest", () => {
  const respond =
    (body: unknown, status = 200) =>
    () =>
      Promise.resolve(Response.json(body, { status }))

  test("returns the registry's version and sends a timeout signal", async () => {
    let init: RequestInit | undefined
    const version = await npmLatest("lightningcss", (_url, i) => {
      init = i
      return respond({ version: "1.33.0" })()
    })
    expect(version).toBe("1.33.0")
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  test("throws on a response without a string version", async () => {
    await expect(npmLatest("x", respond({}))).rejects.toThrow(
      "npm registry returned no version for x",
    )
    await expect(npmLatest("x", respond(null))).rejects.toThrow("no version")
  })

  test("throws on a non-200 status", async () => {
    await expect(npmLatest("x", respond({}, 404))).rejects.toThrow(
      "npm registry returned 404 for x",
    )
  })
})
