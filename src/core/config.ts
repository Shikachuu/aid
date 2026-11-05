import { realpath } from "node:fs/promises"
import path from "node:path"
import { z } from "zod"
import { isLexicallyInside } from "./internal/paths"
import type { BuildContext } from "./types"

const AiTarget = z
  .enum(["chatgpt", "claude", "gemini"])
  .describe("Supported LLM chat target for the 'Open in AI' button.")

/** Valid TCP port for the dev server. Shared by the config schema and the `--port` flag. */
export const PortSchema = z.number().int().min(0).max(65535)

const SearchWeights = z
  .object({
    markdown: z
      .number()
      .nonnegative()
      .default(1.0)
      .describe("Search ranking boost for markdown pages."),
    html: z.number().nonnegative().default(1.0).describe("Search ranking boost for HTML pages."),
    openapi: z
      .number()
      .nonnegative()
      .default(2.0)
      .describe("Search ranking boost for OpenAPI operations and schemas."),
    proto: z
      .number()
      .nonnegative()
      .default(1.5)
      .describe("Search ranking boost for proto messages and RPCs."),
    jsonschema: z
      .number()
      .nonnegative()
      .default(1.5)
      .describe("Search ranking boost for JSON Schema fields and definitions."),
  })
  .describe("Per-format search ranking weights, applied via MiniSearch boostDocument.")

/** Zod schema for `aid.yaml`. `scripts/emit-schema.ts` derives the published JSON Schema from it. */
export const AidConfigSchema = z
  .object({
    name: z.string().min(1).describe("Project display name. Required."),
    description: z
      .string()
      .optional()
      .describe("Short site description. Used as the llms.txt summary line."),
    version: z.string().optional().describe("Project version string (semver recommended)."),
    base_url: z
      .string()
      .url()
      .optional()
      .describe(
        "Absolute origin of the published site (e.g. https://docs.example.com). Makes llms.txt links absolute; base_path is appended to it.",
      ),
    base_path: z
      .string()
      .default("/")
      .describe(
        "URL path prefix for all routes. Default '/'. Use '/docs' to host at example.com/docs/.",
      ),

    stylesheet: z
      .string()
      .default("main.css")
      .describe(
        "Path to the Tailwind CSS entrypoint. Applied uniformly to every page type (markdown, HTML, OpenAPI, proto).",
      ),

    dir: z
      .object({
        content: z
          .string()
          .default("docs")
          .describe("Content root directory. Files here become routes. Default 'docs'."),
        output: z.string().default("dist").describe("Build output directory. Default 'dist'."),
        templates: z
          .string()
          .default("")
          .describe(
            "Optional directory holding an llms.txt template override. Tailwind also scans it for class names. Empty string means the bundled defaults.",
          ),
        static: z
          .string()
          .default("static")
          .describe(
            "Directory copied verbatim into the build output. Use for images, fonts, favicon, robots.txt. Default 'static'.",
          ),
      })
      .prefault({})
      .describe("Project directory configuration."),

    theme: z
      .object({
        dark_mode: z
          .enum(["auto", "manual", "off"])
          .default("auto")
          .describe(
            "Dark mode strategy. 'auto' derives the dark palette from your light tokens. 'manual' expects explicit dark variants in main.css. 'off' disables dark mode entirely.",
          ),
      })
      .prefault({})
      .describe("Theme configuration."),

    ai_targets: z
      .array(AiTarget)
      .default(["chatgpt", "claude"])
      .describe(
        "Not implemented yet: the build does not read this key. Reserved for the 'Open in AI' button targets.",
      ),

    search: z
      .object({
        enabled: z
          .boolean()
          .default(true)
          .describe("Generate the cross-format search index at build time."),
        typo_tolerance: z
          .number()
          .min(0)
          .max(1)
          .default(0.2)
          .describe(
            "Fraction of term length allowed as edit distance. 0.2 = up to 1 edit per 5 chars. 0 disables typo tolerance.",
          ),
        weights: SearchWeights.prefault({}),
      })
      .prefault({})
      .describe("Cross-format search configuration."),

    on_broken_links: z
      .enum(["error", "warn"])
      .default("error")
      .describe(
        "What to do when a relative link, link fragment or colocated image does not resolve. 'error' fails the build; 'warn' prints the report and continues.",
      ),

    dev: z
      .object({
        port: PortSchema.default(3000).describe("Dev server port."),
        host: z.string().default("localhost").describe("Dev server host."),
      })
      .prefault({})
      .describe("Dev server configuration."),
  })
  .describe(
    "aid project configuration. Generated JSON Schema is published at https://aid.tools/schemas/v0/aid.schema.json.",
  )

