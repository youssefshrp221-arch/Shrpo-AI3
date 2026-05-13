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
      title: "New Chat",
      pinned: false,
      model: "meta/llama-3.1-405b-instruct",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    addLocalChat(newChat)
    setActiveChatId(newChat.id)
    setActiveView("chat")
    // Persist to Supabase with user_id
    await supabase.from("chats").insert({
      id: newChat.id,
      title: newChat.title,
      pinned: newChat.pinned,
      model: newChat.model,
      user_id: userId,
    })
  }

  // Auto-create first chat if none exist
  useEffect(() => {
    if (localChats.length > 0 && !activeChatId) {
      // Select first chat if we have chats but no active one
      setActiveChatId(localChats[0].id)
      setActiveView("chat")
    } else if (localChats.length === 0 && !activeChatId) {
      // Create first chat if we have nothing
      createNewChat()
    }
  }, [])

  return (
    <Flex h="100vh" overflow="hidden" bg="#0a0a0f" flexDirection={{ base: "column", md: "row" }}>
      {/* Sidebar - desktop fixed width, mobile overlay */}
      <Sidebar onNewChat={createNewChat} />

      {/* Main content - adjust for mobile header */}
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
