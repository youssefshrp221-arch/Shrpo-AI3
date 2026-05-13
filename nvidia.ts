const EDGE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nvidia-chat`
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string | ContentPart[]
}

export interface ContentPart {
  type: "text" | "image_url"
  text?: string
  image_url?: { url: string }
}

const VISION_MODELS = [
  "meta/llama-3.2-90b-vision-instruct",
  "meta/llama-3.2-11b-vision-instruct",
]

export function isVisionModel(modelId: string): boolean {
  return VISION_MODELS.includes(modelId)
}

export function getVisionModel(): string {
  return "meta/llama-3.2-90b-vision-instruct"
}

const NEMOTRON_MODELS = new Set([
  "nvidia/llama-3.3-nemotron-super-49b-v1.5",
  "nvidia/llama-3.1-nemotron-70b-instruct",
])

/**
 * Convert image file to base64 content part
 */
export async function fileToBase64ContentPart(file: File): Promise<ContentPart> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      resolve({
        type: "image_url",
        image_url: { url: base64 },
      })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Extract text from a text/PDF file (basic text extraction)
 */
export async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === "text/plain" || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
    return await file.text()
  }
  // For PDFs and other files, return a placeholder - full PDF parsing needs a library
  return `[Attached file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]`
}

/**
 * Build API messages with multimodal support
 */
export function buildApiMessages(
  messages: ChatMessage[],
  systemPrompt?: string
): ChatMessage[] {
  const result: ChatMessage[] = []
  if (systemPrompt) {
    result.push({ role: "user", content: systemPrompt })
    result.push({ role: "assistant", content: "مفهوم، أنا مستعد." })
  }
  return [...result, ...messages]
}

export async function streamChat(
  messages: ChatMessage[],
  model: string,
  temperature: number,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<void> {
  try {
    const response = await fetch(EDGE_FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ANON_KEY}`,
        Apikey: ANON_KEY,
      },
      body: JSON.stringify({ messages, model, temperature, stream: true }),
      signal,
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Network error" }))
      throw new Error(err.error || `Error ${response.status}`)
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    let chunkCount = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // Process complete lines only
      const lines = buffer.split("\n")
      // Keep the last incomplete line in buffer
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === "data: [DONE]") continue
        if (trimmed.startsWith("data: ")) {
          try {
            const json = JSON.parse(trimmed.slice(6))
            const delta = json?.choices?.[0]?.delta?.content
            if (delta && typeof delta === "string" && delta.length > 0) {
              onChunk(delta)
              chunkCount++
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    }

    // Process any remaining buffer content
    if (buffer.trim() && buffer.trim() !== "data: [DONE]") {
      const trimmed = buffer.trim()
      if (trimmed.startsWith("data: ")) {
        try {
          const json = JSON.parse(trimmed.slice(6))
          const delta = json?.choices?.[0]?.delta?.content
          if (delta && typeof delta === "string" && delta.length > 0) {
            onChunk(delta)
            chunkCount++
          }
        } catch {}
      }
    }

    if (chunkCount === 0 && NEMOTRON_MODELS.has(model)) {
      throw new Error("Empty stream response - falling back to non-stream mode")
    }
  } catch (error) {
    if (NEMOTRON_MODELS.has(model) && !(error instanceof DOMException && error.name === "AbortError")) {
      console.log(`Streaming failed for ${model}, trying non-stream mode...`)
      const fullContent = await chatOnce(messages, model, temperature)
      const chunkSize = 50
      for (let i = 0; i < fullContent.length; i += chunkSize) {
        onChunk(fullContent.slice(i, i + chunkSize))
      }
      return
    }
    throw error
  }
}

export async function chatOnce(
  messages: ChatMessage[],
  model: string,
  temperature: number
): Promise<string> {
  const response = await fetch(EDGE_FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
      Apikey: ANON_KEY,
    },
    body: JSON.stringify({ messages, model, temperature, stream: false }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Network error" }))
    throw new Error(err.error || `Error ${response.status}`)
  }

  const data = await response.json()
  return data?.choices?.[0]?.message?.content || ""
}
