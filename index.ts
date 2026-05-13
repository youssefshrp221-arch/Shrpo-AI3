export interface Chat {
  id: string
  title: string
  pinned: boolean
  model: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  chat_id: string
  role: "user" | "assistant" | "system"
  content: string
  model?: string
  tokens?: number
  attachments?: Attachment[]
  thinking?: string
  created_at: string
}

export interface Attachment {
  id: string
  type: "image" | "pdf" | "audio" | "video" | "file"
  name: string
  url: string
  size?: number
  preview?: string
}

export interface WritingProject {
  id: string
  title: string
  genre: string
  summary: string
  word_count: number
  created_at: string
  updated_at: string
}

export interface Chapter {
  id: string
  project_id: string
  title: string
  content: string
  chapter_order: number
  summary: string
  word_count: number
  created_at: string
  updated_at: string
}

export interface Character {
  id: string
  project_id: string
  name: string
  description: string
  traits: string[]
  backstory: string
  role: string
  created_at: string
}

export interface WorldEntry {
  id: string
  project_id: string
  category: string
  title: string
  content: string
  created_at: string
}

export interface AppSettings {
  temperature: number
  systemPrompt: string
  memoryEnabled: boolean
  fontSize: string
  theme: string
  ttsEnabled: boolean
  sttEnabled: boolean
}

// Model configuration with full metadata
export interface ModelConfig {
  id: string
  name: string
  provider: "Meta" | "NVIDIA" | "Google" | "Microsoft" | "Mistral" | "DeepSeek"
  type: "reasoning" | "general" | "premium" | "chat" | "fast" | "ultra" | "creative" | "precision" | "thinking"
  size: string
  context?: string
  description: string
  badges?: string[]
  default?: boolean
  fallbacks?: string[]
}

// Official NVIDIA-compatible model registry
const META_LLAMA_MODELS: ModelConfig[] = [
  {
    id: "meta/llama-4-maverick-17b-128e-instruct",
    name: "Llama 4 Maverick",
    provider: "Meta",
    type: "reasoning",
    size: "17B",
    context: "128K",
    description: "Advanced reasoning with extended context",
    badges: ["reasoning", "premium"],
    default: true,
  },
  {
    id: "meta/llama-3.3-70b-instruct",
    name: "Llama 3.3",
    provider: "Meta",
    type: "general",
    size: "70B",
    description: "Balanced general-purpose model",
    badges: ["general"],
  },
  {
    id: "meta/llama-3.1-405b-instruct",
    name: "Llama 3.1 405B",
    provider: "Meta",
    type: "premium",
    size: "405B",
    description: "Most powerful open model",
    badges: ["premium", "powerful"],
  },
  {
    id: "meta/llama-3.1-70b-instruct",
    name: "Llama 3.1 70B",
    provider: "Meta",
    type: "general",
    size: "70B",
    description: "Versatile and reliable",
    badges: ["general"],
  },
]

const NVIDIA_MODELS_LIST: ModelConfig[] = [
  {
    id: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    name: "Nemotron Super",
    provider: "NVIDIA",
    type: "reasoning",
    size: "49B",
    description: "Advanced reasoning with NVIDIA optimization",
    badges: ["reasoning", "nvidia"],
  },
  {
    id: "nvidia/llama-3.1-nemotron-70b-instruct",
    name: "Nemotron 70B",
    provider: "NVIDIA",
    type: "chat",
    size: "70B",
    description: "NVIDIA-optimized chat model",
    badges: ["chat", "nvidia"],
  },
  {
    id: "nvidia/nemotron-3-8b-chat",
    name: "Nemotron 3 8B",
    provider: "NVIDIA",
    type: "fast",
    size: "8B",
    description: "Fast and responsive",
    badges: ["fast"],
  },
  {
    id: "nvidia/nemotron-4-340b-instruct",
    name: "Nemotron 4 340B",
    provider: "NVIDIA",
    type: "ultra",
    size: "340B",
    description: "Ultra-powerful model",
    badges: ["ultra", "powerful"],
  },
]

const GOOGLE_MICROSOFT_MODELS: ModelConfig[] = [
  {
    id: "google/gemma-3-27b-it",
    name: "Gemma 3",
    provider: "Google",
    type: "general",
    size: "27B",
    description: "Efficient general-purpose model",
    badges: ["general"],
  },
  {
    id: "google/gemma-2-9b-it",
    name: "Gemma 2 9B",
    provider: "Google",
    type: "fast",
    size: "9B",
    description: "Fast and lightweight",
    badges: ["fast"],
  },
  {
    id: "microsoft/phi-3.5-moe-instruct",
    name: "Phi 3.5 MoE",
    provider: "Microsoft",
    type: "reasoning",
    size: "MoE",
    description: "Mixture of experts reasoning",
    badges: ["reasoning"],
  },
  {
    id: "microsoft/phi-3-mini-128k-instruct",
    name: "Phi 3 Mini",
    provider: "Microsoft",
    type: "fast",
    size: "3.8B",
    description: "Compact with extended context",
    badges: ["fast"],
  },
]