/** Parsed `aid.yaml` with every default applied. */
export type AidConfig = z.infer<typeof AidConfigSchema>

/** Read a YAML config file and validate it against {@link AidConfigSchema}. */
export async function loadConfig(file: string): Promise<AidConfig> {
  return AidConfigSchema.parse(Bun.YAML.parse(await Bun.file(file).text()))
}

/**
 * Resolve every configured directory in `config` against `cwd`. An empty
 * `dir.templates` means no override templates.
 */
export function buildContext(config: AidConfig, cwd: string): BuildContext {
  const ctx: BuildContext = {
    config,
    cwd,
    contentDir: path.resolve(cwd, config.dir.content),
    outputDir: path.resolve(cwd, config.dir.output),
    templatesDir: config.dir.templates === "" ? null : path.resolve(cwd, config.dir.templates),
    staticDir: path.resolve(cwd, config.dir.static),
  }
  assertNoInputOverlap(ctx.outputDir, ctx)
  return ctx
}

const inputDirs = (ctx: BuildContext) =>
  [
    ["dir.content", ctx.contentDir],
    ["dir.static", ctx.staticDir],
    ["dir.templates", ctx.templatesDir],
  ] as const

/** A build that writes into its own sources would read its output back as pages. */
function assertNoInputOverlap(outputDir: string, ctx: BuildContext, resolved = ctx): void {
  for (const [key, dir] of inputDirs(resolved)) {
    if (dir === null) {
      continue
    }
    if (
      outputDir === dir ||
      isLexicallyInside(outputDir, dir) ||
      isLexicallyInside(dir, outputDir)
    ) {
      throw new Error(
        `aid: dir.output (${ctx.outputDir}) overlaps ${key} (${dir}). Point dir.output at a directory of its own.`,
      )
    }
  }
}

const realOrSelf = async (p: string): Promise<string> => {
  try {
    return await realpath(p)
  } catch {
    return p
  }
}

/**
 * Throw unless deleting `outputDir` recursively, as `aid build --clean` does,
 * can only remove build output. Symlinks and case-insensitive file systems are
 * resolved through `realpath`, so they cannot point the delete at sources.
 */
export async function assertSafeToClean(ctx: BuildContext): Promise<void> {
  const [outputDir, cwd] = await Promise.all([realOrSelf(ctx.outputDir), realOrSelf(ctx.cwd)])
  if (!isLexicallyInside(outputDir, cwd)) {
    throw new Error(
      `aid: refusing --clean: dir.output "${ctx.config.dir.output}" resolves to ${outputDir}, which must be a subdirectory of the project directory ${cwd}.`,
    )
  }
  const [contentDir, staticDir, templatesDir] = await Promise.all([
    realOrSelf(ctx.contentDir),
    realOrSelf(ctx.staticDir),
    ctx.templatesDir === null ? null : realOrSelf(ctx.templatesDir),
  ])
  assertNoInputOverlap(outputDir, ctx, { ...ctx, contentDir, staticDir, templatesDir })
}

/**
 * Load the config at `file` (relative to `dir`) and build its context with
 * {@link buildContext}. `dir` defaults to the current working directory.
 */
export async function loadBuildContext(
  dir: string | undefined,
  file: string,
): Promise<BuildContext> {
  const cwd = path.resolve(dir ?? ".")
  return buildContext(await loadConfig(path.resolve(cwd, file)), cwd)
}
