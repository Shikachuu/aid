#!/usr/bin/env bun
import { resolve } from "node:path"
import { bundleWebFiles, AID_ROOT as ROOT, WEB_CSS, WEB_JS } from "../src/core/web-entries"
import { BUNDLED_OUT, fmtBytes } from "./compile"

const outAt = process.argv.indexOf("--out")
const outArg = outAt === -1 ? undefined : process.argv[outAt + 1]
if (outAt !== -1 && (outArg === undefined || outArg.startsWith("--"))) {
  console.error("[bundle-web] --out needs a file path")
  process.exit(1)
}
const BUNDLED_TS = outArg === undefined ? BUNDLED_OUT : resolve(outArg)

const buildProtoUi = () =>
  Bun.$`${process.execPath} run scripts/build.ts`.cwd(resolve(ROOT, "packages/proto-ui"))

const lines: string[] = []
const emit = (label: string, exportName: string, value: unknown, bytes: number) => {
  console.log(`[bundle-web] embedded ${label} (${fmtBytes(bytes)})`)
  lines.push(`export const ${exportName} = ${JSON.stringify(value)}\n`)
}

for (const entry of Object.values(WEB_JS)) {
  const bundle = await bundleWebFiles(entry)
  const files = Object.values(bundle.files)
  const bytes = files.reduce((sum, body) => sum + body.length, 0)
  emit(`${entry.name}, ${files.length} files`, entry.exportName, bundle, bytes)
}

await buildProtoUi()
for (const css of Object.values(WEB_CSS)) {
  const body = await Bun.file(Bun.resolveSync(css.specifier, ROOT)).text()
  emit(`${css.name}.css`, css.exportName, body, body.length)
}

const themeFiles = await Array.fromAsync(
  new Bun.Glob("src/theme/**/*.{tsx,ts}").scan({ cwd: ROOT }),
)
const themeSources = (
  await Promise.all(themeFiles.sort().map((file) => Bun.file(resolve(ROOT, file)).text()))
).join("\n")
lines.push(`export const aidThemeSources = ${JSON.stringify(themeSources)}\n`)
console.log(
  `[bundle-web] embedded ${themeFiles.length} theme sources (${fmtBytes(themeSources.length)})`,
)

const body = lines.join("")
await Bun.write(BUNDLED_TS, body)
console.log(`[bundle-web] wrote ${BUNDLED_TS} (${fmtBytes(body.length)})`)
