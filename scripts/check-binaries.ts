#!/usr/bin/env bun
/**
 * Exit 1 when the embedded native binaries or the Bun runtime drift from their pins.
 * Without `--offline`, also report newer upstream versions and the commands to bump them.
 */

import { resolve } from "node:path"
import { lcssNodeFile, TARGETS } from "./natives"

const ROOT = resolve(import.meta.dir, "..")

/** One version that must equal its family's expected version. `null` means not installed. */
export type Member = { name: string; version: string | null }

/** Packages that must all resolve to one version. */
export type Family = { name: string; expected: string | null; members: Member[] }

/** A staged native copy and the hashes of its source and staged bytes. */
export type StagedNative = { name: string; source: bigint | null; staged: bigint | null }

/** The Bun versions that must agree. */
export type Runtime = {
  running: string
  pinned: string | null
  engines: string
  types: string | null
}

/** A package or runtime and its latest upstream version. `null` means the lookup failed. */
export type Update = { family: string; current: string; latest: string | null }

/** How a family's current version compares with its latest upstream version. */
export type UpdateStatus = "up to date" | "update available" | "ahead of upstream" | "lookup failed"

/** Compare a family's current version with upstream. */
export const updateStatus = ({ current, latest }: Update): UpdateStatus => {
  if (latest === null) {
    return "lookup failed"
  }
  const order = Bun.semver.order(current, latest)
  if (order < 0) {
    return "update available"
  }
  return order === 0 ? "up to date" : "ahead of upstream"
}

/** List the drift problems in one family. */
export const checkFamily = (family: Family): string[] => {
  if (family.expected === null) {
    return [`${family.name} is not installed (run \`mise install\`)`]
  }
  return family.members.flatMap((m) => {
    if (m.version === null) {
      return [`${m.name} is not installed (run \`mise install\`)`]
    }
    if (m.version !== family.expected) {
      return [`${m.name} is ${m.version}, expected ${family.expected} to match ${family.name}`]
    }
    return []
  })
}

/** List the `vendor/natives` copies that are missing or differ from `node_modules`. */
export const checkStaged = (natives: StagedNative[]): string[] =>
  natives.flatMap(({ name, source, staged }) => {
    if (source === null) {
      return [`${name} source binding is not installed (run \`mise install\`)`]
    }
    if (staged === null) {
      return [`vendor/natives/${name}.bin is missing (run \`bun scripts/stage-natives.ts\`)`]
    }
    if (source !== staged) {
      return [`vendor/natives/${name}.bin is stale (run \`bun scripts/stage-natives.ts\`)`]
    }
    return []
  })

const majorMinor = (v: string): string => v.split(".").slice(0, 2).join(".")

/** List where the Bun runtime disagrees with its pins. */
export const checkRuntime = ({ running, pinned, engines, types }: Runtime): string[] => {
  if (pinned === null) {
    return ["mise.toml does not pin bun"]
  }
  const problems: string[] = []
  if (running !== pinned) {
    problems.push(`running Bun ${running}, but mise.toml pins ${pinned} (run \`mise install\`)`)
  }
  if (!Bun.semver.satisfies(pinned, engines)) {
    problems.push(`mise.toml pins Bun ${pinned}, which does not satisfy engines.bun "${engines}"`)
  }
  if (types === null) {
    problems.push("@types/bun is not installed (run `mise install`)")
  } else if (majorMinor(types) !== majorMinor(pinned)) {
    problems.push(`@types/bun is ${types}, but mise.toml pins Bun ${pinned}`)
  }
  return problems
}

/** Read the version out of a `https://biomejs.dev/schemas/<version>/schema.json` URL. */
export const schemaVersion = (url: string | undefined): string | null =>
  url?.match(/\/schemas\/([^/]+)\/schema\.json$/)?.[1] ?? null

