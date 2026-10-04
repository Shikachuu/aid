#!/usr/bin/env bash
# Exits 0 unconditionally so transient formatter errors never block the assistant.
set -eo pipefail

payload=$(cat)
file=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')
[[ -z "$file" || ! -f "$file" ]] && exit 0

case "$file" in
  */node_modules/*|*/dist/*|*/.bun/*|*/schemas/aid.schema.json) exit 0 ;;
esac

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.jsonc|*.css)
    bun x biome check --write --no-errors-on-unmatched "$file" >/dev/null 2>&1 || true
    ;;
  *.md)
    bun x markdownlint-cli2 --fix "$file" >/dev/null 2>&1 || true
    ;;
esac

exit 0
