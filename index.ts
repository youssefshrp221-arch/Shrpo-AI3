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
  provider: "Meta" | "NVIDIA" | "Google" | "Microsoft" | "Mistral" | "DeepSeek" | "Qwen" | "MoonshotAI" | "OpenAI" | "Minimax" | "ByteDance" | "StepFun" | "Stockmark" | "AbacusAI" | "Sarvam" | "ZAI"
  type: "reasoning" | "general" | "premium" | "chat" | "fast" | "ultra" | "creative" | "precision" | "thinking" | "vision" | "coding"
  size: string
  context?: string
  description: string
  badges?: string[]
  default?: boolean
  fallbacks?: string[]
}

// Official NVIDIA NIM API compatible model registry (May 2026)
const ALL_MODELS: ModelConfig[] = [
  // ── MoonshotAI ──────────────────────────────────────────────────────────────
  {
    id: "moonshotai/kimi-k2.6",
    name: "Kimi K2.6",
    provider: "MoonshotAI",
    type: "reasoning",
    size: "K2.6",
    description: "نموذج Kimi K2.6 المتقدم من MoonshotAI",
    badges: ["reasoning", "new"],
  },

  // ── Mistral ──────────────────────────────────────────────────────────────────
  {
    id: "mistralai/mistral-medium-3.5-128b",
    name: "Mistral Medium 3.5 128B",
    provider: "Mistral",
    type: "premium",
    size: "128B",
    description: "نموذج Mistral Medium المتقدم بسياق 128K",
    badges: ["premium", "new"],
  },
  {
    id: "mistralai/mistral-large-3-675b-instruct-2512",
    name: "Mistral Large 3 675B",
    provider: "Mistral",
    type: "ultra",
    size: "675B",
    description: "أقوى نموذج من Mistral للمهام الصعبة",
    badges: ["ultra", "powerful"],
  },
  {
    id: "mistralai/mistral-14b-instruct-2512",
    name: "Mistral 14B",
    provider: "Mistral",
    type: "general",
    size: "14B",
    description: "نموذج Mistral 14B متوازن للاستخدام العام",
    badges: ["general"],
  },
  {
    id: "mistralai/magistral-small-2506",
    name: "Magistral Small",
    provider: "Mistral",
    type: "fast",
    size: "Small",
    description: "نموذج Magistral صغير وسريع",
    badges: ["fast", "new"],
  },
  {
    id: "mistralai/mistral-nemotron",
    name: "Mistral Nemotron",
    provider: "Mistral",
    type: "chat",
    size: "-",
    description: "Mistral محسّن بتقنية NVIDIA Nemotron",
    badges: ["chat"],
  },
  {
    id: "mistralai/mistral-medium-3-instruct",
    name: "Mistral Medium 3",
    provider: "Mistral",
    type: "general",
    size: "Medium",
    description: "نموذج Mistral Medium 3 للمهام المتنوعة",
    badges: ["general"],
  },
  {
    id: "mistralai/mistral-small-4-11b-2603",
    name: "Mistral Small 4 11B",
    provider: "Mistral",
    type: "fast",
    size: "11B",
    description: "نموذج Mistral صغير وسريع وكفء",
    badges: ["fast", "efficient"],
  },
  {
    id: "mistralai/mistral-7b-instruct-v0.3",
    name: "Mistral 7B v0.3",
    provider: "Mistral",
    type: "fast",
    size: "7B",
    description: "نموذج Mistral 7B خفيف وسريع",
    badges: ["fast"],
  },
  {
    id: "mistralai/mixtral-8x22b-instruct-v0.1",
    name: "Mixtral 8x22B",
    provider: "Mistral",
    type: "reasoning",
    size: "141B MoE",
    description: "خبراء متعددون للتفكير المتقدم",
    badges: ["reasoning", "powerful"],
  },
  {
    id: "mistralai/mixtral-8x7b-instruct-v0.1",
    name: "Mixtral 8x7B",
    provider: "Mistral",
    type: "reasoning",
    size: "47B MoE",
    description: "نموذج محسّن للاستدلال والتحليل",
    badges: ["reasoning"],
  },

  // ── NVIDIA ───────────────────────────────────────────────────────────────────
  {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    name: "Nemotron 3 Nano Omni 30B Reasoning",
    provider: "NVIDIA",
    type: "reasoning",
    size: "30B",
    description: "نموذج Nemotron Nano Omni للاستدلال المتقدم",
    badges: ["reasoning", "new"],
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b",
    name: "Nemotron 3 Super 120B",
    provider: "NVIDIA",
    type: "ultra",
    size: "120B",
    description: "نموذج Nemotron 3 Super الضخم",
    badges: ["ultra", "powerful"],
  },
  {
    id: "nvidia/nemotron-3-nano-30b-a3b",
    name: "Nemotron 3 Nano 30B",
    provider: "NVIDIA",
    type: "fast",
    size: "30B",
    description: "نموذج Nemotron 3 Nano سريع وكفء",
    badges: ["fast"],
  },
  {
    id: "nvidia/nemotron-nano-12b-v2-vl",
    name: "Nemotron Nano 12B VL",
    provider: "NVIDIA",
    type: "vision",
    size: "12B",
    description: "نموذج Nemotron Nano متعدد الوسائط مع رؤية",
    badges: ["vision", "multimodal"],
  },
  {
    id: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    name: "Nemotron Super 49B v1.5",
    provider: "NVIDIA",
    type: "premium",
    size: "49B",
    description: "نموذج Nemotron Super المحسّن للمحادثات",
    badges: ["premium"],
  },
  {
    id: "nvidia/llama-3.3-nemotron-super-49b-v1",
    name: "Nemotron Super 49B v1",
    provider: "NVIDIA",
    type: "premium",
    size: "49B",
    description: "نموذج Nemotron Super للمهام المتقدمة",
    badges: ["premium"],
  },
  {
    id: "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",
    name: "Nemotron Nano VL 8B",
    provider: "NVIDIA",
    type: "vision",
    size: "8B",
    description: "نموذج Nemotron Nano للرؤية متعدد الوسائط",
    badges: ["vision"],
  },
  {
    id: "nvidia/llama-3.1-nemotron-nano-8b-v1",
    name: "Nemotron Nano 8B",
    provider: "NVIDIA",
    type: "fast",
    size: "8B",
    description: "نموذج Nemotron Nano خفيف وسريع",
    badges: ["fast"],
  },
  {
    id: "nvidia/nvidia-nemotron-nano-9b-v2",
    name: "Nemotron Nano 9B v2",
    provider: "NVIDIA",
    type: "fast",
    size: "9B",
    description: "نموذج Nemotron Nano 9B المحسّن",
    badges: ["fast"],
  },
  {
    id: "nvidia/nemotron-mini-4b-instruct",
    name: "Nemotron Mini 4B",
    provider: "NVIDIA",
    type: "fast",
    size: "4B",
    description: "نموذج Nemotron Mini خفيف جداً وسريع",
    badges: ["fast", "efficient"],
  },
  {
    id: "nvidia/usdcode",
    name: "USD Code",
    provider: "NVIDIA",
    type: "coding",
    size: "-",
    description: "نموذج NVIDIA متخصص في كتابة كود USD",
    badges: ["coding"],
  },

  // ── DeepSeek ─────────────────────────────────────────────────────────────────
  {
    id: "deepseek-ai/deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    provider: "DeepSeek",
    type: "fast",
    size: "Flash",
    description: "نسخة سريعة من DeepSeek V4 للردود الفورية",
    badges: ["fast", "new"],
  },
  {
    id: "deepseek-ai/deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    provider: "DeepSeek",
    type: "premium",
    size: "Pro",
    description: "نسخة Pro من DeepSeek V4 للمهام المتقدمة",
    badges: ["premium", "new"],
  },

  // ── ZAI (GLM) ─────────────────────────────────────────────────────────────────
  {
    id: "z-ai/glm-5.1",
    name: "GLM 5.1",
    provider: "ZAI",
    type: "premium",
    size: "5.1",
    description: "نموذج GLM 5.1 من ZAI المتقدم",
    badges: ["premium", "new"],
  },
  {
    id: "z-ai/glm-4.7",
    name: "GLM 4.7",
    provider: "ZAI",
    type: "general",
    size: "4.7",
    description: "نموذج GLM 4.7 للمهام المتنوعة",
    badges: ["general"],
  },

  // ── Minimax ───────────────────────────────────────────────────────────────────
  {
    id: "minimaxa/minimax-m2.7",
    name: "MiniMax M2.7",
    provider: "Minimax",
    type: "reasoning",
    size: "M2.7",
    description: "نموذج MiniMax M2.7 للاستدلال المتقدم",
    badges: ["reasoning", "new"],
  },
  {
    id: "minimaxa/minimax-m2.5",
    name: "MiniMax M2.5",
    provider: "Minimax",
    type: "general",
    size: "M2.5",
    description: "نموذج MiniMax M2.5 متوازن",
    badges: ["general"],
  },

  // ── Google ────────────────────────────────────────────────────────────────────
  {
    id: "google/gemma-4-31b-it",
    name: "Gemma 4 31B",
    provider: "Google",
    type: "general",
    size: "31B",
    description: "نموذج Gemma 4 من Google للاستخدام العام",
    badges: ["general", "new"],
  },
  {
    id: "google/gemma-3n-e4b-it",
    name: "Gemma 3n E4B",
    provider: "Google",
    type: "fast",
    size: "E4B",
    description: "نموذج Gemma 3n خفيف وسريع",
    badges: ["fast"],
  },
  {
    id: "google/gemma-3n-e2b-it",
    name: "Gemma 3n E2B",
    provider: "Google",
    type: "fast",
    size: "E2B",
    description: "نموذج Gemma 3n أصغر وأسرع",
    badges: ["fast", "efficient"],
  },
  {
    id: "google/gemma-2-2b-it",
    name: "Gemma 2 2B",
    provider: "Google",
    type: "fast",
    size: "2B",
    description: "نموذج Gemma 2 صغير جداً وسريع",
    badges: ["fast"],
  },

  // ── Qwen ──────────────────────────────────────────────────────────────────────
  {
    id: "qwen/qwen3.5-397b-a17b",
    name: "Qwen 3.5 397B",
    provider: "Qwen",
    type: "ultra",
    size: "397B MoE",
    description: "أضخم نموذج من Qwen 3.5 بتقنية MoE",
    badges: ["ultra", "powerful"],
  },
  {
    id: "qwen/qwen3.5-122b-a10b",
    name: "Qwen 3.5 122B",
    provider: "Qwen",
    type: "premium",
    size: "122B MoE",
    description: "نموذج Qwen 3.5 الكبير للمهام المتقدمة",
    badges: ["premium"],
  },
  {
    id: "qwen/qwen3-next-80b-a3b-instruct",
    name: "Qwen3 Next 80B",
    provider: "Qwen",
    type: "general",
    size: "80B MoE",
    description: "نموذج Qwen3 Next الكبير للتعليمات",
    badges: ["general", "new"],
  },
  {
    id: "qwen/qwen3-next-80b-a3b-thinking",
    name: "Qwen3 Next 80B Thinking",
    provider: "Qwen",
    type: "thinking",
    size: "80B MoE",
    description: "نموذج Qwen3 Next بوضع التفكير المعمّق",
    badges: ["thinking", "new"],
  },
  {
    id: "qwen/qwen3-coder-480b-a35b-instruct",
    name: "Qwen3 Coder 480B",
    provider: "Qwen",
    type: "coding",
    size: "480B MoE",
    description: "نموذج Qwen3 Coder الضخم للبرمجة",
    badges: ["coding", "powerful"],
  },
  {
    id: "qwen/qwen2.5-coder-32b-instruct",
    name: "Qwen 2.5 Coder 32B",
    provider: "Qwen",
    type: "coding",
    size: "32B",
    description: "نموذج Qwen متخصص في البرمجة والكود",
    badges: ["coding"],
  },

  // ── StepFun ───────────────────────────────────────────────────────────────────
  {
    id: "stepfun-ai/step-3.5-flash",
    name: "Step 3.5 Flash",
    provider: "StepFun",
    type: "fast",
    size: "Flash",
    description: "نموذج Step 3.5 Flash سريع للغاية",
    badges: ["fast", "new"],
  },

  // ── Stockmark ─────────────────────────────────────────────────────────────────
  {
    id: "stockmark/stockmark-2-100b-instruct",
    name: "Stockmark 2 100B",
    provider: "Stockmark",
    type: "general",
    size: "100B",
    description: "نموذج Stockmark 2 الكبير",
    badges: ["general"],
  },

  // ── ByteDance ─────────────────────────────────────────────────────────────────
  {
    id: "bytedance/seed-oss-36b-instruct",
    name: "Seed OSS 36B",
    provider: "ByteDance",
    type: "general",
    size: "36B",
    description: "نموذج Seed OSS من ByteDance",
    badges: ["general", "new"],
  },

  // ── OpenAI (OSS) ──────────────────────────────────────────────────────────────
  {
    id: "openai/gpt-oss-20b",
    name: "GPT OSS 20B",
    provider: "OpenAI",
    type: "general",
    size: "20B",
    description: "نموذج GPT مفتوح المصدر 20B من OpenAI",
    badges: ["general", "new"],
  },
  {
    id: "openai/gpt-oss-120b",
    name: "GPT OSS 120B",
    provider: "OpenAI",
    type: "premium",
    size: "120B",
    description: "نموذج GPT مفتوح المصدر 120B من OpenAI",
    badges: ["premium", "new"],
  },

  // ── Sarvam ────────────────────────────────────────────────────────────────────
  {
    id: "sarvamai/sarvam-m",
    name: "Sarvam M",
    provider: "Sarvam",
    type: "general",
    size: "M",
    description: "نموذج Sarvam M متعدد اللغات",
    badges: ["general"],
  },

  // ── AbacusAI ──────────────────────────────────────────────────────────────────
  {
    id: "abacusai/dracarys-llama-3.1-70b-instruct",
    name: "Dracarys Llama 3.1 70B",
    provider: "AbacusAI",
    type: "general",
    size: "70B",
    description: "نموذج Dracarys المبني على Llama 3.1 70B",
    badges: ["general"],
  },

  // ── Microsoft ─────────────────────────────────────────────────────────────────
  {
    id: "microsoft/phi-4-mini-instruct",
    name: "Phi-4 Mini",
    provider: "Microsoft",
    type: "fast",
    size: "Mini",
    description: "نموذج Phi-4 Mini خفيف وسريع من Microsoft",
    badges: ["fast", "efficient"],
  },
  {
    id: "microsoft/phi-4-multimodal-instruct",
    name: "Phi-4 Multimodal",
    provider: "Microsoft",
    type: "vision",
    size: "Multimodal",
    description: "نموذج Phi-4 متعدد الوسائط من Microsoft",
    badges: ["vision", "multimodal"],
  },

  // ── Meta Llama ────────────────────────────────────────────────────────────────
  {
    id: "meta/llama-4-maverick-17b-128e-instruct",
    name: "Llama 4 Maverick 17B",
    provider: "Meta",
    type: "general",
    size: "17B MoE",
    description: "نموذج Llama 4 Maverick بتقنية MoE",
    badges: ["general", "new"],
  },
  {
    id: "meta/llama-3.3-70b-instruct",
    name: "Llama 3.3 70B",
    provider: "Meta",
    type: "general",
    size: "70B",
    description: "نموذج Llama 3.3 المتوازن والقوي",
    badges: ["general"],
  },
  {
    id: "meta/llama-3.3-3b-instruct",
    name: "Llama 3.3 3B",
    provider: "Meta",
    type: "fast",
    size: "3B",
    description: "نموذج Llama 3.3 خفيف جداً",
    badges: ["fast"],
  },
  {
    id: "meta/llama-3.2-90b-vision-instruct",
    name: "Llama 3.2 90B Vision",
    provider: "Meta",
    type: "vision",
    size: "90B",
    description: "نموذج Llama 3.2 للرؤية والصور - الأقوى",
    badges: ["vision", "powerful"],
  },
  {
    id: "meta/llama-3.2-11b-vision-instruct",
    name: "Llama 3.2 11B Vision",
    provider: "Meta",
    type: "vision",
    size: "11B",
    description: "نموذج Llama 3.2 للرؤية والصور",
    badges: ["vision"],
  },
  {
    id: "meta/llama-3.2-1b-instruct",
    name: "Llama 3.2 1B",
    provider: "Meta",
    type: "fast",
    size: "1B",
    description: "أخف نماذج Llama وأسرعها",
    badges: ["fast", "efficient"],
  },
  {
    id: "meta/llama-3.1-70b-instruct",
    name: "Llama 3.1 70B",
    provider: "Meta",
    type: "general",
    size: "70B",
    description: "نموذج Llama 3.1 متوازن للمهام المتنوعة",
    badges: ["general", "balanced"],
  },
  {
    id: "meta/llama-3.1-8b-instruct",
    name: "Llama 3.1 8B",
    provider: "Meta",
    type: "fast",
    size: "8B",
    description: "سريع وخفيف - الأفضل للردود السريعة",
    badges: ["fast", "reliable"],
    default: true,
  },
]

// Fallback chain for resilience
export const MODEL_FALLBACK_CHAIN = [
  "meta/llama-3.1-8b-instruct",
  "meta/llama-3.3-70b-instruct",
  "mistralai/mistral-medium-3-instruct",
  "meta/llama-3.1-70b-instruct",
  "nvidia/llama-3.3-nemotron-super-49b-v1",
]

// Default model (fast & reliable)
export const DEFAULT_MODEL = "meta/llama-3.1-8b-instruct"

// Safe fallback model
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
