/**
 * Walking-mode voice prompt handler.
 *
 * When the user is in "walking" hands-free mode and sends audio:
 * 1. Transcribe the audio (existing Gemini transcription).
 * 2. Use Gemini Flash to decide whether to forward to the agent or respond directly.
 * 3. If responding directly, generate TTS audio via Gemini TTS and return it.
 * 4. If forwarding, call sendPrompt() in the background.
 */

import { chat } from "@tanstack/ai"
import { geminiText } from "@tanstack/ai-gemini"
import { generateSpeech } from "@tanstack/ai"
import { geminiSpeech } from "@tanstack/ai-gemini"
import type { OpencodeClient } from "./opencode"
import { mapMessage } from "./opencode"
import { transcribeAudio } from "./transcribe"
import { sendPrompt } from "./prompt"
import type { Message } from "./types"

export type VoicePromptResult =
  | { action: "forwarded" }
  | { action: "responded"; text: string; audioData: string; mimeType: string }

/**
 * Handles a voice prompt in walking mode.
 *
 * Transcribes the audio, then uses a single Gemini Flash call to decide
 * whether to forward to the agent or respond directly. If responding,
 * generates TTS audio and returns it.
 */
export async function handleVoicePrompt(
  client: OpencodeClient,
  sessionId: string,
  audioData: string,
  mimeType: string,
  directory?: string,
  model?: { providerID: string; modelID: string },
): Promise<VoicePromptResult> {
  // 1. Fetch conversation context
  let conversationContext: Message[] | undefined
  try {
    const res = await client.session.messages({ path: { id: sessionId }, query: { directory } })
    if (!res.error && res.data) {
      conversationContext = (res.data as any[]).map(mapMessage)
    }
  } catch {}

  // 2. Transcribe the audio
  const transcription = await transcribeAudio(audioData, mimeType, conversationContext)
  if (!transcription?.trim()) {
    // Nothing audible — don't do anything
    return { action: "forwarded" }
  }

  console.log(`[voice-prompt] session=${sessionId} transcription: "${transcription.slice(0, 200)}"`)

  // 3. Build context summary for the routing call
  const contextSummary = buildContextSummary(conversationContext)

  // 4. Single Gemini Flash call to route AND optionally respond
  const routingPrompt = `You are a voice assistant proxy for an AI coding agent. The user has sent a voice message (transcribed below).
Decide whether to handle the message yourself or forward it to the coding agent.

FORWARD to the agent if the user is asking it to do something, giving a new instruction, or continuing/modifying a task.
RESPOND yourself if the user is asking a question about what the agent just did, asking for a status update, or asking what changed.

If forwarding, respond with ONLY:
<forward/>

If responding, reply with:
<respond>
[your terse response here, suitable for text-to-speech — 1-3 sentences max]
</respond>

Conversation context:
${contextSummary}

User message: "${transcription}"`

  const routingResult = await chat({
    adapter: geminiText("gemini-2.5-flash"),
    messages: [{ role: "user", content: routingPrompt }],
    stream: false,
  })

  const routingText = routingResult.trim()
  console.log(`[voice-prompt] session=${sessionId} routing result: "${routingText.slice(0, 300)}"`)

  // 5. Parse the response
  if (routingText.includes("<forward")) {
    // Forward to agent
    console.log(`[voice-prompt] session=${sessionId} forwarding to agent`)
    sendPrompt(
      client,
      sessionId,
      [{ type: "text", text: transcription }],
      directory,
      model,
    ).catch((err) => {
      console.error(`[voice-prompt] session=${sessionId} sendPrompt failed:`, err)
    })
    return { action: "forwarded" }
  }

  // Extract the response text from <respond>...</respond>
  const respondMatch = routingText.match(/<respond>([\s\S]*?)<\/respond>/)
  const responseText = respondMatch?.[1]?.trim() ?? routingText.replace(/<\/?respond>/g, "").trim()

  if (!responseText) {
    // No response text — just forward
    sendPrompt(
      client,
      sessionId,
      [{ type: "text", text: transcription }],
      directory,
      model,
    ).catch((err) => {
      console.error(`[voice-prompt] session=${sessionId} sendPrompt failed:`, err)
    })
    return { action: "forwarded" }
  }

  console.log(`[voice-prompt] session=${sessionId} responding directly: "${responseText.slice(0, 200)}"`)

  // 6. Generate TTS audio
  try {
    const ttsResult = await generateSpeech({
      adapter: geminiSpeech("gemini-2.5-flash-preview-tts"),
      text: responseText,
    })

    const rawFormat = ttsResult.format || "wav"
    console.log(
      `[voice-prompt] session=${sessionId} TTS complete: format=${rawFormat}, audioLength=${ttsResult.audio?.length ?? 0} chars`,
    )

    // Gemini TTS returns raw PCM with a format string like
    // "L16;codec=pcm;rate=24000". AVAudioPlayer can't play raw PCM,
    // so wrap it in a WAV header.
    let resultAudio = ttsResult.audio
    let audioMime = `audio/${rawFormat}`
    const isRawPcm = /l16|pcm|raw/i.test(rawFormat)
    if (isRawPcm) {
      // Extract sample rate from format string (e.g. "rate=24000"), default 24kHz
      const rateMatch = rawFormat.match(/rate=(\d+)/)
      const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000
      resultAudio = wrapPcmInWav(ttsResult.audio, sampleRate, 1, 16)
      audioMime = "audio/wav"
      console.log(`[voice-prompt] session=${sessionId} wrapped raw PCM in WAV header (sampleRate=${sampleRate})`)
    }

    return {
      action: "responded",
      text: responseText,
      audioData: resultAudio,
      mimeType: audioMime,
    }
  } catch (err) {
    console.error(`[voice-prompt] session=${sessionId} TTS failed:`, err)
    // Fall back to forwarding if TTS fails
    sendPrompt(
      client,
      sessionId,
      [{ type: "text", text: transcription }],
      directory,
      model,
    ).catch(() => {})
    return { action: "forwarded" }
  }
}

/**
 * Wraps raw PCM (signed 16-bit LE) base64 audio data in a WAV container
 * so AVAudioPlayer can decode it.
 */
function wrapPcmInWav(
  pcmBase64: string,
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number,
): string {
  const pcmData = Buffer.from(pcmBase64, "base64")
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = pcmData.length

  // 44-byte WAV header
  const header = Buffer.alloc(44)
  header.write("RIFF", 0)
  header.writeUInt32LE(36 + dataSize, 4)
  header.write("WAVE", 8)
  header.write("fmt ", 12)
  header.writeUInt32LE(16, 16) // PCM subchunk size
  header.writeUInt16LE(1, 20) // PCM format
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write("data", 36)
  header.writeUInt32LE(dataSize, 40)

  return Buffer.concat([header, pcmData]).toString("base64")
}

function buildContextSummary(messages?: Message[]): string {
  if (!messages?.length) return "(no conversation history)"

  const recent = messages.slice(-10)
  return recent
    .map((m) => {
      const textParts = m.parts
        .filter((p): p is { type: "text"; id: string; text: string } => p.type === "text")
        .map((p) => p.text)
        .join(" ")
      if (!textParts) return null
      return `${m.role}: ${textParts.slice(0, 300)}`
    })
    .filter(Boolean)
    .join("\n")
}
