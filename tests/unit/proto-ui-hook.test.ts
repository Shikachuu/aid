import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import {
  type UseProtoAstOptions,
  type UseProtoAstResult,
  useProtoAst,
} from "../../packages/proto-ui/src/hooks/useProtoAst"

const VALID = 'syntax = "proto3";\npackage demo;\nmessage M { string a = 1; }\n'

const RESPONSES: Record<string, () => Response> = {
  "/ok.proto": () => new Response(VALID),
  "/other.proto": () => new Response(VALID.replace("message M", "message Other")),
  "/missing.proto": () => new Response("nope", { status: 404 }),
  "/broken.proto": () => new Response("message {"),
}

let realFetch: typeof fetch
let root: Root | null = null
let container: HTMLElement | null = null
const seen: UseProtoAstResult[] = []

const Probe = (props: UseProtoAstOptions) => {
  seen.push(useProtoAst(props))
  return null
}

const latest = (): UseProtoAstResult => {
  const result = seen.at(-1)
  if (!result) {
    throw new Error("the probe never rendered")
  }
  return result
}

const render = async (props: UseProtoAstOptions): Promise<void> => {
  if (!container) {
    container = document.createElement("div")
    root = createRoot(container)
  }
  await act(async () => {
    root?.render(createElement(Probe, props))
  })
}

const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await Bun.sleep(1)
    })
  }
}

beforeAll(() => {
  GlobalRegistrator.register()
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    init?.signal?.throwIfAborted()
    const respond = RESPONSES[String(input)]
    return respond ? respond() : new Response("", { status: 500 })
  }) as typeof fetch
})

afterEach(async () => {
  await act(async () => root?.unmount())
  root = null
  container = null
  seen.length = 0
})

afterAll(async () => {
  globalThis.fetch = realFetch
  await GlobalRegistrator.unregister()
})

describe("useProtoAst", () => {
  test("protoText resolves on the first render", async () => {
    await render({ protoText: VALID })
    expect(seen[0]?.status).toBe("ready")
  })

  test("a protoUrl starts loading, then parses the fetched source", async () => {
    await render({ protoUrl: "/ok.proto" })
    expect(seen[0]?.status).toBe("loading")
    await settle()
    const result = latest()
    expect(result.status).toBe("ready")
    expect(result.ast?.messages.map((m) => m.name)).toEqual(["M"])
    expect(result.source).toBe(VALID)
  })

  test("an HTTP error becomes the error state", async () => {
    await render({ protoUrl: "/missing.proto" })
    await settle()
    expect(latest().status).toBe("error")
    expect(latest().error?.message).toBe("Failed to fetch /missing.proto: HTTP 404")
  })

  test("a parse error becomes the error state", async () => {
    await render({ protoUrl: "/broken.proto" })
    await settle()
    expect(latest().status).toBe("error")
  })

  test("switching URLs never shows the previous URL's error or AST", async () => {
    await render({ protoUrl: "/missing.proto" })
    await settle()
    expect(latest().status).toBe("error")
    seen.length = 0
    await render({ protoUrl: "/other.proto" })
    expect(seen.map((r) => r.status)).not.toContain("error")
    await settle()
    expect(seen.map((r) => r.status)).not.toContain("error")
    expect(latest().ast?.messages.map((m) => m.name)).toEqual(["Other"])

    seen.length = 0
    await render({ protoUrl: "/ok.proto" })
    expect(seen[0]?.status).toBe("loading")
    await settle()
    expect(latest().ast?.messages.map((m) => m.name)).toEqual(["M"])
  })
})
