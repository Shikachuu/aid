import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import path from "node:path"
import type { ProtoReferenceProps } from "@aid/proto-ui"
import { createElement, type FunctionComponent } from "react"
import { renderToString } from "react-dom/server"

const ROOT = path.resolve(import.meta.dir, "../..")
let outdir = ""
let ProtoReference: FunctionComponent<ProtoReferenceProps>
let html = ""

// The output lives under node_modules so `react` resolves to the same copy.
beforeAll(async () => {
  const cache = path.join(ROOT, "node_modules", ".cache")
  await mkdir(cache, { recursive: true })
  outdir = await mkdtemp(path.join(cache, "proto-ui-render-"))
  const result = await Bun.build({
    entrypoints: [path.join(ROOT, "packages/proto-ui/src/index.ts")],
    outdir,
    target: "bun",
    jsx: { runtime: "automatic", importSource: "react" },
    external: ["react", "react-dom", "react/jsx-runtime"],
  })
  expect(result.success).toBe(true)
  ;({ ProtoReference } = await import(path.join(outdir, "index.js")))
  html = renderToString(createElement(ProtoReference, { protoText: SOURCE, baseHref: "/p" }))
})

afterAll(async () => {
  await rm(outdir, { recursive: true, force: true })
})

const SOURCE = `syntax = "proto3";
/** The pet store. <script>alert(1)</script> */
package demo.v1;
import "google/protobuf/timestamp.proto";

// A pet.
message Pet {
  google.protobuf.Timestamp born = 1;
  Owner owner = 2 [deprecated = true];
  oneof contact {
    string email = 3 [deprecated = true];
  }
}

message Owner { Pet pet = 1; }

service PetSvc {
  rpc Get(Pet) returns (Owner);
  rpc Watch(Pet) returns (stream Owner) { option deprecated = true; }
}
`

const badgesBetween = (start: string, end: string): number => {
  const from = html.indexOf(start)
  expect(from).toBeGreaterThan(-1)
  const fragment = html.slice(from, html.indexOf(end, from))
  return fragment.split('class="proto-deprecated-badge"').length - 1
}

describe("ProtoReference server render", () => {
  test("entity headers and rpcs carry their fqn anchors", () => {
    expect(html).toContain('id="demo.v1.Pet"')
    expect(html).toContain('id="demo.v1.Owner"')
    expect(html).toContain('id="demo.v1.PetSvc"')
    expect(html).toContain('id="demo.v1.PetSvc.Watch"')
  })

  test("type references link to anchors under baseHref, and WKTs link to protobuf.dev", () => {
    expect(html).toContain('href="/p#demo.v1.Owner"')
    expect(html).toContain('href="/p#demo.v1.Pet"')
    expect(html).toContain(
      'href="https://protobuf.dev/reference/protobuf/google.protobuf/#timestamp"',
    )
  })

  test("doc comments are escaped, and a block package doc renders", () => {
    expect(html).toContain("The pet store.")
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
  })

  test("deprecated fields, oneof members and rpcs get a badge", () => {
    expect(badgesBetween('<td class="proto-field-name">born', "</td>")).toBe(0)
    expect(badgesBetween('<td class="proto-field-name">owner', "</td>")).toBe(1)
    expect(badgesBetween('class="proto-oneof-field"', "</li>")).toBe(1)
    expect(badgesBetween('id="demo.v1.PetSvc.Get"', "</li>")).toBe(0)
    expect(badgesBetween('id="demo.v1.PetSvc.Watch"', "</li>")).toBe(1)
  })

  test("a parse error renders the error state", () => {
    const broken = renderToString(createElement(ProtoReference, { protoText: "message {" }))
    expect(broken).toContain('class="proto-error"')
  })
})
