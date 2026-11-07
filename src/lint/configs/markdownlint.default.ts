/** Default markdownlint config. Loaded when the user has no `.markdownlint.*` file. */
export const markdownlintDefault = {
  default: true,
  MD010: { code_blocks: false },
  MD013: false,
  MD024: { siblings_only: true },
  MD041: false,
} as const
