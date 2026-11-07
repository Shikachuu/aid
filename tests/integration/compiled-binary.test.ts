import { afterAll, beforeAll, expect, test } from "bun:test"
import { cp, mkdtemp, readdir, rm } from "node:fs/promises"
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
    const bundled = path.join(outDir, "_bundled.ts")
    const bundle = Bun.spawnSync([process.execPath, "scripts/bundle-web.ts", "--out", bundled], {
      cwd: ROOT,
      stdout: "ignore",
      stderr: "pipe",
    })
    if (bundle.exitCode !== 0) {
      throw new Error(`bundle-web failed: ${bundle.stderr.toString()}`)
    }
    await compileTarget(host, binary, { bundled })
  }
}, 300_000)

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

const stylesheet = async (dist: string): Promise<string> => {
  const name = (await readdir(dist)).find((entry) => /^main\.[0-9a-f]{8}\.css$/.test(entry))
  return Bun.file(path.join(dist, name ?? "missing.css")).text()
}

test.skipIf(host === undefined)(
  "the compiled binary builds a site with no node_modules around and matches the source build",
  async () => {
    const fixture = path.join(import.meta.dir, "../fixtures/sample-site")
    const compiledSite = await mkdtemp(path.join(tmpdir(), "aid-compiled-site-"))
    const sourceSite = await mkdtemp(path.join(tmpdir(), "aid-source-site-"))
    await cp(fixture, compiledSite, { recursive: true })
    await cp(fixture, sourceSite, { recursive: true })
    const compiled = Bun.spawnSync([binary, "build", "."], { cwd: compiledSite, stderr: "pipe" })
    expect(compiled.stderr.toString()).toBe("")
    expect(compiled.exitCode).toBe(0)
    const source = Bun.spawnSync([process.execPath, "src/cli/index.ts", "build", sourceSite], {
      cwd: ROOT,
    })
    expect(source.exitCode).toBe(0)
    expect(await Bun.file(path.join(compiledSite, "dist/index.html")).text()).toContain("<main")
    expect(await stylesheet(path.join(compiledSite, "dist"))).toBe(
      await stylesheet(path.join(sourceSite, "dist")),
    )
    await rm(compiledSite, { recursive: true, force: true })
    await rm(sourceSite, { recursive: true, force: true })
  },
  120_000,
)
