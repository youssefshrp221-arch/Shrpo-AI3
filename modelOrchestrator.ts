import { MODEL_FALLBACK_CHAIN, MODEL_REGISTRY, SAFE_FALLBACK_MODEL } from "./index"

export interface StreamOptions {
  onChunk: (chunk: string) => void
  signal: AbortSignal
  temperature?: number
  apiKey: string
}

export interface StreamResult {
  fullContent: string
  modelUsed: string
  success: boolean
  fallbackCount: number
}

/**
 * Stream chat with intelligent fallback routing
 */
export async function streamChatWithFallback(
  messages: Array<{ role: string; content: any }>,
  selectedModel: string,
  options: StreamOptions
): Promise<StreamResult> {
  const modelChain = buildModelChain(selectedModel)
  let lastError: Error | null = null
  let fallbackCount = 0

  for (const modelId of modelChain) {
    if (options.signal.aborted) {
      throw new DOMException("Aborted", "AbortError")
    }

    try {
      const result = await streamChatOnce(messages, modelId, options)
      return {
        fullContent: result,
        modelUsed: modelId,
        success: true,
        fallbackCount,
      }
    } catch (error) {
      lastError = error as Error

      if (error instanceof DOMException && error.name === "AbortError") {
        throw error
      }

      // Try next model in fallback chain
      fallbackCount++
      continue
    }
  }

  throw new Error(`All models failed. Last error: ${lastError?.message || "Unknown error"}`)
}

async function streamChatOnce(
  messages: Array<{ role: string; content: any }>,
  modelId: string,
  options: StreamOptions
): Promise<string> {
  const { streamChat } = await import("./nvidia")

  let fullContent = ""

  await streamChat(
    messages as any,
    modelId,
    options.temperature ?? 0.7,
    (chunk) => {
      if (chunk && chunk.length > 0) {
        fullContent += chunk
        options.onChunk(chunk)
      }
    },
    options.signal,
    options.apiKey
  )

  if (fullContent.trim().length === 0) {
    throw new Error(`Model ${modelId} returned empty response`)
  }

  return fullContent
}

function buildModelChain(selectedModel: string): string[] {
  const chain: string[] = [selectedModel]

  if (MODEL_FALLBACK_CHAIN.includes(selectedModel)) {
    const index = MODEL_FALLBACK_CHAIN.indexOf(selectedModel)
    chain.push(...MODEL_FALLBACK_CHAIN.slice(index + 1))
  } else {
    chain.push(...MODEL_FALLBACK_CHAIN)
  }

  if (chain[chain.length - 1] !== SAFE_FALLBACK_MODEL) {
    chain.push(SAFE_FALLBACK_MODEL)
  }

  return Array.from(new Set(chain))
}

export async function checkModelHealth(modelId: string): Promise<boolean> {
  return !!MODEL_REGISTRY[modelId]
}

export function getRecommendedModel(taskType: "reasoning" | "creative" | "fast" | "general"): string {
  const typeModels = Object.values(MODEL_REGISTRY).filter(m => m.type === taskType)
  return typeModels.find(m => m.default)?.id || typeModels[0]?.id || MODEL_FALLBACK_CHAIN[0]
}

export function getModelStats(modelId: string) {
  const model = MODEL_REGISTRY[modelId]
  return {
    success: !!model,
    name: model?.name || "Unknown",
    provider: model?.provider || "Unknown",
    type: model?.type || "unknown",
  }
}
