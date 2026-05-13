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
  base64?: string      // base64 data URL for images (for API transmission)
  fileText?: string    // extracted text content (for text/PDF files)
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

// Official NVIDIA NIM API compatible model registry (verified May 2026)
const META_LLAMA_MODELS: ModelConfig[] = [
  {
    id: "meta/llama-3.3-70b-instruct",
    name: "Llama 3.3 70B",
    provider: "Meta",
    type: "reasoning",
    size: "70B",
    description: "أحدث نموذج Llama للمحادثات المتقدمة",
    badges: ["reasoning", "premium"],
    default: true,
  },
  {
    id: "meta/llama-3.1-405b-instruct",
    name: "Llama 3.1 405B",
    provider: "Meta",
    type: "premium",
    size: "405B",
    description: "أقوى نموذج مفتوح المصدر",
    badges: ["premium", "powerful"],
  },
  {
    id: "meta/llama-3.1-70b-instruct",
    name: "Llama 3.1 70B",
    provider: "Meta",
    type: "general",
    size: "70B",
    description: "نموذج متعدد الاستخدامات وموثوق",
    badges: ["general"],
  },
  {
    id: "meta/llama-3.1-8b-instruct",
    name: "Llama 3.1 8B",
    provider: "Meta",
    type: "fast",
    size: "8B",
    description: "سريع وخفيف للمهام البسيطة",
    badges: ["fast"],
  },
]

const NVIDIA_MODELS_LIST: ModelConfig[] = [
  {
    id: "nvidia/nemotron-3-super-120b-a12b",
    name: "Nemotron 3 Super",
    provider: "NVIDIA",
    type: "reasoning",
    size: "120B MoE",
    description: "نموذج هجين مع سياق 1M للتفكير العميق",
    badges: ["reasoning", "agentic"],
  },
  {
    id: "nvidia/llama-3.1-nemotron-70b-instruct",
    name: "Nemotron 70B",
    provider: "NVIDIA",
    type: "chat",
    size: "70B",
    description: "محسن بواسطة NVIDIA للمحادثات",
    badges: ["chat", "nvidia"],
  },
]

const GOOGLE_MICROSOFT_MODELS: ModelConfig[] = [
  {
    id: "google/gemma-4-31b-it",
    name: "Gemma 4",
    provider: "Google",
    type: "reasoning",
    size: "31B",
    description: "أحدث نموذج Gemma للبرمجة والتفكير",
    badges: ["reasoning", "agentic"],
  },
  {
    id: "google/gemma-3-27b-it",
    name: "Gemma 3",
    provider: "Google",
    type: "general",
    size: "27B",
    description: "نموذج عام فعال ومتوازن",
    badges: ["general"],
  },
  {
    id: "microsoft/phi-4",
    name: "Phi 4",
    provider: "Microsoft",
    type: "reasoning",
    size: "14B",
    description: "تفكير متقدم بحجم صغير",
    badges: ["reasoning", "efficient"],
  },
]

const MISTRAL_DEEPSEEK_MODELS: ModelConfig[] = [
  {
    id: "mistralai/mistral-large-2-instruct",
    name: "Mistral Large 2",
    provider: "Mistral",
    type: "creative",
    size: "123B",
    description: "إبداعي ومتعدد اللغات",
    badges: ["creative", "multilingual"],
  },
  {
    id: "mistralai/mixtral-8x22b-instruct-v0.1",
    name: "Mixtral 8x22B",
    provider: "Mistral",
    type: "reasoning",
    size: "141B MoE",
    description: "خبراء متعددون للتفكير",
    badges: ["reasoning"],
  },
  {
    id: "deepseek-ai/deepseek-r1",
    name: "DeepSeek R1",
    provider: "DeepSeek",
    type: "thinking",
    size: "671B",
    description: "تفكير عميق ودعم عربي ممتاز",
    badges: ["thinking", "multilingual"],
  },
  {
    id: "deepseek-ai/deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    provider: "DeepSeek",
    type: "premium",
    size: "MoE",
    context: "1M",
    description: "سياق مليون token للمهام المعقدة",
    badges: ["premium", "coding"],
  },
]

// Unified model registry
const ALL_MODELS: ModelConfig[] = [
  ...META_LLAMA_MODELS,
  ...NVIDIA_MODELS_LIST,
  ...GOOGLE_MICROSOFT_MODELS,
  ...MISTRAL_DEEPSEEK_MODELS,
]

// Fallback chain for resilience (verified NVIDIA NIM models)
export const MODEL_FALLBACK_CHAIN = [
  "meta/llama-3.3-70b-instruct",              // Primary (stable)
  "google/gemma-3-27b-it",                    // Fallback 1 (reliable)
  "meta/llama-3.1-70b-instruct",              // Fallback 2 (always available)
  "meta/llama-3.1-8b-instruct",               // Fallback 3 (lightweight)
]

// Default model (primary - verified available)
export const DEFAULT_MODEL = "meta/llama-3.3-70b-instruct"

// Safe fallback model (always available on NVIDIA NIM)
export const SAFE_FALLBACK_MODEL = "meta/llama-3.1-8b-instruct"

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
