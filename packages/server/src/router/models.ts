import { ORPCError } from "@orpc/server"
import { base } from "./base"

export const models = {
  /** List available providers and models, pre-shaped for the client. */
  list: base
    .handler(async ({ context }) => {
      try {
        const res = await context.client.provider.list()
        if (res.error) {
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: "Failed to list providers",
          })
        }

        const data = res.data as any

        // Extract connected provider IDs
        const connectedSet = new Set<string>(data.connected ?? [])

        // Flatten providers → models, filtering to connected providers only
        const models: {
          id: string
          name: string
          providerID: string
          providerName: string
          status?: string
        }[] = []

        for (const provider of data.all ?? []) {
          if (!connectedSet.has(provider.id)) continue
          for (const [modelId, model] of Object.entries(provider.models ?? {})) {
            const m = model as any
            models.push({
              id: modelId,
              name: m.name ?? modelId,
              providerID: provider.id,
              providerName: provider.name ?? provider.id,
              status: m.status,
            })
          }
        }

        const defaults: Record<string, string> = data.default ?? {}

        return { models, defaults }
      } catch (err: any) {
        if (err instanceof ORPCError) throw err
        console.error("[models.list]", err)
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: err.message ?? "Failed to list models",
        })
      }
    }),
}
