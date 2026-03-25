import { ORPCError } from "@orpc/server"
import { base } from "./base"

export const commands = {
  /** List available commands, pre-shaped for the client. */
  list: base
    .handler(async ({ context }) => {
      try {
        const res = await (context.client.command as any).list()
        if (res.error) {
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: "Failed to list commands",
          })
        }

        const data = res.data as any

        const commands: {
          name: string
          description?: string
          agent?: string
          template: string
        }[] = []

        if (data && typeof data === "object") {
          if (Array.isArray(data)) {
            for (const cmd of data) {
              commands.push({
                name: cmd.name ?? "",
                description: cmd.description,
                agent: cmd.agent,
                template: cmd.template ?? "",
              })
            }
          } else {
            for (const [key, value] of Object.entries(data)) {
              const cmd = value as any
              commands.push({
                name: cmd.name ?? key,
                description: cmd.description,
                agent: cmd.agent,
                template: cmd.template ?? "",
              })
            }
          }
        }

        return commands
      } catch (err: any) {
        if (err instanceof ORPCError) throw err
        console.error("[commands.list]", err)
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: err.message ?? "Failed to list commands",
        })
      }
    }),
}
