#!/usr/bin/env bun
import path from "node:path"
import { renderBunfig } from "../src/lint/bun"
import { formatOptions, type LintRule, lintRules } from "../src/lint/configs/bun.default"
import { driftedFiles, type GeneratedFile } from "./generated-files"

const ROOT = path.resolve(import.meta.dir, "..")

/** Rules the aid repository adds on top of the bundled defaults. */
export const repoRules: Record<string, LintRule> = {
  "import/no-default-export": "error",
  "import/no-namespace": "error",
  curly: ["error", "all"],
  "@typescript-eslint/consistent-type-definitions": ["error", "type"],
  "prefer-arrow-callback": "error",
  "promise/prefer-await-to-then": "error",
}

// Error messages and UI strings end up in terminals and pages that may not render
// unicode punctuation, so `src/` keeps string literals ASCII. Write `…` when
// the character is wanted.
const SRC_OVERRIDE = `
[[lint.overrides]]
files = ["src/**"]

[lint.overrides.rules]
"bun/no-restricted-text" = ["error", { patterns = [{ pattern = ${JSON.stringify("[^\\x00-\\x7F]")}, message = "Use ASCII in src/ string literals, or a \\\\u escape.", in = ["strings", "templates"] }] }]
`

const TAILWIND_FUNCTIONS = ["clsx", "cn", "tw", "twMerge", "cva"]

// Formatting lives in a Prettier config because only Prettier's Tailwind plugin
// takes `tailwindStylesheet`. Without it, `bun fmt` sorts aid's own theme
// classes, such as `bg-aid-bg`, as unknown classes.
const prettierConfig = {
  ...formatOptions,
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindStylesheet: "./src/theme/main.css",
  tailwindFunctions: TAILWIND_FUNCTIONS,
  overrides: [
    {
      files: "packages/proto-ui/**",
      options: { tailwindStylesheet: "./packages/proto-ui/src/tailwind-entry.css" },
    },
  ],
}

/** Every file this script owns, with its expected content. */
export const generated = (): GeneratedFile[] => [
  {
    path: "bunfig.toml",
    content: renderBunfig({ lint: { rules: { ...lintRules, ...repoRules } } }) + SRC_OVERRIDE,
  },
  { path: ".prettierrc.json", content: `${JSON.stringify(prettierConfig, null, 2)}\n` },
]

if (import.meta.main) {
  const files = generated()
  if (process.argv.includes("--check")) {
    const drifted = await driftedFiles(ROOT, files)
    if (drifted.length > 0) {
      console.error(
        `[gen-bunfig] out of date: ${drifted.join(", ")}. Run 'bun run gen-bunfig' and commit.`,
      )
      process.exit(1)
    }
    console.log(`[gen-bunfig] ${files.map((f) => f.path).join(" and ")} are in sync.`)
  } else {
    await Promise.all(files.map((f) => Bun.write(path.join(ROOT, f.path), f.content)))
    console.log(`[gen-bunfig] wrote ${files.map((f) => f.path).join(" and ")}.`)
  }
}
