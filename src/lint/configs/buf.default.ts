/**
 * Default `buf.yaml` content used when the project has no `buf.yaml` of its own.
 * Written to a tmp file and passed to `buf` via `--config <path>`.
 */
export const bufDefault = `version: v2
lint:
  use:
    - STANDARD
breaking:
  use:
    - FILE
`
