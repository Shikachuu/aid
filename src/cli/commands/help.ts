import { type CommandDef, defineCommand, showUsage } from "citty"

/** Build a `help` subcommand that renders root or sub-command usage via citty. */
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
        description: "Subcommand to show help for.",
      },
    },
    async run({ args }) {
      if (!args.command) {
        await showUsage(root)
        return
      }

      const subCommands =
        typeof root.subCommands === "function" ? await root.subCommands() : await root.subCommands

      const direct = subCommands?.[args.command]
      let resolved: CommandDef | undefined = direct
        ? typeof direct === "function"
          ? await direct()
          : await direct
        : undefined

      if (!resolved && subCommands) {
        for (const entry of Object.values(subCommands)) {
          const candidate = typeof entry === "function" ? await entry() : await entry
          const meta =
            typeof candidate?.meta === "function" ? await candidate.meta() : await candidate?.meta
          const aliases = meta?.alias
          const list = Array.isArray(aliases) ? aliases : aliases ? [aliases] : []
          if (list.includes(args.command)) {
            resolved = candidate
            break
          }
        }
      }

      if (!resolved) {
        console.error(`Unknown command: ${args.command}`)
        await showUsage(root)
        process.exit(1)
      }

      await showUsage(resolved, root)
    },
  })
