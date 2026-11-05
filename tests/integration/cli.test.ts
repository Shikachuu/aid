import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { cp, mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

const repoRoot = path.join(import.meta.dir, "../..")
const cliEntry = path.join(repoRoot, "src/cli/index.ts")
const fixtureDir = path.join(import.meta.dir, "../fixtures/sample-site")

let cwd: string

beforeAll(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), "aid-cli-"))
  await cp(fixtureDir, cwd, {
    recursive: true,
    filter: (src) => path.basename(src) !== "dist",
  })
})

afterAll(async () => {
  await rm(cwd, { recursive: true, force: true })
})

const aid = (...args: string[]) => {
  const result = Bun.spawnSync([process.execPath, cliEntry, ...args], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, NO_COLOR: "1" },
  })
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  }
}

describe("aid build", () => {
  test("builds the sample site and exits 0", async () => {
    const { exitCode, stderr } = aid("build", cwd)
    expect(stderr).not.toContain("aid:")
    expect(exitCode).toBe(0)
    const entries = await readdir(path.join(cwd, "dist"))
    expect(entries).toContain("index.html")
    expect(entries).toContain("llms.txt")
    expect(entries.some((e) => /^main\.[0-9a-f]{8}\.css$/.test(e))).toBe(true)
    expect(await Bun.file(path.join(cwd, "dist/index.html")).text()).toContain("<main")
  })

  test("a missing -f file exits 1 with one aid: line that names it", () => {
    const { exitCode, stderr } = aid("build", cwd, "-f", "nope.yaml")
    expect(exitCode).toBe(1)
    expect(stderr.trim()).toBe(`aid: config file ${path.join(cwd, "nope.yaml")} not found.`)
  })

  test("an unknown config key exits 1 with one aid: line instead of a ZodError", async () => {
    await Bun.write(path.join(cwd, "typo.yaml"), "name: Typo\nbase_pth: /docs\n")
    const { exitCode, stderr } = aid("build", cwd, "-f", "typo.yaml")
    expect(exitCode).toBe(1)
    expect(stderr.trim()).toBe(
      `aid: invalid config ${path.join(cwd, "typo.yaml")}: (root): Unrecognized key: "base_pth"`,
    )
  })
})

describe("aid dev", () => {
  test.each(["abc", "", " ", "70000", "1.5"])(
    "--port %p exits 1 with one aid: line before starting",
    (port) => {
      const { exitCode, stderr } = aid("dev", cwd, "--port", port)
      expect(exitCode).toBe(1)
      expect(stderr.trim()).toBe(`aid: --port must be an integer from 0 to 65535, got "${port}".`)
    },
  )
})

describe("aid", () => {
  test("help exits 0 and lists the commands", () => {
    const { exitCode, stdout } = aid("help")
    expect(exitCode).toBe(0)
    for (const name of ["init", "dev", "build", "lint", "fmt"]) {
      expect(stdout).toContain(name)
    }
  })

  test("an unknown command exits 1 and names it", () => {
    const { exitCode, stdout, stderr } = aid("bogus")
    expect(exitCode).toBe(1)
    expect(stdout + stderr).toContain("Unknown command bogus")
  })

  test("init is not implemented and exits 1", () => {
    const { exitCode, stderr } = aid("init")
    expect(exitCode).toBe(1)
    expect(stderr).toContain("not implemented")
  })
})
