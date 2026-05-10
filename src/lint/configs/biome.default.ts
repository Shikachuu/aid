/**
 * Default Biome configuration applied when the user has no `biome.json[c]`.
 * Mirrors the repo's own settings minus the `files.includes` block — discovery
 * is handled by `aid` itself, not Biome's path matcher.
 */
export const biomeDefault = {
  $schema: "https://biomejs.dev/schemas/2.4.15/schema.json",
  formatter: {
    enabled: true,
    indentStyle: "space",
    indentWidth: 2,
    lineWidth: 100,
    lineEnding: "lf",
  },
  javascript: {
    formatter: {
      quoteStyle: "double",
      jsxQuoteStyle: "double",
      semicolons: "asNeeded",
      trailingCommas: "all",
      bracketSpacing: true,
      arrowParentheses: "always",
    },
  },
  css: {
    parser: { tailwindDirectives: true },
  },
  linter: {
    enabled: true,
    rules: { recommended: true },
  },
} as const
