import { test, expect, describe } from "bun:test"
import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import { RawMessageSchema, MessagePartSchema, MessageInfoSchema } from "./types"

const client = createOpencodeClient({ baseUrl: "http://localhost:4096" })

describe("Zod schema validation against live API", () => {
  test("all messages from 10 sessions parse with RawMessageSchema", async () => {
    const sessionsRes = await client.session.list()
    const sessions = sessionsRes.data ?? []

    let messageCount = 0
    let partCount = 0
    const partTypes = new Set<string>()
    const toolStatuses = new Set<string>()
    const errors: string[] = []

    for (const s of sessions.slice(0, 10)) {
      const res = await client.session.messages({ sessionID: s.id })
      if (!res.data) continue

      for (const msg of res.data as any[]) {
        messageCount++
        const result = RawMessageSchema.safeParse(msg)
        if (!result.success) {
          const issues = result.error.issues.map(
            (i) => `  ${i.path.join(".")}: ${i.message}`
          )
          errors.push(
            `Message ${msg.info?.id} (${msg.info?.role}):\n${issues.join("\n")}`
          )
          // Still count parts for diagnostics
        }

        for (const part of msg.parts ?? []) {
          partCount++
          partTypes.add(part.type)
          if (part.type === "tool" && part.state) {
            toolStatuses.add(part.state.status)
          }
        }
      }
    }

    console.log(`Validated ${messageCount} messages, ${partCount} parts`)
    console.log("Part types:", [...partTypes].sort())
    console.log("Tool statuses:", [...toolStatuses].sort())

    if (errors.length > 0) {
      console.log(`\n${errors.length} validation errors (showing first 5):`)
      for (const e of errors.slice(0, 5)) {
        console.log(e)
      }
    }

    expect(errors.length).toBe(0)
    expect(messageCount).toBeGreaterThan(0)
  })

  test("every part individually validates against MessagePartSchema", async () => {
    const sessionsRes = await client.session.list()
    const sessions = sessionsRes.data ?? []

    let partCount = 0
    const failures: string[] = []

    for (const s of sessions.slice(0, 10)) {
      const res = await client.session.messages({ sessionID: s.id })
      if (!res.data) continue

      for (const msg of res.data as any[]) {
        for (const part of msg.parts ?? []) {
          partCount++
          const result = MessagePartSchema.safeParse(part)
          if (!result.success) {
            const issues = result.error.issues.map(
              (i) => `    ${i.path.join(".")}: ${i.message}`
            )
            failures.push(
              `Part ${part.id} (type=${part.type}):\n${issues.join("\n")}`
            )
          }
        }
      }
    }

    console.log(`Validated ${partCount} parts individually`)
    if (failures.length > 0) {
      console.log(`\n${failures.length} failures (showing first 10):`)
      for (const f of failures.slice(0, 10)) {
        console.log(f)
      }
    }

    expect(failures.length).toBe(0)
  })

  test("every message info validates against MessageInfoSchema", async () => {
    const sessionsRes = await client.session.list()
    const sessions = sessionsRes.data ?? []

    let count = 0
    const failures: string[] = []

    for (const s of sessions.slice(0, 10)) {
      const res = await client.session.messages({ sessionID: s.id })
      if (!res.data) continue

      for (const msg of res.data as any[]) {
        count++
        const result = MessageInfoSchema.safeParse(msg.info)
        if (!result.success) {
          const issues = result.error.issues.map(
            (i) => `    ${i.path.join(".")}: ${i.message}`
          )
          failures.push(
            `Message ${msg.info?.id} (role=${msg.info?.role}):\n${issues.join("\n")}`
          )
        }
      }
    }

    console.log(`Validated ${count} message infos`)
    if (failures.length > 0) {
      console.log(`\n${failures.length} failures (showing first 10):`)
      for (const f of failures.slice(0, 10)) {
        console.log(f)
      }
    }

    expect(failures.length).toBe(0)
  })
})
