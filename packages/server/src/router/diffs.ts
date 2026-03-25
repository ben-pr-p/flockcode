import { ORPCError } from "@orpc/server"
import { z } from "zod/v4"
import { base } from "./base"

export const diffs = {
  /** Returns { file, before, after } for a single file in a session. */
  get: base
    .input(z.object({ session: z.string(), file: z.string() }))
    .handler(async ({ input, context }) => {
      const { session: sessionId, file } = input
      const sessionRes = await context.client.session.get({ sessionID: sessionId })
      const directory = sessionRes.data?.directory
      const res = await context.client.session.diff({ sessionID: sessionId, directory })
      if (res.error) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Failed to fetch diffs",
        })
      }
      const match = (res.data ?? []).find((d: any) => d.file === file)
      if (!match) {
        throw new ORPCError("NOT_FOUND", {
          message: `File not found: ${file}`,
        })
      }
      return { file: match.file as string, before: match.before as string, after: match.after as string }
    }),

  /** Returns all file diffs for a session. */
  list: base
    .input(z.object({ session: z.string() }))
    .handler(async ({ input, context }) => {
      const sessionRes = await context.client.session.get({ sessionID: input.session })
      const directory = sessionRes.data?.directory
      const res = await context.client.session.diff({ sessionID: input.session, directory })
      if (res.error) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Failed to fetch diffs",
        })
      }
      return (res.data ?? []).map((d: any) => ({
        file: d.file as string,
        before: d.before as string,
        after: d.after as string,
      }))
    }),
}
