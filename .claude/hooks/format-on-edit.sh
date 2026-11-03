#!/usr/bin/env bash
set -o pipefail

payload=$(cat)
file=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty' 2>/dev/null) || exit 0
[[ -z "$file" || ! -f "$file" ]] && exit 0

case "$file" in
  */node_modules/*|*/dist/*|*/.bun/*|*/schemas/aid.schema.json) exit 0 ;;
  */site/docs/reference/*|*/site/static/schemas/*) exit 0 ;;
esac

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.jsonc|*.css)
    mise x -- bun fmt --no-script "$file" >/dev/null 2>&1 || true
    case "$file" in *.css|*.json|*.jsonc) ;; *) mise x -- bun lint --no-script --fix "$file" >/dev/null 2>&1 || true ;; esac
    ;;
  *.md)
    AID_MD_FILE="$file" bun -e '
      const { formatMarkdown } = await import(`${process.env.CLAUDE_PROJECT_DIR ?? process.cwd()}/src/fmt/markdown.ts`)
      const file = process.env.AID_MD_FILE
      await formatMarkdown([file], file.slice(0, file.lastIndexOf("/")), { check: false })
    ' >/dev/null 2>&1 || true
    ;;
esac

exit 0
