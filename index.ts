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
  base64?: string
  fileText?: string
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

const ALL_MODELS: ModelConfig[] = [
  {
    id: "mistrail/mistral-large-3-675b-instruct-2512",
    name: "mistral-large-3-675b-instruct-2512",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "mistrail/ministral-14b-instruct-2512",
    name: "ministral-14b-instruct-2512",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "nvidia/nemotron-nano-12b-v2-vl",
    name: "nemotron-nano-12b-v2-vl",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "bytedance/seed-oss-3Bb-instruct",
    name: "seed-oss-3Bb-instruct",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "sarvam/sarvam-m",
    name: "sarvam-m",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "mistrail/magistral-small-2506",
    name: "magistral-small-2506",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "google/gemma-3h-e4b-it",
    name: "gemma-3h-e4b-it",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "google/gemma-3h-e2b-it",
    name: "gemma-3h-e2b-it",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "mistrail/mistral-nemotron",
    name: "mistral-nemotron",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "nvidia/llama-3.1-nemotron-nano-vl-8Bb-v1",
    name: "llama-3.1-nemotron-nano-vl-8Bb-v1",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "mistrail/mistral-medium-3-instruct",
    name: "mistral-medium-3-instruct",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "nvidia/llama-3.1-nemotron-nano-8b-v1",
    name: "llama-3.1-nemotron-nano-8b-v1",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "microsoft/phi-4-mini-instruct",
    name: "phi-4-mini-instruct",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "microsoft/phi-4-multimodal-instruct",
    name: "phi-4-multimodal-instruct",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "qwen/qwen2.5-coder-32b-instruct",
    name: "qwen2.5-coder-32b-instruct",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "nvidia/uscode",
    name: "uscode",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "meta/llama-3.2-1b-instruct",
    name: "llama-3.2-1b-instruct",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "abacusai/acarys-llama-3.1-70b-instruct",
    name: "acarys-llama-3.1-70b-instruct",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "nvidia/nemotron-mini-4b-instruct",
    name: "nemotron-mini-4b-instruct",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "google/gemma-2-2b-it",
    name: "gemma-2-2b-it",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "meta/llama-3.1-70b-instruct",
    name: "llama-3.1-70b-instruct",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "mistrail/mistral-7b-instruct-v0.3",
    name: "mistral-7b-instruct-v0.3",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "mistrail/mistral-8k22b-instruct-v0.1",
    name: "mistral-8k22b-instruct-v0.1",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "mistrail/mistral-8k7b-instruct-v0.1",
    name: "mistral-8k7b-instruct-v0.1",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "nvidia/nemotro-3-nano-omni-30b-a3b-reasoning",
    name: "nemotro-3-nano-omni-30b-a3b-reasoning",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "z-ai/gim-5.1",
    name: "gim-5.1",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "z-ai/gim-4.7",
    name: "gim-4.7",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "nvidia/ising-calibration-1-35b-a3b",
    name: "ising-calibration-1-35b-a3b",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "google/gemma-4-31b-it",
    name: "gemma-4-31b-it",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "mistralai/mistral-small-4-119b-2603",
    name: "mistral-small-4-119b-2603",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "qwen/qwen3.5-122b-a10b",
    name: "qwen3.5-122b-a10b",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "qwen/qwen3.5-397b-a17b",
    name: "qwen3.5-397b-a17b",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "mistralai/mistral-large-3-67Sb-instruct-2512",
    name: "mistral-large-3-67Sb-instruct-2512",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "mistralai/ministral-14b-instruct-2512",
    name: "ministral-14b-instruct-2512",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "nvidia/nemotron-nano-12b-v2-v1",
    name: "nemotron-nano-12b-v2-v1",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "qwen/qwen3-next-80b-a3b-instruct",
    name: "qwen3-next-80b-a3b-instruct",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "qwen/qwen3-next-80b-a3b-thinking",
    name: "qwen3-next-80b-a3b-thinking",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "bytedance/seed-oss-85b-instruct",
    name: "seed-oss-85b-instruct",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "qwen/qwen3-coder-480b-a35b-instruct",
    name: "qwen3-coder-480b-a35b-instruct",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "nvidia/nvidia-nemotron-nano-9b-v2",
    name: "nvidia-nemotron-nano-9b-v2",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "openai/gpt-oss-12db",
    name: "gpt-oss-12db",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "savanal/sarvam-m",
    name: "sarvam-m",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "mistralai/magistral-small-250b",
    name: "magistral-small-250b",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "google/gemma-3n-e2b-it",
    name: "gemma-3n-e2b-it",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "mistralai/mistral-nemotron",
    name: "mistral-nemotron",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "nvidia/llama-3.1-nemotron-nano-v1-8Bb-v1",
    name: "llama-3.1-nemotron-nano-v1-8Bb-v1",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "mistralai/mistral-medium-3-instruct",
    name: "mistral-medium-3-instruct",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "meta/llama-4-maverick-17b-128e-instruct",
    name: "llama-4-maverick-17b-128e-instruct",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "nvidia/llama-3.3-nemotron-super-49b-v1",
    name: "llama-3.3-nemotron-super-49b-v1",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "nvidia/llama-3.1-nemotron-nano-8Bb-v1",
    name: "llama-3.1-nemotron-nano-8Bb-v1",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered via Image Context",
    badges: ["new"],
  },
  {
    id: "moonshotai/kimi-k2.6",
    name: "Kimi K2.6",
    provider: "MoonshotAI",
    type: "reasoning",
    size: "K2.6",
    description: "نموذج كتابة وتحليل قوي للروايات والمحتوى الطويل",
    badges: ["reasoning", "creative", "new"],
  },
  {
    id: "mistralai/mistral-medium-3.5-128b",
    name: "Mistral Medium 3.5 128B",
    provider: "Mistral",
    type: "premium",
    size: "128B",
    description: "نموذج قوي ومتوازن للمهام العامة",
    badges: ["premium", "general", "new"],
  },
  {
    id: "mistralai/mistral-large-3-675b-instruct-2512",
    name: "Mistral Large 3 675B",
    provider: "Mistral",
    type: "ultra",
    size: "675B",
    description: "نموذج ضخم للمهام الصعبة جدًا",
    badges: ["ultra", "powerful"],
  },
  {
    id: "mistralai/mistral-14b-instruct-2512",
    name: "Mistral 14B",
    provider: "Mistral",
    type: "general",
    size: "14B",
    description: "نموذج متوازن للاستخدام العام",
    badges: ["general"],
  },
  {
    id: "mistralai/mistral-small-4-11b-2603",
    name: "Mistral Small 4 11B",
    provider: "Mistral",
    type: "fast",
    size: "11B",
    description: "نموذج سريع وخفيف للمهام اليومية",
    badges: ["fast", "efficient"],
  },
  {
    id: "mistralai/mistral-7b-instruct-v0.3",
    name: "Mistral 7B v0.3",
    provider: "Mistral",
    type: "fast",
    size: "7B",
    description: "نموذج خفيف وسريع",
    badges: ["fast"],
  },
  {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    name: "Nemotron 3 Nano Omni 30B Reasoning",
    provider: "NVIDIA",
    type: "reasoning",
    size: "30B",
    description: "نموذج استدلال متقدم من NVIDIA",
    badges: ["reasoning", "new"],
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b",
    name: "Nemotron 3 Super 120B",
    provider: "NVIDIA",
    type: "ultra",
    size: "120B",
    description: "نموذج قوي جدًا للمهام المعقدة",
    badges: ["ultra", "powerful"],
  },
  {
    id: "nvidia/nemotron-3-nano-30b-a3b",
    name: "Nemotron 3 Nano 30B",
    provider: "NVIDIA",
    type: "fast",
    size: "30B",
    description: "نموذج NVIDIA سريع وخفيف",
    badges: ["fast"],
  },
  {
    id: "nvidia/nemotron-nano-9b-v2",
    name: "Nemotron Nano 9B v2",
    provider: "NVIDIA",
    type: "fast",
    size: "9B",
    description: "نموذج صغير وسريع من NVIDIA",
    badges: ["fast", "efficient"],
  },
  {
    id: "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    name: "Llama 3.3 Nemotron Super 49B",
    provider: "NVIDIA",
    type: "reasoning",
    size: "49B",
    description: "نموذج استدلال متقدم وقوي",
    badges: ["reasoning", "powerful"],
  },
  {
    id: "nvidia/llama-3.1-nemotron-nano-v1-8b-v1",
    name: "Llama 3.1 Nemotron Nano 8B",
    provider: "NVIDIA",
    type: "fast",
    size: "8B",
    description: "نموذج NVIDIA صغير وسريع",
    badges: ["fast"],
  },
  {
    id: "nvidia/llama-3.1-nemotron-nano-49b-v1",
    name: "Llama 3.1 Nemotron Nano 49B",
    provider: "NVIDIA",
    type: "reasoning",
    size: "49B",
    description: "نموذج NVIDIA للاستدلال المتقدم",
    badges: ["reasoning"],
  },
  {
    id: "meta/llama-3.3-70b-instruct",
    name: "Llama 3.3 70B",
    provider: "Meta",
    type: "reasoning",
    size: "70B",
    description: "نموذج قوي متعدد الاستخدامات",
    badges: ["reasoning", "powerful"],
  },
  {
    id: "meta/llama-3.2-3b-instruct",
    name: "Llama 3.2 3B",
    provider: "Meta",
    type: "fast",
    size: "3B",
    description: "نموذج خفيف وسريع",
    badges: ["fast"],
  },
  {
    id: "meta/llama-3.2-11b-vision-instruct",
    name: "Llama 3.2 11B Vision",
    provider: "Meta",
    type: "vision",
    size: "11B",
    description: "نموذج رؤية وتحليل صور",
    badges: ["vision"],
  },
  {
    id: "meta/llama-3.2-90b-vision-instruct",
    name: "Llama 3.2 90B Vision",
    provider: "Meta",
    type: "vision",
    size: "90B",
    description: "نموذج رؤية قوي لاستخراج النصوص والموديلات من الصور",
    badges: ["vision", "powerful"],
  },
  {
    id: "meta/llama-3.1-8b-instruct",
    name: "Llama 3.1 8B",
    provider: "Meta",
    type: "fast",
    size: "8B",
    description: "نموذج عام سريع",
    badges: ["fast"],
  },
  {
    id: "openai/gpt-oss-20b",
    name: "GPT OSS 20B",
    provider: "OpenAI",
    type: "general",
    size: "20B",
    description: "نموذج عام متوازن",
    badges: ["general"],
  },
  {
    id: "openai/gpt-oss-120b",
    name: "GPT OSS 120B",
    provider: "OpenAI",
    type: "ultra",
    size: "120B",
    description: "نموذج ضخم للمهام الثقيلة",
    badges: ["ultra", "powerful"],
  },
  {
    id: "google/gemma-3-27b-it",
    name: "Gemma 3 27B",
    provider: "Google",
    type: "general",
    size: "27B",
    description: "نموذج Google متعدد الاستخدامات",
    badges: ["general"],
  },
  {
    id: "google/gemma-3n-e4b-it",
    name: "Gemma 3n E4B",
    provider: "Google",
    type: "fast",
    size: "4B",
    description: "نموذج Google خفيف وسريع",
    badges: ["fast"],
  },
  {
    id: "deepseek-ai/deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    provider: "DeepSeek",
    type: "fast",
    size: "Flash",
    description: "نسخة سريعة للمهام اليومية",
    badges: ["fast"],
  },
  {
    id: "deepseek-ai/deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    provider: "DeepSeek",
    type: "reasoning",
    size: "Pro",
    description: "نسخة أقوى للاستدلال",
    badges: ["reasoning"],
  },
  {
    id: "stepfun-ai/step-3.5-flash",
    name: "Step-3.5 Flash",
    provider: "StepFun",
    type: "fast",
    size: "Flash",
    description: "نموذج سريع ومنخفض التأخير",
    badges: ["fast"],
  },
  {
    id: "minimaxai/minimax-m2.7",
    name: "MiniMax M2.7",
    provider: "Minimax",
    type: "general",
    size: "2.7",
    description: "نموذج عام من MiniMax",
    badges: ["general"],
  },
  {
    id: "minimaxai/minimax-m2.5",
    name: "MiniMax M2.5",
    provider: "Minimax",
    type: "general",
    size: "2.5",
    description: "نموذج عام من MiniMax",
    badges: ["general"],
  },
  {
    id: "bytedance/seed-oss-36b-instruct",
    name: "Seed OSS 36B",
    provider: "ByteDance",
    type: "reasoning",
    size: "36B",
    description: "نموذج استدلال متعدد الاستخدامات",
    badges: ["reasoning"],
  },
  {
    id: "stockmark/stockmark-2-100b-instruct",
    name: "Stockmark 2 100B",
    provider: "Stockmark",
    type: "reasoning",
    size: "100B",
    description: "نموذج قوي للمهام المعقدة",
    badges: ["reasoning", "powerful"],
  },
  {
    id: "abacusai/dracarys-llama-3.1-70b-instruct",
    name: "Dracarys Llama 3.1 70B",
    provider: "AbacusAI",
    type: "reasoning",
    size: "70B",
    description: "نموذج استدلال متقدم",
    badges: ["reasoning"],
  },
  {
    id: "sarvamai/sarvam-m",
    name: "Sarvam M",
    provider: "Sarvam",
    type: "general",
    size: "M",
    description: "نموذج عام من Sarvam",
    badges: ["general"],
  },
  {
    id: "z-ai/glm-4.7",
    name: "GLM 4.7",
    provider: "ZAI",
    type: "reasoning",
    size: "4.7",
    description: "نموذج قوي متعدد الاستخدامات",
    badges: ["reasoning"],
  },
]

export const NVIDIA_MODELS = ALL_MODELS
export const DEFAULT_MODEL = "moonshotai/kimi-k2.6"
export const DEFAULT_SYSTEM_PROMPT = "أنت Shrpo AI، مساعد ذكي متعدد الاستخدامات. أجب بدقة واحترافية."
export const SAFE_FALLBACK_MODEL = "meta/llama-3.1-8b-instruct"
export const MODEL_FALLBACK_CHAIN: string[] = [
  "moonshotai/kimi-k2.6",
  "meta/llama-3.3-70b-instruct",
  "meta/llama-3.1-8b-instruct",
]
export const MODEL_REGISTRY: Record<string, ModelConfig> = Object.fromEntries(
  ALL_MODELS.map((model) => [model.id, model])
)

export function getModel(id: string): ModelConfig | undefined {
  return MODEL_REGISTRY[id]
}

export function getModelsByProvider(provider: ModelConfig['provider']) {
  return ALL_MODELS.filter((m) => m.provider === provider)
}