/** Return the commands that bump one family to its latest version. */
export const updateCommands = ({ family, latest }: Update & { latest: string }): string[] => {
  const exact = (pkgs: string[]): string => pkgs.map((p) => `${p}@${latest}`).join(" ")
  switch (family) {
    case "@bufbuild/buf":
      return [
        `bun add @bufbuild/buf@^${latest}`,
        `bun add -d --exact ${exact(TARGETS.map((t) => t.bufSubpkg))}`,
        "mise install",
      ]
    case "@tailwindcss/oxide":
      return [
        `bun add @tailwindcss/node@^${latest} @tailwindcss/oxide@^${latest}`,
        `bun add -d --exact ${exact(TARGETS.map((t) => t.oxideSubpkg))}`,
        `bun add -d -F @aid/proto-ui @tailwindcss/node@^${latest} @tailwindcss/oxide@^${latest} tailwindcss@^${latest}`,
        "mise install",
      ]
    case "lightningcss":
      return [
        "# lightningcss follows the exact pin in @tailwindcss/node; bump Tailwind instead,",
        "# then run `bun add --exact lightningcss@<that pin>` so aid's own pin matches",
      ]
    case "@biomejs/biome":
      return [
        `bun add -d @biomejs/biome@^${latest}`,
        `bun add @biomejs/wasm-nodejs@^${latest}`,
        "mise install",
        "bun x biome migrate --write",
      ]
    case "bun":
      return [
        `# set bun = "${latest}" in mise.toml`,
        "mise lock",
        "mise install",
        `bun add -d @types/bun@^${latest}`,
      ]
    default:
      return []
  }
}

type PackageJson = {
  version?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  engines?: Record<string, string>
}

const readJson = async <T>(path: string): Promise<T | null> => {
  const file = Bun.file(path)
  return (await file.exists()) ? ((await file.json()) as T) : null
}

const installed = async (pkg: string): Promise<string | null> =>
  (await readJson<PackageJson>(resolve(ROOT, "node_modules", pkg, "package.json")))?.version ?? null

const hashFile = async (path: string): Promise<bigint | null> => {
  const file = Bun.file(path)
  return (await file.exists()) ? BigInt(Bun.hash(await file.arrayBuffer())) : null
}

const subpackageFamily = async (
  parent: string,
  subpkgs: string[],
  pins: Record<string, string>,
): Promise<Family> => ({
  name: parent,
  expected: await installed(parent),
  members: (
    await Promise.all(
      subpkgs.map(
        async (pkg): Promise<Member[]> => [
          { name: `${pkg} (package.json)`, version: pins[pkg] ?? null },
          { name: pkg, version: await installed(pkg) },
        ],
      ),
    )
  ).flat(),
})

const collectFamilies = async (pkg: PackageJson): Promise<Family[]> => {
  const pins = pkg.devDependencies ?? {}
  const twNode = await readJson<PackageJson>(
    resolve(ROOT, "node_modules", "@tailwindcss/node", "package.json"),
  )
  const biomeJson = await readJson<{ $schema?: string }>(resolve(ROOT, "biome.json"))
  return [
    await subpackageFamily(
      "@bufbuild/buf",
      TARGETS.map((t) => t.bufSubpkg),
      pins,
    ),
    await subpackageFamily(
      "@tailwindcss/oxide",
      TARGETS.map((t) => t.oxideSubpkg),
      pins,
    ),
    {
      name: "lightningcss (pinned by @tailwindcss/node)",
      expected: twNode?.dependencies?.lightningcss ?? null,
      members: [
        {
          name: "lightningcss (package.json)",
          version: pkg.dependencies?.lightningcss ?? null,
        },
        { name: "lightningcss", version: await installed("lightningcss") },
        ...(await Promise.all(
          TARGETS.map(async (t) => ({
            name: t.lcssSubpkg,
            version: await installed(t.lcssSubpkg),
          })),
        )),
      ],
    },
    {
      name: "@biomejs/biome",
      expected: await installed("@biomejs/biome"),
      members: [
        { name: "@biomejs/wasm-nodejs", version: await installed("@biomejs/wasm-nodejs") },
        { name: "biome.json $schema", version: schemaVersion(biomeJson?.$schema) },
      ],
    },
  ]
}

