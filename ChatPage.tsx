import { useEffect, useRef, useState, useCallback } from "react"
import {
  Box,
  VStack,
  HStack,
  Text,
  Icon,
  Heading,
  SimpleGrid,
  Flex,
} from "@chakra-ui/react"
import {
  LuBrain,
  LuCode,
  LuSquarePen,
  LuSearch,
  LuCalculator,
  LuGlobe,
  LuStar,
  LuChevronDown,
  LuEye,
} from "react-icons/lu"
import { useAppStore } from "@/store/appStore"
import { supabase, getSessionId, initializeSessionId } from "@/lib/supabase"
import { streamChat } from "@/lib/nvidia"
import { streamChatWithFallback } from "@/lib/modelOrchestrator"
import { toaster } from "@/components/ui/toaster"
import MessageBubble from "@/components/MessageBubble"
import ChatInput from "@/components/ChatInput"
import ModelSelector from "@/components/ModelSelector/ModelSelector"
import type { Message, Attachment } from "@/types"
import { v4 as uuidv4 } from "uuid"

const SUGGESTIONS = [
  { icon: LuCode, text: "Write a Python function to sort a list of dictionaries" },
  { icon: LuSquarePen, text: "Help me write a compelling product description" },
  { icon: LuSearch, text: "Explain quantum entanglement in simple terms" },
  { icon: LuCalculator, text: "Solve this calculus problem step by step" },
  { icon: LuGlobe, text: "Translate and summarize this text" },
  { icon: LuStar, text: "Generate creative story ideas for my novel" },
]

interface ChatPageProps {
  onNewChat: () => void
}

