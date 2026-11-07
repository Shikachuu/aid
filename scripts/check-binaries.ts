#!/usr/bin/env bun
/**
 * Exit 1 when the embedded native binaries or the Bun runtime drift from their pins.
 * Without `--offline`, also report newer upstream versions and the commands to bump them.
 */

import { resolve } from "node:path"
import { lcssNodeFile, TARGETS } from "./natives"

const REPO_ROOT = resolve(import.meta.dir, "..")

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

const baseVersion = (v: string): string => v.split("-")[0] ?? v

/** List where the Bun runtime disagrees with its pins. */
export const checkRuntime = ({ running, pinned, engines, types }: Runtime): string[] => {
  if (pinned === null) {
    return ["mise.toml does not pin bun"]
  }
  const problems: string[] = []
  if (running !== pinned) {
    problems.push(`running Bun ${running}, but mise.toml pins ${pinned} (run \`mise install\`)`)
  }
  if (!Bun.semver.satisfies(baseVersion(pinned), engines)) {
    problems.push(`mise.toml pins Bun ${pinned}, which does not satisfy engines.bun "${engines}"`)
  }
  if (types === null) {
    problems.push("@types/bun is not installed (run `mise install`)")
  } else if (majorMinor(types) !== majorMinor(pinned)) {
    problems.push(`@types/bun is ${types}, but mise.toml pins Bun ${pinned}`)
  }
  return problems
}

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
    case "bun":
      return [
        `# set version = "${latest}" under [tools."http:bun"] in mise.toml`,
        "mise lock --platform linux-x64,linux-arm64,macos-arm64,macos-x64",
        "mise install",
        `bun add -d --exact ${exact(TARGETS.map((t) => t.bunSubpkg))}`,
        `bun add -d @types/bun@^${baseVersion(latest)}`,
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

const installed = async (root: string, pkg: string): Promise<string | null> =>
  (await readJson<PackageJson>(resolve(root, "node_modules", pkg, "package.json")))?.version ?? null

const hashFile = async (path: string): Promise<bigint | null> => {
  const file = Bun.file(path)
  return (await file.exists()) ? BigInt(Bun.hash(await file.arrayBuffer())) : null
}

const subpackageFamily = async (
  root: string,
  parent: string,
  subpkgs: string[],
  pins: Record<string, string>,
): Promise<Family> => ({
  name: parent,
  expected: await installed(root, parent),
  members: (
    await Promise.all(
      subpkgs.map(async (pkg): Promise<Member[]> => [
        { name: `${pkg} (package.json)`, version: pins[pkg] ?? null },
        { name: pkg, version: await installed(root, pkg) },
      ]),
    )
  ).flat(),
})

const collectFamilies = async (
  root: string,
  pkg: PackageJson,
  bunPin: string | null,
): Promise<Family[]> => {
  const pins = pkg.devDependencies ?? {}
  const twNode = await readJson<PackageJson>(
    resolve(root, "node_modules", "@tailwindcss/node", "package.json"),
  )
  return [
    await subpackageFamily(
      root,
      "@bufbuild/buf",
      TARGETS.map((t) => t.bufSubpkg),
      pins,
    ),
    await subpackageFamily(
      root,
      "@tailwindcss/oxide",
      TARGETS.map((t) => t.oxideSubpkg),
      pins,
    ),
    {
      name: "Bun runtime (pinned by mise.toml)",
      expected: bunPin,
      members: (
        await Promise.all(
          TARGETS.map(async (t) => [
            { name: `${t.bunSubpkg} (package.json)`, version: pins[t.bunSubpkg] ?? null },
            {
              name: t.bunSubpkg,
              version: (await installed(root, t.bunSubpkg))?.split("+")[0] ?? null,
            },
          ]),
        )
      ).flat(),
    },
    {
      name: "lightningcss (pinned by @tailwindcss/node)",
      expected: twNode?.dependencies?.lightningcss ?? null,
      members: [
        {
          name: "lightningcss (package.json)",
          version: pkg.dependencies?.lightningcss ?? null,
        },
        { name: "lightningcss", version: await installed(root, "lightningcss") },
        ...(await Promise.all(
          TARGETS.map(async (t) => ({
            name: t.lcssSubpkg,
            version: await installed(root, t.lcssSubpkg),
          })),
        )),
      ],
    },
  ]
}

/** Hash every lightningcss binding in `node_modules` and its staged copy in `vendor/natives`. */
export const collectStaged = (root = REPO_ROOT): Promise<StagedNative[]> =>
  Promise.all(
    TARGETS.map(async ({ lcssSubpkg: name }) => ({
      name,
      source: await hashFile(resolve(root, "node_modules", name, lcssNodeFile(name))),
      staged: await hashFile(resolve(root, "vendor", "natives", `${name}.bin`)),
    })),
  )

/** Read the Bun version that `mise.toml` pins, or `null` when it pins none. */
export const misePin = async (root = REPO_ROOT): Promise<string | null> => {
  const file = Bun.file(resolve(root, "mise.toml"))
  if (!(await file.exists())) {
    return null
  }
  const toml = Bun.TOML.parse(await file.text()) as {
    tools?: Record<string, unknown>
  }
  const pin = toml.tools?.bun ?? toml.tools?.["http:bun"]
  if (typeof pin === "string") {
    return pin
  }
  const version = (pin as { version?: unknown } | undefined)?.version
  return typeof version === "string" ? version : null
}

const LOOKUP_TIMEOUT_MS = 10_000

/** Latest published version of `pkg`. Throws after 10 s, on a non-2xx reply, or when the reply has no string `version`. */
export const npmLatest = async (
  pkg: string,
  fetchImpl: (url: string, init: RequestInit) => Promise<Response> = fetch,
): Promise<string> => {
  const res = await fetchImpl(`https://registry.npmjs.org/${pkg}/latest`, {
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error(`npm registry returned ${res.status} for ${pkg}`)
  }
  const version = ((await res.json()) as { version?: unknown } | null)?.version
  if (typeof version !== "string") {
    throw new Error(`npm registry returned no version for ${pkg}`)
  }
  return version
}

const miseLatestBun = async (): Promise<string> => {
  const proc = Bun.spawn(["mise", "latest", "bun"], {
    cwd: REPO_ROOT,
    stdout: "pipe",
    stderr: "pipe",
    timeout: LOOKUP_TIMEOUT_MS,
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  const version = stdout.trim()
  if (code !== 0 || version === "") {
    throw new Error(`\`mise latest bun\` failed (exit ${code}): ${stderr.trim()}`)
  }
  return version
}

/**
 * The latest stable Bun, or the pin itself while the pin is a canary that no
 * stable release has reached yet, so a canary pin is not reported as ahead.
 */
export const latestBunKeepingCanaryPin = async (
  pinned: string | null,
  stable: () => Promise<string> = miseLatestBun,
): Promise<string> => {
  const latest = await stable()
  return pinned !== null && Bun.semver.order(latest, pinned) <= 0 ? pinned : latest
}

const fetchLatest = async (family: string, current: string): Promise<string | null> => {
  try {
    return family === "bun" ? await latestBunKeepingCanaryPin(current) : await npmLatest(family)
  } catch (err) {
    console.error(`[check-binaries] could not look up ${family}: ${(err as Error).message}`)
    return null
  }
}

const collectUpdates = async (current: Record<string, string | null>): Promise<Update[]> => {
  const updates = await Promise.all(
    Object.entries(current).map(async ([family, version]): Promise<Update | null> =>
      version === null
        ? null
        : { family, current: version, latest: await fetchLatest(family, version) },
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

/**
 * The running Bun version. A canary reports only its base version, such as
 * 1.4.4, so a canary pin matches when the running binary is the pinned one.
 */
export const runningBun = async (pinned: string | null, root = REPO_ROOT): Promise<string> => {
  if (!pinned?.includes("-")) {
    return Bun.version
  }
  const host = TARGETS.find((t) => t.platform === process.platform && t.arch === process.arch)
  const pinnedBinary = host && resolve(root, "node_modules", host.bunSubpkg, "bin", "bun")
  const same =
    pinnedBinary !== undefined &&
    (await hashFile(process.execPath)) === (await hashFile(pinnedBinary))
  return same ? pinned : `${Bun.version}+${Bun.revision.slice(0, 9)}`
}

/** Print drift and, unless `--offline`, upstream updates. Return the exit code. */
export const main = async (argv = process.argv, root = REPO_ROOT): Promise<number> => {
  const pkg = (await readJson<PackageJson>(resolve(root, "package.json"))) ?? {}
  const pinned = await misePin(root)
  const problems = [
    ...(await collectFamilies(root, pkg, pinned)).flatMap(checkFamily),
    ...checkStaged(await collectStaged(root)),
    ...checkRuntime({
      running: await runningBun(pinned, root),
      pinned,
      engines: pkg.engines?.bun ?? "*",
      types: await installed(root, "@types/bun"),
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

  if (!argv.includes("--offline")) {
    printUpdates(
      await collectUpdates({
        "@bufbuild/buf": await installed(root, "@bufbuild/buf"),
        "@tailwindcss/oxide": await installed(root, "@tailwindcss/oxide"),
        lightningcss: await installed(root, "lightningcss"),
        bun: pinned,
      }),
    )
  }

  return problems.length === 0 ? 0 : 1
}

if (import.meta.main) {
  process.exit(await main())
}
