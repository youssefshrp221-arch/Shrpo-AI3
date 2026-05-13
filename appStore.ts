import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Chat, Message, AppSettings, WritingProject } from "@/types"
import { DEFAULT_MODEL, DEFAULT_SYSTEM_PROMPT } from "@/types"

interface AppStore {
  // Active state
  activeChatId: string | null
  setActiveChatId: (id: string | null) => void
  activeView: "chat" | "writing" | "novel" | "tools" | "settings" | "dev"
  setActiveView: (view: "chat" | "writing" | "novel" | "tools" | "settings" | "dev") => void
  activeWritingProjectId: string | null
  setActiveWritingProjectId: (id: string | null) => void

  // Sidebar
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  searchQuery: string
  setSearchQuery: (q: string) => void

  // Settings
  settings: AppSettings
  updateSettings: (s: Partial<AppSettings>) => void

  // Selected model
  selectedModel: string
  setSelectedModel: (model: string) => void

  // Streaming state
  isStreaming: boolean
  setIsStreaming: (s: boolean) => void
  streamController: AbortController | null
  setStreamController: (c: AbortController | null) => void

  // Local messages cache
  localMessages: Record<string, Message[]>
  addLocalMessage: (chatId: string, msg: Message) => void
  updateLocalMessage: (chatId: string, msgId: string, content: string) => void
  setLocalMessages: (chatId: string, msgs: Message[]) => void
  clearLocalMessages: (chatId: string) => void

  // Local chats cache
  localChats: Chat[]
  setLocalChats: (chats: Chat[]) => void
  addLocalChat: (chat: Chat) => void
  updateLocalChat: (chatId: string, updates: Partial<Chat>) => void
  removeLocalChat: (chatId: string) => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      activeChatId: null,
      setActiveChatId: (id) => set({ activeChatId: id }),
      activeView: "chat",
      setActiveView: (view) => set({ activeView: view }),
      activeWritingProjectId: null,
      setActiveWritingProjectId: (id) => set({ activeWritingProjectId: id }),

      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      searchQuery: "",
      setSearchQuery: (q) => set({ searchQuery: q }),

      settings: {
        temperature: 0.7,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        memoryEnabled: true,
        fontSize: "md",
        theme: "dark",
        ttsEnabled: false,
        sttEnabled: false,
      },
      updateSettings: (s) => set((state) => ({ settings: { ...state.settings, ...s } })),

      selectedModel: DEFAULT_MODEL,
      setSelectedModel: (model) => set({ selectedModel: model }),

      isStreaming: false,
      setIsStreaming: (s) => set({ isStreaming: s }),
      streamController: null,
      setStreamController: (c) => set({ streamController: c }),

      localMessages: {},
      addLocalMessage: (chatId, msg) =>
        set((state) => ({
          localMessages: {
            ...state.localMessages,
            [chatId]: [...(state.localMessages[chatId] || []), msg],
          },
        })),
      updateLocalMessage: (chatId, msgId, content) =>
        set((state) => ({
          localMessages: {
            ...state.localMessages,
            [chatId]: (state.localMessages[chatId] || []).map((m) =>
              m.id === msgId ? { ...m, content } : m
            ),
          },
        })),
      setLocalMessages: (chatId, msgs) =>
        set((state) => ({
          localMessages: { ...state.localMessages, [chatId]: msgs },
        })),
      clearLocalMessages: (chatId) =>
        set((state) => {
          const msgs = { ...state.localMessages }
          delete msgs[chatId]
          return { localMessages: msgs }
        }),

      localChats: [],
      setLocalChats: (chats) => set({ localChats: chats }),
      addLocalChat: (chat) =>
        set((state) => ({ localChats: [chat, ...state.localChats] })),
      updateLocalChat: (chatId, updates) =>
        set((state) => ({
          localChats: state.localChats.map((c) =>
            c.id === chatId ? { ...c, ...updates } : c
          ),
        })),
      removeLocalChat: (chatId) =>
        set((state) => ({
          localChats: state.localChats.filter((c) => c.id !== chatId),
        })),
    }),
    {
      name: "shrpo-ai-store",
      partialize: (state) => ({
        settings: state.settings,
        selectedModel: state.selectedModel,
        sidebarOpen: state.sidebarOpen,
        localChats: state.localChats,
        localMessages: state.localMessages,
        activeWritingProjectId: state.activeWritingProjectId,
        activeChatId: state.activeChatId,
        activeView: state.activeView,
      }),
    }
  )
)
