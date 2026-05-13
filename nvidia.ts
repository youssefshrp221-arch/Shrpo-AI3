// Proxied through Vite dev server to avoid CORS — see vite.config.ts server.proxy
const NVIDIA_BASE_URL = "/api/chat"

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

/**
 * Convert image file to base64 content part
 */
export async function fileToBase64ContentPart(file: File): Promise<ContentPart> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve({ type: "image_url", image_url: { url: reader.result as string } })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Extract text from a text file
 */
export async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === "text/plain" || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
    return await file.text()
  }
  return `[Attached file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]`
}

/**
 * Stream chat — calls NVIDIA NIM API directly from the browser
 */
export async function streamChat(
  messages: ChatMessage[],
  model: string,
  temperature: number,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  apiKey?: string
): Promise<void> {
  if (!apiKey) throw new Error("NVIDIA API key is required")

  const response = await fetch(NVIDIA_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: Math.min(Math.max(temperature, 0), 1),
      max_tokens: 4096,
      stream: true,
    }),
    signal,
  })

  if (!response.ok) {
    let errMsg = `HTTP ${response.status}`
    try {
      const errBody = await response.json()
      errMsg = errBody?.detail || errBody?.message || errBody?.error || errMsg
    } catch {}
    throw new Error(errMsg)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // Process complete lines only
    const lines = buffer.split("\n")
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
          }
        } catch {
          // skip malformed JSON lines
        }
      }
    }
  }

  // Flush remaining buffer
  if (buffer.trim() && buffer.trim() !== "data: [DONE]" && buffer.trim().startsWith("data: ")) {
    try {
      const json = JSON.parse(buffer.trim().slice(6))
      const delta = json?.choices?.[0]?.delta?.content
      if (delta && typeof delta === "string") onChunk(delta)
    } catch {}
  }
}

/**
 * Non-streaming chat — calls NVIDIA NIM API directly
 */
export async function chatOnce(
  messages: ChatMessage[],
  model: string,
  temperature: number,
  apiKey?: string
): Promise<string> {
  if (!apiKey) throw new Error("NVIDIA API key is required")

  const response = await fetch(NVIDIA_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: Math.min(Math.max(temperature, 0), 1),
      max_tokens: 4096,
      stream: false,
    }),
  })

  if (!response.ok) {
    let errMsg = `HTTP ${response.status}`
    try {
      const errBody = await response.json()
      errMsg = errBody?.detail || errBody?.message || errBody?.error || errMsg
    } catch {}
    throw new Error(errMsg)
  }

  const data = await response.json()
  return data?.choices?.[0]?.message?.content || ""
}
