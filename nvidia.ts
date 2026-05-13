const EDGE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nvidia-chat`
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

// Nemotron models that may need fallback to non-stream
const NEMOTRON_MODELS = new Set([
  "nvidia/llama-3.3-nemotron-super-49b-v1.5",
  "nvidia/llama-3.1-nemotron-70b-instruct",
])

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
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === "data: [DONE]") continue
        if (trimmed.startsWith("data: ")) {
          try {
            const json = JSON.parse(trimmed.slice(6))
            const delta = json?.choices?.[0]?.delta?.content
            if (delta) {
              onChunk(delta)
              chunkCount++
            }
          } catch {}
        }
      }
    }

    // If no chunks received, stream may have failed
    if (chunkCount === 0 && NEMOTRON_MODELS.has(model)) {
      throw new Error("Empty stream response - falling back to non-stream mode")
    }
  } catch (error) {
    // If streaming fails for Nemotron models, try non-stream approach
    if (NEMOTRON_MODELS.has(model) && !(error instanceof Error && error.message.includes("AbortError"))) {
      console.log(`Streaming failed for ${model}, trying non-stream mode...`)
      const fullContent = await chatOnce(messages, model, temperature)
      // Emit the full content in chunks for consistent UX
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
