/**
 * Default `buf.yaml` content used when the project has no `buf.yaml` of its own.
 * `buf lint` takes it inline through `--config`.
 */
export const bufDefault = `version: v2
lint:
  use:
    - STANDARD
`
