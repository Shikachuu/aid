import { useEffect, useMemo, useState } from "react"
import { type ProtoAst, parseProto } from "../parser"

/**
 * Input to `useProtoAst`. Exactly one of `protoText`, `protoUrl`, or `ast` may
 * be supplied; omitting all three lands in the idle state. The discriminated
 * arms make mismatched combinations a type error rather than a runtime quirk.
 */
export type UseProtoAstOptions =
  | { protoText: string; protoUrl?: never; ast?: never; signal?: never }
  | { protoUrl: string; protoText?: never; ast?: never; signal?: AbortSignal }
  | { ast: ProtoAst; protoText?: never; protoUrl?: never; signal?: never }
  | { protoText?: never; protoUrl?: never; ast?: never; signal?: never }

export type UseProtoAstResult =
  | { status: "idle"; ast: null; error: null; source: null }
  | { status: "loading"; ast: null; error: null; source: null }
  | { status: "ready"; ast: ProtoAst; error: null; source: string | null }
  | { status: "error"; ast: null; error: Error; source: null }

const IDLE: UseProtoAstResult = { status: "idle", ast: null, error: null, source: null }
const LOADING: UseProtoAstResult = { status: "loading", ast: null, error: null, source: null }

/**
 * Source-loading + parsing lifecycle hook. Pass `protoText` for inline source,
 * `protoUrl` for built-in fetch, or `ast` to skip both stages — useful when an
 * external loader (SWR, react-query, redux, a custom transport) has already
 * produced the AST. Transitions: `idle` → `loading` → (`ready` | `error`).
 */
export const useProtoAst = (options: UseProtoAstOptions): UseProtoAstResult => {
  const { protoText, protoUrl, ast, signal } = options
  const [fetched, setFetched] = useState<{ url: string; source: string } | null>(null)
  const [fetchError, setFetchError] = useState<Error | null>(null)

  useEffect(() => {
    if (!protoUrl) {
      setFetched(null)
      setFetchError(null)
      return
    }
    const controller = new AbortController()
    const onParentAbort = () => {
      controller.abort()
    }
    if (signal) {
      if (signal.aborted) {
        controller.abort()
      } else {
        signal.addEventListener("abort", onParentAbort, { once: true })
      }
    }
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
        const error = err instanceof Error ? err : new Error(String(err))
        if (controller.signal.aborted || error.name === "AbortError") {
          return
        }
        setFetchError(error)
      }
    }
    void run()
    return () => {
      controller.abort()
      if (signal) {
        signal.removeEventListener("abort", onParentAbort)
      }
    }
  }, [protoUrl, signal])

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
    if (protoUrl) {
      if (fetched && fetched.url === protoUrl) {
        return parseSafe(fetched.source)
      }
      return LOADING
    }
    return IDLE
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