const MISTRAL_DEEPSEEK_MODELS: ModelConfig[] = [
  {
    id: "mistralai/mistral-large-2-instruct",
    name: "Mistral Large 2",
    provider: "Mistral",
    type: "creative",
    size: "40B",
    description: "Creative and expressive",
    badges: ["creative"],
  },
  {
    id: "mistralai/mistral-nemo-12b-instruct",
    name: "Mistral NeMo",
    provider: "Mistral",
    type: "creative",
    size: "12B",
    description: "Efficient creative writing",
    badges: ["creative", "fast"],
  },
  {
    id: "mistralai/mixtral-8x22b-instruct-v0.1",
    name: "Mixtral 8x22B",
    provider: "Mistral",
    type: "reasoning",
    size: "141B (8x22B)",
    description: "Expert routing reasoning",
    badges: ["reasoning"],
  },
  {
    id: "deepseek-ai/deepseek-v3",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    type: "precision",
    size: "685B",
    description: "Multilingual precision and Arabic mastery",
    badges: ["precision", "multilingual"],
  },
  {
    id: "deepseek-ai/deepseek-r1",
    name: "DeepSeek R1",
    provider: "DeepSeek",
    type: "thinking",
    size: "671B",
    description: "Extended thinking for complex problems",
    badges: ["thinking"],
  },
]

// Unified model registry
const ALL_MODELS: ModelConfig[] = [
  ...META_LLAMA_MODELS,
  ...NVIDIA_MODELS_LIST,
  ...GOOGLE_MICROSOFT_MODELS,
  ...MISTRAL_DEEPSEEK_MODELS,
]

// Fallback chain for resilience
export const MODEL_FALLBACK_CHAIN = [
  "meta/llama-4-maverick-17b-128e-instruct", // Primary
  "meta/llama-3.3-70b-instruct",              // Fallback 1
  "meta/llama-3.1-405b-instruct",             // Fallback 2
  "meta/llama-3.1-70b-instruct",              // Fallback 3 (safe default)
]

// Default model (primary)
export const DEFAULT_MODEL = "meta/llama-4-maverick-17b-128e-instruct"

// Safe fallback model (always available)
export const SAFE_FALLBACK_MODEL = "meta/llama-3.1-70b-instruct"

// Narrative Engine System Prompt
export const SHRPO_NARRATIVE_PROMPT = `You are now "Shrpo Ultra" - A cinematic narrative intelligence system combining:
- The myth-building intelligence of Llama 4
- The emotional prose of Mistral Large
- The Arabic precision and dialogue mastery of DeepSeek
- The narrative continuity and pacing of Llama 3.3

When writing stories:
- Create immersive atmosphere and world-building
- Write emotionally rich, cinematic prose
- Maintain deep character continuity across scenes
- Build layered, complex characters with depth
- Avoid generic dialogue - make conversations memorable
- Produce visually cinematic scenes with sensory details
- Maintain elegant Arabic writing quality where applicable
- Generate long, coherent chapters (1000+ words minimum)
- Use vivid metaphors and poetic language
- Balance action, dialogue, and introspection perfectly

Your prose should feel like reading a literary novel, not an AI generation.`

// LaTeX Math Instructions (appended to all system prompts)
export const LATEX_MATH_INSTRUCTIONS = `

IMPORTANT - LaTeX Math Formatting:
- ALWAYS use LaTeX notation for any mathematical content, equations, formulas, powers, roots, fractions, or symbols.
- Inline math: wrap with single dollar signs like $E=mc^2$ or $\sqrt{x^2+y^2}$
- Block/display math: wrap with double dollar signs like $$\frac{a}{b}$$ or $$\sum_{i=1}^{n} x_i$$
- Powers: use ^ like $x^2$, $2^{10}$
- Roots: use \sqrt like $\sqrt{x}$, $\sqrt[3]{8}$
- Fractions: use \frac like $\frac{numerator}{denominator}$
- Greek letters: $\alpha$, $\beta$, $\pi$, $\theta$, $\omega$
- NEVER write math as plain text like "x^2" or "sqrt(x)" - always use LaTeX.
- This ensures beautiful, professional mathematical rendering for the user.`

// Default chat system prompt
export const DEFAULT_SYSTEM_PROMPT = `أنت مساعد ذكي اسمك Shrpo AI. تقوم بمساعدة المستخدم في جميع المجالات بذكاء واحترافية.${LATEX_MATH_INSTRUCTIONS}`

// Export models for UI
export const NVIDIA_MODELS = ALL_MODELS
export const MODEL_REGISTRY: Record<string, ModelConfig> = Object.fromEntries(
  ALL_MODELS.map(m => [m.id, m])
)

// Get model by ID
export function getModel(id: string): ModelConfig | undefined {
  return MODEL_REGISTRY[id]
}

// Get next fallback model
export function getNextFallback(currentModelId: string): string | undefined {
  const currentIndex = MODEL_FALLBACK_CHAIN.indexOf(currentModelId)
  return currentIndex >= 0 && currentIndex < MODEL_FALLBACK_CHAIN.length - 1
    ? MODEL_FALLBACK_CHAIN[currentIndex + 1]
    : undefined
}

// Group models by provider
export function getModelsByProvider(provider: ModelConfig['provider']): ModelConfig[] {
  return ALL_MODELS.filter(m => m.provider === provider)
}