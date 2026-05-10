#!/usr/bin/env bun
import { type CommandDef, defineCommand, runMain } from "citty"

const main: CommandDef = defineCommand({
  meta: {
    name: "aid",
    version: "0.0.0",
    description: "Single-binary documentation generator for markdown, HTML, OpenAPI, and Protobuf.",
  },
  subCommands: {
    init: () => import("./commands/init").then((m) => m.command),
    dev: () => import("./commands/dev").then((m) => m.command),
    build: () => import("./commands/build").then((m) => m.command),
    lint: () => import("./commands/lint").then((m) => m.command),
    fmt: () => import("./commands/fmt").then((m) => m.command),
    help: () => import("./commands/help").then((m) => m.createHelp(main)),
  },
  default: "help",
})

runMain(main)
