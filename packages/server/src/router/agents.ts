import { ORPCError } from "@orpc/server"
import { base } from "./base"

export const agents = {
  /** List available agents, pre-shaped for the client. */
  list: base
    .handler(async ({ context }) => {
      try {
        const res = await (context.client.app as any).agents()
        if (res.error) {
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: "Failed to list agents",
          })
        }

        const data = res.data as any

        const agents: {
          name: string
          description?: string
          mode: string
          color?: string
        }[] = []

        if (data && typeof data === "object") {
          if (Array.isArray(data)) {
            for (const agent of data) {
              agents.push({
                name: agent.name ?? "",
                description: agent.description,
                mode: agent.mode ?? "primary",
                color: agent.color,
              })
            }
          } else {
            for (const [key, value] of Object.entries(data)) {
              const agent = value as any
              agents.push({
                name: agent.name ?? key,
                description: agent.description,
                mode: agent.mode ?? "primary",
                color: agent.color,
              })
            }
          }
        }

        return agents
      } catch (err: any) {
        if (err instanceof ORPCError) throw err
        console.error("[agents.list]", err)
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: err.message ?? "Failed to list agents",
        })
      }
    }),
}
