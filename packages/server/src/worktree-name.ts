import { chat } from "@tanstack/ai"
import { geminiText } from "@tanstack/ai-gemini"
import { env } from "./env"

const SYSTEM_PROMPT = `\
You are a git branch name generator for a coding assistant.

Given a description of a coding task, generate a concise kebab-case slug (3-6 words) that describes the task.

Rules:
- Output ONLY the slug, nothing else — no explanation, no punctuation, no quotes
- Use lowercase letters, numbers, and hyphens only
- 3-6 words separated by hyphens
- Be specific and descriptive about the task
- Do not include words like "task", "feature", "branch", "worktree", "implement", "add", "fix" unless they are truly essential to the meaning

Examples:
  "Add a button to the home screen for settings" -> home-screen-settings-button
  "Fix the login bug where users can't sign in" -> login-sign-in-bug-fix
  "Refactor the database connection pooling logic" -> database-connection-pool-refactor
  "Update the user profile page to show avatars" -> user-profile-avatar-display`

/**
 * Generate a descriptive kebab-case slug for a worktree branch name using Gemini.
 *
 * @param promptText The user's initial prompt text describing the coding task.
 * @returns A 3-6 word kebab-case slug, e.g. `"home-screen-settings-button"`.
 * @throws If `GEMINI_API_KEY` is not set or the Gemini API call fails.
 */
export async function generateWorktreeSlug(promptText: string): Promise<string> {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set — cannot generate worktree name")
  }

  const result = await chat({
    adapter: geminiText("gemini-3-flash-preview"),
    systemPrompts: [SYSTEM_PROMPT],
    messages: [
      {
        role: "user",
        content: promptText,
      },
    ],
    stream: false,
  })

  // Sanitize: lowercase, strip anything not [a-z0-9-], collapse repeated hyphens,
  // trim leading/trailing hyphens, truncate to 60 chars
  const slug = result
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)

  if (!slug) {
    throw new Error("Gemini returned an empty slug for worktree name generation")
  }

  return slug
}
