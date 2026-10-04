/**
 * Return the index of the `}` matching the `{` at `openIdx`, or -1 if unbalanced.
 * Braces inside CSS strings and comments are counted too.
 */
export function findMatchingBrace(css: string, openIdx: number): number {
  let depth = 0
  for (let i = openIdx; i < css.length; i++) {
    const c = css[i]
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
