import { MODEL_FALLBACK_CHAIN, MODEL_REGISTRY, SAFE_FALLBACK_MODEL, getNextFallback } from "@/types"

/**
 * Model Orchestration System
 * Handles intelligent fallback routing, streaming, and retry logic
 */

export interface StreamOptions {
  onChunk: (chunk: string) => void
  signal: AbortSignal
  temperature?: number
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
  messages: Array<{ role: string; content: string }>,
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

      // If aborted, don't try fallback
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error
      }

      // Try next fallback
      fallbackCount++
      continue
    }
  }

  // All models failed
  throw new Error(
    `All models failed. Last error: ${lastError?.message || "Unknown error"}`
  )
}

/**
 * Stream single chat request (no fallback)
 */
async function streamChatOnce(
  messages: Array<{ role: string; content: string }>,
  modelId: string,
  options: StreamOptions
): Promise<string> {
  const model = MODEL_REGISTRY[modelId]
  if (!model) {
    throw new Error(`Model not found: ${modelId}`)
  }

  // Import the streaming function from nvidia.ts
  const { streamChat } = await import("./nvidia")

  let fullContent = ""
  let chunkCount = 0

  await streamChat(
    messages,
    modelId,
    options.temperature || 0.7,
    (chunk) => {
      if (chunk && chunk.length > 0) {
        fullContent += chunk
        options.onChunk(chunk)
        chunkCount++
      }
    },
    options.signal
  )

  // Ensure we got some response
  if (fullContent.trim().length === 0) {
    throw new Error(`Model ${modelId} returned empty response`)
  }

  return fullContent
}

/**
 * Build model chain: selected model + fallbacks, always ending with safe fallback
 */
function buildModelChain(selectedModel: string): string[] {
  const chain: string[] = [selectedModel]

  // Add fallback chain if selected model is in the primary chain
  if (MODEL_FALLBACK_CHAIN.includes(selectedModel)) {
    const index = MODEL_FALLBACK_CHAIN.indexOf(selectedModel)
    chain.push(...MODEL_FALLBACK_CHAIN.slice(index + 1))
  } else {
    // Add full fallback chain for non-primary models
    chain.push(...MODEL_FALLBACK_CHAIN)
  }

  // Always ensure safe fallback is at the end
  if (chain[chain.length - 1] !== SAFE_FALLBACK_MODEL) {
    chain.push(SAFE_FALLBACK_MODEL)
  }

  // Remove duplicates while preserving order
  return Array.from(new Set(chain))
}

/**
 * Verify model is available and healthy
 */
export async function checkModelHealth(modelId: string): Promise<boolean> {
  try {
    const model = MODEL_REGISTRY[modelId]
    if (!model) return false

    // In production, this would check API health
    // For now, just verify it's in the registry
    return true
  } catch {
    return false
  }
}

/**
 * Get recommended model based on task type
 */
export function getRecommendedModel(taskType: "reasoning" | "creative" | "fast" | "general"): string {
  const typeModels = Object.values(MODEL_REGISTRY).filter(m => m.type === taskType)

  // Return the default if available, otherwise first match
  return typeModels.find(m => m.default)?.id || typeModels[0]?.id || MODEL_FALLBACK_CHAIN[0]
}

/**
 * Get model stats for UI display
 */
export function getModelStats(modelId: string): {
  success: boolean
  name: string
  provider: string
  type: string
} {
  const model = MODEL_REGISTRY[modelId]
  return {
    success: !!model,
    name: model?.name || "Unknown",
    provider: model?.provider || "Unknown",
    type: model?.type || "unknown",
  }
}