export default function ChatPage({ onNewChat }: ChatPageProps) {
  const {
    activeChatId,
    selectedModel,
    setSelectedModel,
    settings,
    isStreaming,
    setIsStreaming,
    streamController,
    setStreamController,
    localMessages,
    addLocalMessage,
    updateLocalMessage,
    setLocalMessages,
    updateLocalChat,
  } = useAppStore()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messages = activeChatId ? (localMessages[activeChatId] || []) : []

  useEffect(() => {
    if (activeChatId) loadMessages()
  }, [activeChatId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const loadMessages = async () => {
    if (!activeChatId) return
    if (localMessages[activeChatId]?.length) return
    const userId = getSessionId()
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", activeChatId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
    if (data) setLocalMessages(activeChatId, data as Message[])
  }

  const handleStop = () => {
    if (streamController) {
      streamController.abort()
      setStreamController(null)
    }
    setIsStreaming(false)
  }

  const handleSend = useCallback(async (content: string, attachments: Attachment[]) => {
    if (!activeChatId) return

    initializeSessionId()
    const userId = getSessionId()

    const userMsg: Message = {
      id: uuidv4(),
      chat_id: activeChatId,
      role: "user",
      content,
      attachments,
      created_at: new Date().toISOString(),
    }

    addLocalMessage(activeChatId, userMsg)
    const { error: insertError } = await supabase.from("messages").insert({
      id: userMsg.id,
      chat_id: activeChatId,
      role: "user",
      content,
      attachments: attachments as any,
      user_id: userId,
    })
    if (insertError) {
      console.error("Error inserting user message:", insertError)
    }

    // Update chat title from first message
    const currentMsgs = localMessages[activeChatId] || []
    if (currentMsgs.length === 0 && content.length > 0) {
      const title = content.slice(0, 60) + (content.length > 60 ? "..." : "")
      updateLocalChat(activeChatId, { title, updated_at: new Date().toISOString() })
      await supabase.from("chats").update({ title, updated_at: new Date().toISOString() }).eq("id", activeChatId)
    }

    const assistantId = uuidv4()
    const assistantMsg: Message = {
      id: assistantId,
      chat_id: activeChatId,
      role: "assistant",
      content: "",
      model: selectedModel,
      created_at: new Date().toISOString(),
    }
    addLocalMessage(activeChatId, assistantMsg)

    const controller = new AbortController()
    setStreamController(controller)
    setIsStreaming(true)

    const chatHistory = [...currentMsgs, userMsg].map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }))

    let fullContent = ""
    let firstChunkReceived = false

    try {
      const result = await streamChatWithFallback(
        chatHistory,
        selectedModel,
        {
          onChunk: (chunk) => {
            fullContent += chunk
            // Hide loading spinner on first token
            if (!firstChunkReceived) {
              firstChunkReceived = true
              setIsStreaming(false)
            }
            updateLocalMessage(activeChatId, assistantId, fullContent)
          },
          signal: controller.signal,
          temperature: settings.temperature,
        }
      )

      // Final content already updated via chunks

      // Show fallback notification if applicable
      if (result.fallbackCount > 0) {
        const model = result.modelUsed.split("/").pop() || result.modelUsed
        toaster.create({
          title: `Switched to ${model}`,
          description: `Primary model unavailable, using fallback`,
          type: "info",
        })
      }

      // Persist to database
      const userId = getSessionId()
      const { error: assistantError } = await supabase.from("messages").insert({
        id: assistantId,
        chat_id: activeChatId,
        role: "assistant",
        content: result.fullContent,
        model: result.modelUsed,
        user_id: userId,
      })

      if (assistantError) {
        console.error("Error inserting assistant message:", assistantError)
      }

      const { error: chatError } = await supabase
        .from("chats")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", activeChatId)

      if (chatError) {
        console.error("Error updating chat:", chatError)
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        // User stopped - preserve message
      } else {
        // Never show red error to user - show info toast instead
        updateLocalMessage(activeChatId, assistantId, fullContent || "Could not generate a response. Please try again.")
        if (!fullContent) {
          toaster.create({
            title: "Retrying...",
            description: "Switching to a backup model, please try again",
            type: "info",
          })
        }
      }
    } finally {
      setIsStreaming(false)
      setStreamController(null)
    }
  }, [activeChatId, selectedModel, settings, localMessages])

  const handleRegenerate = async () => {
    if (!activeChatId) return
    const msgs = localMessages[activeChatId] || []
    const lastUserMsg = [...msgs].reverse().find((m) => m.role === "user")
    if (!lastUserMsg) return
    // Remove last assistant message
    const newMsgs = msgs.slice(0, -1)
    setLocalMessages(activeChatId, newMsgs)
    await supabase.from("messages").delete().eq("id", msgs[msgs.length - 1].id)
    handleSend(lastUserMsg.content, [])
  }

  const showWelcome = messages.length === 0

  return (
    <Box h="100%" display="flex" flexDirection="column" bg="#0a0a0f" w="full">
      {/* Header - hidden on mobile, shown on desktop */}
      <Box
        px={{ base: "4", md: "6" }}
        py={{ base: "2", md: "3" }}
        borderBottom="1px solid"
        borderColor="rgba(99,102,241,0.1)"
        bg="rgba(10,10,15,0.9)"
        backdropFilter="blur(20px)"
        flexShrink={0}
        hideBelow="md"
      >
        <HStack justify="space-between">
          <HStack gap="3">
            <Box w="8" h="8" borderRadius="lg" bg="linear-gradient(135deg, #6366f1, #8b5cf6)" display="flex" alignItems="center" justifyContent="center">
              <Icon as={LuBrain} color="white" boxSize="15px" />
            </Box>
            <VStack align="start" gap="0">
              <Text fontWeight="600" fontSize="sm" color="white">Shrpo AI</Text>
              <Text fontSize="2xs" color="gray.600">
                {isStreaming ? (
                  <HStack gap="1" as="span">
                    <Box as="span" w="6px" h="6px" borderRadius="full" bg="green.400" style={{ animation: "pulse 1s infinite" }} />
                    <Box as="span">Generating...</Box>
                  </HStack>
                ) : "Ready"}
              </Text>
            </VStack>
          </HStack>
        </HStack>
      </Box>

      {/* Messages area - responsive padding and max-width */}
      <Box flex="1" overflowY="auto" position="relative" w="full">
        {showWelcome ? (
          <WelcomeScreen onSuggestion={(s) => handleSend(s, [])} />
        ) : (
          <Box maxW={{ base: "full", md: "800px" }} mx="auto" py={{ base: "3", md: "4" }} px={{ base: "3", sm: "4", md: "6" }}>
            {messages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isLast={i === messages.length - 1}
                isStreaming={isStreaming && i === messages.length - 1 && msg.role === "assistant"}
                onRegenerate={i === messages.length - 1 ? handleRegenerate : undefined}
              />
            ))}
            <div ref={messagesEndRef} />
          </Box>
        )}
      </Box>

      {/* Model Selector - responsive */}
      <Box hideBelow="md">
        <ModelSelector mobile={false} />
      </Box>

      {/* Mobile Model Selector */}
      <Box hideFrom="md" flexShrink={0}>
        <ModelSelector mobile={true} />
      </Box>

      {/* Input area - responsive, sticky at bottom */}
      <Box maxW={{ base: "full", md: "800px" }} mx="auto" w="full" px={{ base: "3", sm: "4", md: "6" }} pb={{ base: "3", md: "4" }} flexShrink={0}>
        <ChatInput onSend={handleSend} onStop={handleStop} />
      </Box>
    </Box>
  )
}

