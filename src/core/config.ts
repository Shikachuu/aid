import { z } from "zod"

const AiTarget = z
  .enum(["chatgpt", "claude", "gemini"])
  .describe("Supported LLM chat target for the 'Open in AI' button.")

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
  })
  .describe("Per-format search ranking weights, applied via MiniSearch boostDocument.")

export const AidConfigSchema = z
  .object({
    name: z.string().min(1).describe("Project display name. Required."),
    description: z
      .string()
      .optional()
      .describe("Short site description used in <meta> tags and llms.txt."),
    version: z.string().optional().describe("Project version string (semver recommended)."),
    base_url: z
      .string()
      .url()
      .optional()
      .describe(
        "Absolute base URL of the published site (e.g. https://docs.example.com). Used for canonical links and llms.txt.",
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
            "Optional directory of named partial overrides. Empty string = use bundled defaults only.",
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
        "LLM chat targets that get an 'Open in AI' button on every page. Empty list disables the buttons.",
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

    dev: z
      .object({
        port: z.number().int().min(0).max(65535).default(3000).describe("Dev server port."),
        host: z.string().default("localhost").describe("Dev server host."),
      })
      .prefault({})
      .describe("Dev server configuration."),
  })
  .describe(
    "aid project configuration. Generated JSON Schema is published at https://aid.tools/schemas/v0/aid.schema.json.",
  )

export type AidConfig = z.infer<typeof AidConfigSchema>

export async function loadConfig(path: string): Promise<AidConfig> {
  const text = await Bun.file(path).text()
  const raw = parseYaml(text)
  return AidConfigSchema.parse(raw)
}

function parseYaml(text: string): unknown {
  const bunYAML = (globalThis as { Bun?: { YAML?: { parse?: (s: string) => unknown } } }).Bun?.YAML
  if (!bunYAML?.parse) {
    throw new Error(
      "Bun.YAML.parse is not available. aid requires Bun >= 1.2 for native YAML parsing.",
    )
  }
  return bunYAML.parse(text)
}
