import { useEffect, useMemo, useState } from "react"
import { type ProtoAst, parseProto } from "../parser"

/**
 * Input to `useProtoAst`. Exactly one of `protoText`, `protoUrl`, or `ast` must
 * be supplied. The discriminated arms make mismatched combinations a type error.
 */
export type UseProtoAstOptions =
  | { protoText: string; protoUrl?: never; ast?: never }
  | { protoUrl: string; protoText?: never; ast?: never }
  | { ast: ProtoAst; protoText?: never; protoUrl?: never }

export type UseProtoAstResult =
  | { status: "loading"; ast: null; error: null; source: null }
  | { status: "ready"; ast: ProtoAst; error: null; source: string | null }
  | { status: "error"; ast: null; error: Error; source: null }

const LOADING: UseProtoAstResult = { status: "loading", ast: null, error: null, source: null }

/**
 * Source-loading + parsing lifecycle hook. Pass `protoText` for inline source,
 * `protoUrl` for built-in fetch, or `ast` to skip both stages — useful when an
 * external loader (SWR, react-query, redux, a custom transport) has already
 * produced the AST. Transitions: `loading` → (`ready` | `error`).
 */
export const useProtoAst = (options: UseProtoAstOptions): UseProtoAstResult => {
  const { protoText, protoUrl, ast } = options
  const [fetched, setFetched] = useState<{ url: string; source: string } | null>(null)
  const [fetchError, setFetchError] = useState<Error | null>(null)

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
          setFetchError(err instanceof Error ? err : new Error(String(err)))
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
    if (fetchError) {
      return { status: "error", ast: null, error: fetchError, source: null }
    }
    if (fetched && fetched.url === protoUrl) {
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