function WelcomeScreen({ onSuggestion }: { onSuggestion: (s: string) => void }) {
  return (
    <Box
      maxW="700px"
      mx="auto"
      px={{ base: "3", sm: "4", md: "6" }}
      py={{ base: "8", md: "12" }}
      display="flex"
      flexDirection="column"
      alignItems="center"
      textAlign="center"
      w="full"
    >
      <Box
        w={{ base: "64px", md: "80px" }}
        h={{ base: "64px", md: "80px" }}
        borderRadius="2xl"
        bg="linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%)"
        display="flex"
        alignItems="center"
        justifyContent="center"
        mb={{ base: "4", md: "6" }}
        shadow="0 0 50px rgba(99,102,241,0.4)"
        style={{ animation: "pulse 3s ease-in-out infinite" }}
      >
        <Icon as={LuBrain} boxSize={{ base: "32px", md: "40px" }} color="white" />
      </Box>

      <Heading
        fontSize={{ base: "xl", sm: "2xl", md: "3xl" }}
        fontWeight="800"
        letterSpacing="-0.02em"
        mb={{ base: "2", md: "3" }}
        style={{
          background: "linear-gradient(135deg, #e2e8f0 0%, #818cf8 50%, #06b6d4 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        How can I help you today?
      </Heading>
      <Text color="gray.500" fontSize={{ base: "xs", md: "sm" }} mb={{ base: "6", md: "10" }} maxW="400px">
        I'm Shrpo AI — your all-in-one assistant for coding, writing, analysis, and creative work.
      </Text>

      <SimpleGrid columns={{ base: 1, sm: 2, md: 2 }} gap={{ base: "2", md: "3" }} w="full">
        {SUGGESTIONS.map((s, i) => (
          <Box
            key={i}
            display="flex"
            alignItems={{ base: "start", md: "center" }}
            gap={{ base: "2", md: "3" }}
            p={{ base: "3", md: "4" }}
            bg="rgba(15,15,26,0.8)"
            border="1px solid"
            borderColor="rgba(99,102,241,0.12)"
            borderRadius="2xl"
            cursor="pointer"
            _hover={{
              bg: "rgba(99,102,241,0.08)",
              borderColor: "rgba(99,102,241,0.3)",
              transform: "translateY(-1px)",
            }}
            _active={{ bg: "rgba(99,102,241,0.12)" }}
            onClick={() => onSuggestion(s.text)}
            transition="all 0.2s"
            textAlign="left"
          >
            <Box
              w={{ base: "32px", md: "36px" }}
              h={{ base: "32px", md: "36px" }}
              borderRadius="xl"
              bg="rgba(99,102,241,0.15)"
              display="flex"
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
              minW={{ base: "32px", md: "36px" }}
            >
              <Icon as={s.icon} boxSize={{ base: "14px", md: "16px" }} color="brand.400" />
            </Box>
            <Text fontSize={{ base: "2xs", md: "xs" }} color="gray.300" lineHeight="1.5">
              {s.text}
            </Text>
          </Box>
        ))}
      </SimpleGrid>
    </Box>
  )
}

