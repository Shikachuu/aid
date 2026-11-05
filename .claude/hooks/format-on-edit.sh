#!/usr/bin/env bash
set -o pipefail

root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
payload=$(cat)
file=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' 2>/dev/null) || exit 0
[[ -z "$file" || ! -f "$file" ]] && exit 0

case "$file" in
  */node_modules/*|*/dist/*|*/.bun/*|*/schemas/aid.schema.json) exit 0 ;;
  */site/docs/reference/*|*/site/static/schemas/*|*/.prettierrc.json) exit 0 ;;
esac

bun_() { mise -C "$root" x -- bun "$@"; }

failed=""
report() { failed+="$1"$'\n'; }

case "$file" in
  *.ts|*.tsx|*.mts|*.cts|*.js|*.jsx|*.mjs|*.cjs|*.json|*.jsonc|*.css)
    out=$(bun_ fmt --no-script "$file" 2>&1) || report "bun fmt failed for $file:"$'\n'"$out"
    case "$file" in
      *.css|*.json|*.jsonc) ;;
      *) bun_ lint --no-script --fix "$file" >/dev/null 2>&1 ;;
    esac
    ;;
  *.md)
    out=$(AID_ROOT_DIR="$root" AID_MD_FILE="$file" bun_ -e '
      const { formatMarkdown } = await import(`${process.env.AID_ROOT_DIR}/src/fmt/markdown.ts`)
      const file = process.env.AID_MD_FILE
      await formatMarkdown([file], file.slice(0, file.lastIndexOf("/")), { check: false })
    ' 2>&1) || report "markdown formatting failed for $file:"$'\n'"$out"
    ;;
esac

if [[ -n "$failed" ]]; then
  printf 'format-on-edit: %s' "$failed" >&2
  exit 2
fi
exit 0
