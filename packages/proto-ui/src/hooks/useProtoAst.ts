import { useEffect, useMemo, useState } from "react"
import { type ProtoAst, parseProto } from "../parser"

/**
 * The proto source for `useProtoAst`. Pass exactly one of `protoText` for inline source, `protoUrl`
 * to fetch it, or `ast` when you already have a parsed AST.
 */
export type UseProtoAstOptions =
  | { protoText: string; protoUrl?: never; ast?: never }
  | { protoUrl: string; protoText?: never; ast?: never }
  | { ast: ProtoAst; protoText?: never; protoUrl?: never }

/**
 * Load state of a proto source. `source` holds the parsed text, or null when the caller passed
 * `ast`.
 */
export type UseProtoAstResult =
  | { status: "loading"; ast: null; error: null; source: null }
  | { status: "ready"; ast: ProtoAst; error: null; source: string | null }
  | { status: "error"; ast: null; error: Error; source: null }

const LOADING: UseProtoAstResult = { status: "loading", ast: null, error: null, source: null }

const NO_SOURCE: UseProtoAstResult = {
  status: "error",
  ast: null,
  error: new Error("useProtoAst needs protoText, protoUrl, or ast"),
  source: null,
}

/**
 * Load and parse a proto source. `protoText` and `ast` resolve on the first render. `protoUrl`
 * starts in `loading`, and a new URL aborts the previous fetch. An empty `protoUrl` with no other
 * source is an error.
 */
export const useProtoAst = (options: UseProtoAstOptions): UseProtoAstResult => {
  const { protoText, protoUrl, ast } = options
  const [fetched, setFetched] = useState<{ url: string; source: string } | null>(null)
  const [fetchError, setFetchError] = useState<{ url: string; error: Error } | null>(null)

  useEffect(() => {
    if (!protoUrl) {
      setFetched(null)
      setFetchError(null)
      return
    }
    const controller = new AbortController()
    setFetchError(null)
    const run = async () => {
      try {
        const res = await fetch(protoUrl, { signal: controller.signal })
        if (!res.ok) {
          throw new Error(`Failed to fetch ${protoUrl}: HTTP ${res.status}`)
        }
        const source = await res.text()
        if (!controller.signal.aborted) {
          setFetched({ url: protoUrl, source })
        }
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          setFetchError({
            url: protoUrl,
            error: err instanceof Error ? err : new Error(String(err)),
          })
        }
      }
    }
    void run()
    return () => controller.abort()
  }, [protoUrl])

  return useMemo<UseProtoAstResult>(() => {
    if (ast != null) {
      return { status: "ready", ast, error: null, source: null }
    }
    if (protoText != null) {
      return parseSafe(protoText)
    }
    if (!protoUrl) {
      return NO_SOURCE
    }
    if (fetchError?.url === protoUrl) {
      return { status: "error", ast: null, error: fetchError.error, source: null }
    }
    if (fetched?.url === protoUrl) {
      return parseSafe(fetched.source)
    }
    return LOADING
  }, [ast, protoText, protoUrl, fetched, fetchError])
}

const parseSafe = (source: string): UseProtoAstResult => {
  try {
    const ast = parseProto(source)
    return { status: "ready", ast, error: null, source }
  } catch (err) {
    return {
      status: "error",
      ast: null,
      error: err instanceof Error ? err : new Error(String(err)),
      source: null,
    }
  }
}