const collectStaged = (): Promise<StagedNative[]> =>
  Promise.all(
    TARGETS.map(async ({ lcssSubpkg: name }) => ({
      name,
      source: await hashFile(resolve(ROOT, "node_modules", name, lcssNodeFile(name))),
      staged: await hashFile(resolve(ROOT, "vendor", "natives", `${name}.bin`)),
    })),
  )

const misePin = async (): Promise<string | null> => {
  const toml = Bun.TOML.parse(await Bun.file(resolve(ROOT, "mise.toml")).text()) as {
    tools?: Record<string, unknown>
  }
  const pin = toml.tools?.bun
  return typeof pin === "string" ? pin : null
}

const npmLatest = async (pkg: string): Promise<string> => {
  const res = await fetch(`https://registry.npmjs.org/${pkg}/latest`)
  if (!res.ok) {
    throw new Error(`npm registry returned ${res.status} for ${pkg}`)
  }
  return ((await res.json()) as { version: string }).version
}

const bunLatest = async (): Promise<string> =>
  (await Bun.$`mise latest bun`.cwd(ROOT).text()).trim()

const fetchLatest = async (family: string): Promise<string | null> => {
  try {
    return family === "bun" ? await bunLatest() : await npmLatest(family)
  } catch (err) {
    console.error(`[check-binaries] could not look up ${family}: ${(err as Error).message}`)
    return null
  }
}

const collectUpdates = async (current: Record<string, string | null>): Promise<Update[]> => {
  const updates = await Promise.all(
    Object.entries(current).map(
      async ([family, version]): Promise<Update | null> =>
        version === null ? null : { family, current: version, latest: await fetchLatest(family) },
    ),
  )
  return updates.filter((u): u is Update => u !== null)
}

const printUpdates = (updates: Update[]): void => {
  if (updates.length === 0) {
    return
  }
  const width = Math.max(...updates.map((u) => u.family.length))
  console.log("\n[check-binaries] upstream versions:")
  for (const u of updates) {
    const latest = u.latest ?? "?"
    console.log(
      `  ${u.family.padEnd(width)}  ${u.current.padEnd(10)} -> ${latest.padEnd(10)} ${updateStatus(u)}`,
    )
  }
  for (const u of updates) {
    if (u.latest !== null && updateStatus(u) === "update available") {
      console.log(`\n# ${u.family} ${u.current} -> ${u.latest}`)
      for (const cmd of updateCommands({ ...u, latest: u.latest })) {
        console.log(cmd)
      }
    }
  }
}

const main = async (): Promise<number> => {
  const pkg = (await readJson<PackageJson>(resolve(ROOT, "package.json"))) ?? {}
  const pinned = await misePin()
  const problems = [
    ...(await collectFamilies(pkg)).flatMap(checkFamily),
    ...checkStaged(await collectStaged()),
    ...checkRuntime({
      running: Bun.version,
      pinned,
      engines: pkg.engines?.bun ?? "*",
      types: await installed("@types/bun"),
    }),
  ]

  if (problems.length === 0) {
    console.log("[check-binaries] binaries and runtime are in sync")
  } else {
    console.error("[check-binaries] drift:")
    for (const p of problems) {
      console.error(`  - ${p}`)
    }
  }

  if (!process.argv.includes("--offline")) {
    printUpdates(
      await collectUpdates({
        "@bufbuild/buf": await installed("@bufbuild/buf"),
        "@tailwindcss/oxide": await installed("@tailwindcss/oxide"),
        lightningcss: await installed("lightningcss"),
        "@biomejs/biome": await installed("@biomejs/biome"),
        bun: pinned,
      }),
    )
  }

  return problems.length === 0 ? 0 : 1
}

if (import.meta.main) {
  process.exit(await main())
}
