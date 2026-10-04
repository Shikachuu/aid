/**
 * Default Biome configuration applied when the user has no `biome.json[c]`.
 * It has no `files.includes` block, because `aid` discovers files itself.
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
