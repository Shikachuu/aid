#!/usr/bin/env bun
import { type CommandDef, defineCommand, runMain } from "citty"
import { version } from "../../package.json"

const main: CommandDef = defineCommand({
  meta: {
    name: "aid",
    version,
    description: "Single-binary documentation generator for markdown, HTML, OpenAPI, and Protobuf.",
  },
  subCommands: {
    init: async () => (await import("./commands/init")).command,
    dev: async () => (await import("./commands/dev")).command,
    build: async () => (await import("./commands/build")).command,
    lint: async () => (await import("./commands/lint")).command,
    fmt: async () => (await import("./commands/fmt")).command,
    help: async () => (await import("./commands/help")).createHelp(main),
  },
  default: "help",
})

runMain(main)
