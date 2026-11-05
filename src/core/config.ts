import { existsSync, realpathSync } from "node:fs"
import path from "node:path"
import { z } from "zod"
import { isLexicallyInside } from "./internal/paths"
import type { BuildContext } from "./types"

const AiTarget = z
  .enum(["chatgpt", "claude", "gemini"])
  .describe("Supported LLM chat target for the 'Open in AI' button.")

/** Valid TCP port for the dev server. Shared by the config schema and the `--port` flag. */
export const PortSchema = z.number().int().min(0).max(65535)

const BASE_PATH_RE = /^\/(?:[^/\s\\?#][^\s\\?#]*)?$/

const trimTrailingSlashes = (basePath: string): string => basePath.replace(/\/+$/, "") || "/"

const isOrigin = (value: string): boolean => {
  const url = URL.parse(value)
  return url === null || url.pathname === "/" && url.search === "" && url.hash === "" && url.username === ""
}

const SearchWeights = z
  .strictObject({
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
  .strictObject({
    name: z.string().min(1).describe("Project display name. Required."),
    description: z
      .string()
      .optional()
      .describe("Short site description. Used as the llms.txt summary line."),
    version: z.string().optional().describe("Project version string (semver recommended)."),
    base_url: z
      .url({ protocol: /^https?$/, error: "base_url must be an http or https URL" })
      .refine(isOrigin, {
        message:
          "base_url must be an origin with no path, query or fragment; put the path in base_path",
      })
      .optional()
      .describe(
        "Origin of the published site (e.g. https://docs.example.com), with no path. Makes llms.txt links absolute; put a sub-path in base_path.",
      ),
    base_path: z
      .string()
      .regex(BASE_PATH_RE, {
        message: "base_path must start with a single '/' and hold no whitespace, '\\', '?' or '#'",
      })
      .default("/")
      .transform(trimTrailingSlashes)
      .describe(
        "URL path prefix for all routes. Must start with '/'; a trailing slash is dropped. Default '/'. Use '/docs' to host at example.com/docs/.",
      ),

    stylesheet: z
      .string()
      .default("main.css")
      .describe(
        "Path to the Tailwind CSS entrypoint. Applied uniformly to every page type (markdown, HTML, OpenAPI, proto).",
      ),

    dir: z
      .strictObject({
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
      .strictObject({
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
      .strictObject({
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
      .strictObject({
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

/**
 * Read a YAML config file and validate it against {@link AidConfigSchema}.
 * Every failure (missing file, a directory, empty or invalid YAML, schema
 * errors) becomes one `aid:` line that names the file.
 */
export async function loadConfig(file: string): Promise<AidConfig> {
  const text = await readConfigText(file)
  let raw: unknown
  try {
    raw = Bun.YAML.parse(text)
  } catch (err) {
    throw new Error(`aid: ${file} is not valid YAML: ${(err as Error).message}`, { cause: err })
  }
  if (raw === null || raw === undefined) {
    throw new Error(`aid: ${file} is empty. Set at least \`name\`.`)
  }
  const result = AidConfigSchema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ")
    throw new Error(`aid: invalid config ${file}: ${issues}`, { cause: result.error })
  }
  return result.data
}

async function readConfigText(file: string): Promise<string> {
  try {
    return await Bun.file(file).text()
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === "ENOENT") {
      const alternative = path.join(path.dirname(file), "aid.yml")
      const hint =
        path.basename(file) === "aid.yaml" && existsSync(alternative)
          ? ` Found aid.yml next to it; pass -f aid.yml.`
          : ""
      throw new Error(`aid: config file ${file} not found.${hint}`, { cause: err })
    }
    if (code === "EISDIR") {
      throw new Error(`aid: config path ${file} is a directory, not a YAML file.`, { cause: err })
    }
    throw new Error(`aid: cannot read config file ${file}: ${(err as Error).message}`, {
      cause: err,
    })
  }
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
  assertNoInputOverlap(ctx)
  return ctx
}

const realPathOfNearestAncestor = (p: string): string => {
  let existing = p
  while (!existsSync(existing)) {
    const parent = path.dirname(existing)
    if (parent === existing) {
      return p
    }
    existing = parent
  }
  try {
    return path.join(realpathSync(existing), path.relative(existing, p))
  } catch {
    return p
  }
}

function assertNoInputOverlap(ctx: BuildContext): void {
  const outputDir = realPathOfNearestAncestor(ctx.outputDir)
  const inputs = [
    ["dir.content", ctx.contentDir],
    ["dir.static", ctx.staticDir],
    ["dir.templates", ctx.templatesDir],
  ] as const
  for (const [key, raw] of inputs) {
    if (raw === null) {
      continue
    }
    const dir = realPathOfNearestAncestor(raw)
    if (
      outputDir === dir ||
      isLexicallyInside(outputDir, dir) ||
      isLexicallyInside(dir, outputDir)
    ) {
      throw new Error(
        `aid: dir.output (${ctx.outputDir}, resolved ${outputDir}) overlaps ${key} (${raw}, resolved ${dir}). Point dir.output at a directory of its own.`,
      )
    }
  }
}

/**
 * Throw unless deleting `outputDir` recursively, as `aid build --clean` does,
 * stays inside the project. Symlinks and case-insensitive file systems are
 * resolved through `realpath`, so they cannot point the delete elsewhere.
 */
export function assertSafeToClean(ctx: BuildContext): void {
  const outputDir = realPathOfNearestAncestor(ctx.outputDir)
  const cwd = realPathOfNearestAncestor(ctx.cwd)
  if (!isLexicallyInside(outputDir, cwd)) {
    throw new Error(
      `aid: refusing --clean: dir.output "${ctx.config.dir.output}" resolves to ${outputDir}, which must be a subdirectory of the project directory ${cwd}.`,
    )
  }
  assertNoInputOverlap(ctx)
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
