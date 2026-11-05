/**
 * Used when the project has no `.markdownlint.*` file. Tabs stay legal in code
 * blocks because Makefile and Go samples need them.
 */
export const markdownlintDefault = {
  default: true,
  MD010: { code_blocks: false },
  MD013: false,
  MD024: { siblings_only: true },
  MD041: false,
} as const
