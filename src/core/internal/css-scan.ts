const STRING_OR_COMMENT =
  /"(?:\\[\s\S]|[^"\\\n])*"|'(?:\\[\s\S]|[^'\\\n])*'|\/\*([\s\S]*?)\*\/|\/\*[\s\S]*$/g

/**
 * Callers scan `code` with regexes and slice the original text at the same
 * offsets. `emptyComments` and `unterminatedComment` feed the CSS lint.
 */
export type Blanked = { code: string; emptyComments: number[]; unterminatedComment?: number }

/** Lets callers run brace and at-rule regexes over CSS without matching text inside strings or comments. */
export const blankStringsAndComments = (text: string): Blanked => {
  let code = ""
  let cursor = 0
  const emptyComments: number[] = []
  let unterminatedComment: number | undefined
  for (const match of text.matchAll(STRING_OR_COMMENT)) {
    code += text.slice(cursor, match.index) + " ".repeat(match[0].length)
    cursor = match.index + match[0].length
    if (match[1]?.trim() === "") {
      emptyComments.push(match.index)
    } else if (match[0].startsWith("/*") && match[1] === undefined) {
      unterminatedComment = match.index
    }
  }
  return { code: code + text.slice(cursor), emptyComments, unterminatedComment }
}

/**
 * Return the index of the `}` matching the `{` at `openIdx` in `code`, or -1 if
 * unbalanced. Pass {@link blankStringsAndComments} output, so braces in strings
 * and comments do not count.
 */
export function findMatchingBrace(code: string, openIdx: number): number {
  let depth = 0
  for (let i = openIdx; i < code.length; i++) {
    const c = code[i]
    if (c === "{") {
      depth++
    } else if (c === "}") {
      depth--
      if (depth === 0) {
        return i
      }
    }
  }
  return -1
}
