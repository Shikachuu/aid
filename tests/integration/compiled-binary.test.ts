import { afterAll, beforeAll, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { compileTarget } from "../../scripts/compile"
import { TARGETS } from "../../scripts/natives"

const ROOT = path.join(import.meta.dir, "../..")
const badJsonDir = path.join(import.meta.dir, "../fixtures/lint-fixtures/openapi-bad-json")

const host = TARGETS.find((t) => t.platform === process.platform && t.arch === process.arch)

let outDir: string
let binary: string

beforeAll(async () => {
  outDir = await mkdtemp(path.join(tmpdir(), "aid-compiled-"))
  binary = path.join(outDir, "aid")
  if (host !== undefined) {
    await compileTarget(host, binary)
  }
}, 120_000)

afterAll(async () => {
  await rm(outDir, { recursive: true, force: true })
})

const lintJson = async (cmd: string[], cwd: string): Promise<unknown> => {
  const proc = Bun.spawn([...cmd, "lint", badJsonDir, "--filter", "openapi", "--format", "json"], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (stdout === "") {
    throw new Error(`${cmd.join(" ")} printed nothing on stdout:\n${stderr}`)
  }
  return JSON.parse(stdout)
}

test.skipIf(host === undefined)(
  "the compiled binary reports OpenAPI JSON parse errors like the source CLI",
  async () => {
    const compiled = await lintJson([binary], outDir)
    const source = await lintJson([process.execPath, "src/cli/index.ts"], ROOT)
    expect(compiled).toEqual(source)
    expect(JSON.stringify(compiled)).toContain("Unexpected end of string")
  },
  60_000,
)

const runAid = async (args: string[], cwd: string): Promise<unknown> => {
  const proc = Bun.spawn([binary, ...args, "--format", "json"], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout] = await Promise.all([new Response(proc.stdout).text(), proc.exited])
  return JSON.parse(stdout)
}

test.skipIf(host === undefined)(
  "the compiled binary runs bun lint and bun fmt from its embedded runtime",
  async () => {
    const project = await mkdtemp(path.join(tmpdir(), "aid-compiled-bun-"))
    await Bun.write(path.join(project, "x.ts"), "let x = 1\nconsole.log( x );\n")
    const lint = await runAid(["lint", project, "--filter", "bun"], outDir)
    expect(JSON.stringify(lint)).toContain('"code":"prefer-const"')
    const fmt = await runAid(["fmt", project, "--filter", "bun", "--check"], outDir)
    expect(JSON.stringify(fmt)).toContain(`"wouldChange":["${path.join(project, "x.ts")}"]`)
    await rm(project, { recursive: true, force: true })
  },
  60_000,
)
