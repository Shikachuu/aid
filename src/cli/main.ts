import { type ArgsDef, type CommandDef, defineCommand } from "citty"
import { version } from "../../package.json"

const isUserFacingError = (err: unknown): err is Error =>
  err instanceof Error && err.message.startsWith("aid:")

const withAidErrors =
  <T extends ArgsDef>(load: () => Promise<CommandDef<T>>) =>
  async (): Promise<CommandDef<T>> => {
    const cmd = await load()
    const { run } = cmd
    if (run === undefined) {
      return cmd
    }
    return {
      ...cmd,
      async run(ctx) {
        try {
          await run(ctx)
        } catch (err) {
          if (isUserFacingError(err)) {
            console.error(err.message)
            process.exit(1)
          }
          throw err
        }
      },
    }
  }

/** Root `aid` command. Importable without running it, so scripts can read every subcommand definition. */
export const main: CommandDef = defineCommand({
  meta: {
    name: "aid",
    version,
    description: "Single-binary documentation generator for markdown, HTML, OpenAPI, and Protobuf.",
  },
  subCommands: {
    init: withAidErrors(async () => (await import("./commands/init")).command),
    dev: withAidErrors(async () => (await import("./commands/dev")).command),
    build: withAidErrors(async () => (await import("./commands/build")).command),
    lint: withAidErrors(async () => (await import("./commands/lint")).command),
    fmt: withAidErrors(async () => (await import("./commands/fmt")).command),
    help: async () => (await import("./commands/help")).createHelp(main),
  },
  default: "help",
})
