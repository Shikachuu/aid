import { type CommandDef, defineCommand, showUsage } from "citty"

/** Build `aid help [command]`. It takes `root` so it can load the named subcommand lazily. */
export const createHelp = (root: CommandDef) =>
  defineCommand({
    meta: {
      name: "help",
      description: "Show help for a command.",
    },
    args: {
      command: {
        type: "positional",
        required: false,
        description: "Command to show help for.",
      },
    },
    async run({ args }) {
      if (!args.command) {
        await showUsage(root)
        return
      }
      const load = (root.subCommands as Record<string, () => Promise<CommandDef>>)[args.command]
      if (!load) {
        console.error(`Unknown command: ${args.command}`)
        await showUsage(root)
        process.exit(1)
      }
      await showUsage(await load(), root)
    },
  })
