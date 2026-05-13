import { useEffect } from "react"
import { Box, Flex } from "@chakra-ui/react"
import Sidebar from "@/components/Sidebar"
import ChatPage from "@/pages/ChatPage"
import WritingStudio from "@/pages/WritingStudio"
import NovelStudio from "@/pages/NovelStudio"
import ToolsPage from "@/pages/ToolsPage"
import SettingsPage from "@/pages/SettingsPage"
import { useAppStore } from "@/store/appStore"
import { supabase, getSessionId, initializeSessionId } from "@/lib/supabase"
import { v4 as uuidv4 } from "uuid"
import type { Chat } from "@/types"

export default function MainLayout() {
  const {
    activeView, setActiveView,
    activeChatId, setActiveChatId,
    addLocalChat, localChats,
  } = useAppStore()

  const createNewChat = async () => {
    initializeSessionId()
    const userId = getSessionId()

    const newChat: Chat = {
      id: uuidv4(),
      title: "محادثة جديدة",
      pinned: false,
      model: "meta/llama-4-maverick-17b-128e-instruct",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    addLocalChat(newChat)
    setActiveChatId(newChat.id)
    setActiveView("chat")

    // Persist to Supabase if available
    if (supabase) {
      supabase.from("chats").insert({
        id: newChat.id,
        title: newChat.title,
        pinned: newChat.pinned,
        model: newChat.model,
        user_id: userId,
      }).then(({ error }) => {
        if (error) console.warn("Failed to persist chat:", error.message)
      })
    }
  }

  // Auto-select or create first chat
  useEffect(() => {
    if (localChats.length > 0 && !activeChatId) {
      setActiveChatId(localChats[0].id)
      setActiveView("chat")
    } else if (localChats.length === 0 && !activeChatId) {
      createNewChat()
    }
  }, [])

  return (
    <Flex h="100vh" overflow="hidden" bg="#0a0a0f" flexDirection={{ base: "column", md: "row" }}>
      <Sidebar onNewChat={createNewChat} />
      <Box
        flex="1"
        overflow="hidden"
        position="relative"
        mt={{ base: "64px", md: "0" }}
        display="flex"
        flexDirection="column"
        w={{ base: "full", md: "auto" }}
      >
        {activeView === "chat" && <ChatPage onNewChat={createNewChat} />}
        {activeView === "writing" && <WritingStudio />}
        {activeView === "novel" && <NovelStudio />}
        {activeView === "tools" && <ToolsPage />}
        {activeView === "settings" && <SettingsPage />}
      </Box>
    </Flex>
  )
}
