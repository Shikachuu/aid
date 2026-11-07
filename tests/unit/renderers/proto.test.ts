import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { Route } from "../../../src/core/types"
import { renderProto } from "../../../src/renderers/proto"

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "aid-proto-renderer-"))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function renderFixture(name: string, body: string, basePath?: string) {
  const sourcePath = path.join(dir, name)
  await Bun.write(sourcePath, body)
  const route: Route = { source: sourcePath, path: "/api/pets", kind: "proto" }
  return renderProto({ route, sourcePath, basePath })
}

const PETS = `syntax = "proto3";

// Pet store API.
//
// Second paragraph.
package demo.v1;

// A pet.
message Pet {
  // Pet name.
  string name = 1;
  // A tag on a pet.
  message Tag {
    string label = 1;
    // Tag color.
    enum Color {
      COLOR_UNSPECIFIED = 0;
      RED = 1;
    }
  }
  oneof owner {
    string person = 2;
  }
}

enum Kind {
  KIND_UNSPECIFIED = 0;
  // A dog.
  DOG = 1;
}

service PetSvc {
  // Get a pet.
  rpc Get(Pet) returns (Pet);
}
`

describe("renderProto", () => {
  test("titles the page with the package and describes it with its first paragraph", async () => {
    const page = await renderFixture("pets.proto", PETS)
    expect(page.searchTokens.title).toBe("demo.v1")
    expect(page.description).toBe("Pet store API.")
  })

  test("falls back to the file name when there is no package", async () => {
    const page = await renderFixture("plain.proto", 'syntax = "proto3";\nmessage M {}\n')
    expect(page.searchTokens.title).toBe("plain")
  })

  test("points the browser at the .proto export through base_path", async () => {
    const page = await renderFixture("pets.proto", PETS, "/docs")
    expect(page.html).toContain('data-proto-url="/docs/api/pets.proto"')
    expect(page.exports).toEqual([{ suffix: ".proto", body: PETS }])
    expect(page.hasProto).toBe(true)
  })

  test("indexes nested fields, oneofs, enum values, nested enums and fully qualified rpcs", async () => {
    const { extras, body } = (await renderFixture("pets.proto", PETS)).searchTokens
    expect(extras.messages).toEqual(["demo.v1.Pet", "demo.v1.Pet.Tag"])
    expect(extras.enums).toEqual(["demo.v1.Pet.Tag.Color", "demo.v1.Kind"])
    expect(extras.fields).toEqual(expect.arrayContaining(["name", "label", "person", "owner"]))
    expect(extras.values).toEqual(expect.arrayContaining(["RED", "DOG"]))
    expect(extras.services).toEqual(["demo.v1.PetSvc"])
    expect(extras.rpcs).toEqual(["demo.v1.PetSvc.Get"])
    for (const comment of [
      "A pet.",
      "Pet name.",
      "A tag on a pet.",
      "Tag color.",
      "A dog.",
      "Get a pet.",
    ]) {
      expect(body).toContain(comment)
    }
  })

  test("names the file when the source does not parse", async () => {
    await expect(
      renderFixture("bad.proto", 'syntax = "proto3";\nmessage M { int32 x = ; }\n'),
    ).rejects.toThrow(/aid: failed to parse .*bad\.proto: /)
  })
})
