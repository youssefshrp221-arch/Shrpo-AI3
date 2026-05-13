import { useEffect, useRef, useCallback } from "react"
import {
  Box,
  VStack,
  HStack,
  Text,
  Icon,
  Heading,
  SimpleGrid,
} from "@chakra-ui/react"
import {
  LuBrain,
  LuCode,
  LuSquarePen,
  LuSearch,
  LuCalculator,
  LuGlobe,
  LuStar,
} from "react-icons/lu"
import { useAppStore } from "@/store/appStore"
import { supabase, getSessionId, initializeSessionId } from "@/lib/supabase"
import { streamChat, getVisionModel, isVisionModel } from "@/lib/nvidia"
import { streamChatWithFallback } from "@/lib/modelOrchestrator"
import { toaster } from "@/components/ui/toaster"
import MessageBubble from "@/components/MessageBubble"
import ChatInput from "@/components/ChatInput"
import ModelSelector from "@/components/ModelSelector/ModelSelector"
import type { Message, Attachment } from "@/types"
import { v4 as uuidv4 } from "uuid"

const SUGGESTIONS = [
  { icon: LuCode, text: "اكتب دالة Python لفرز قائمة من القواميس" },
  { icon: LuSquarePen, text: "ساعدني في كتابة وصف منتج مقنع" },
  { icon: LuSearch, text: "اشرح التشابك الكمي بأسلوب بسيط" },
  { icon: LuCalculator, text: "احل هذه المسألة الحسابية خطوة بخطوة" },
  { icon: LuGlobe, text: "ترجم وتلخيص هذا النص" },
  { icon: LuStar, text: "اقترح أفكار قصصية إبداعية لروايتي" },
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
  const loadedChatsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (activeChatId) loadMessages(activeChatId)
  }, [activeChatId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  const loadMessages = async (chatId: string) => {
    // Only load from DB if not already loaded and supabase is available
    if (loadedChatsRef.current.has(chatId)) return
    loadedChatsRef.current.add(chatId)

    // If already cached locally, skip DB
    if (localMessages[chatId]?.length) return

    if (!supabase) return
    const userId = getSessionId()
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
    if (data && data.length > 0) setLocalMessages(chatId, data as Message[])
  }

  const handleStop = () => {
    if (streamController) {
      streamController.abort()
      setStreamController(null)
    }
    setIsStreaming(false)
  }

  const handleSend = useCallback(async (content: string, attachments: Attachment[]) => {
    if (!activeChatId || isStreaming) return

    initializeSessionId()
    const userId = getSessionId()

    // Determine if we have image attachments → need vision model
    const hasImages = attachments.some(a => a.type === "image")
    let activeModel = selectedModel
    if (hasImages && !isVisionModel(selectedModel)) {
      activeModel = getVisionModel()
      setSelectedModel(activeModel)
      toaster.create({
        title: "تم التبديل لنموذج الرؤية",
        description: "تم اختيار نموذج يدعم تحليل الصور تلقائياً",
        type: "info",
      })
    }

    // Build user message content with images
    let messageContent: any = content
    if (hasImages) {
      const parts: any[] = []
      if (content.trim()) parts.push({ type: "text", text: content })
      for (const att of attachments) {
        if (att.type === "image" && att.base64) {
          parts.push({ type: "image_url", image_url: { url: att.base64 } })
        } else if (att.type === "image") {
          parts.push({ type: "text", text: `[صورة: ${att.name}]` })
        }
        if (att.fileText) {
          parts.push({ type: "text", text: `\n\n[محتوى الملف - ${att.name}]:\n${att.fileText}` })
        }
      }
      messageContent = parts
    } else if (attachments.some(a => a.fileText)) {
      // Text file context appended
      const fileContexts = attachments
        .filter(a => a.fileText)
        .map(a => `[محتوى الملف - ${a.name}]:\n${a.fileText}`)
        .join("\n\n")
      messageContent = content + (fileContexts ? `\n\n${fileContexts}` : "")
    }

    const userMsg: Message = {
      id: uuidv4(),
      chat_id: activeChatId,
      role: "user",
      content: typeof messageContent === "string" ? messageContent : content,
      attachments,
      created_at: new Date().toISOString(),
    }

    addLocalMessage(activeChatId, userMsg)

    // Persist user message to DB if available
    if (supabase) {
      supabase.from("messages").insert({
        id: userMsg.id,
        chat_id: activeChatId,
        role: "user",
        content: userMsg.content,
        attachments: attachments as any,
        user_id: userId,
      }).then(({ error }) => {
        if (error) console.warn("Failed to persist user message:", error.message)
      })
    }

    // Update chat title from first message
    const currentMsgs = localMessages[activeChatId] || []
    if (currentMsgs.length === 0 && content.length > 0) {
      const title = content.slice(0, 60) + (content.length > 60 ? "..." : "")
      updateLocalChat(activeChatId, { title, updated_at: new Date().toISOString() })
      if (supabase) {
        supabase.from("chats").update({ title, updated_at: new Date().toISOString() }).eq("id", activeChatId)
      }
    }

    const assistantId = uuidv4()
    const assistantMsg: Message = {
      id: assistantId,
      chat_id: activeChatId,
      role: "assistant",
      content: "",
      model: activeModel,
      created_at: new Date().toISOString(),
    }
    addLocalMessage(activeChatId, assistantMsg)

    const controller = new AbortController()
    setStreamController(controller)
    setIsStreaming(true)

    // Build API chat history (text only for non-vision; multimodal for vision)
    const chatHistory = [...currentMsgs, userMsg].map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.role === "user" && hasImages && m.id === userMsg.id
        ? messageContent
        : (typeof m.content === "string" ? m.content : m.content),
    }))

    // Prepend system prompt
    const systemMessages = [
      { role: "system" as const, content: settings.systemPrompt },
      ...chatHistory,
    ]

    let fullContent = ""

    try {
      const result = await streamChatWithFallback(
        systemMessages,
        activeModel,
        {
          onChunk: (chunk) => {
            fullContent += chunk
            updateLocalMessage(activeChatId, assistantId, fullContent)
          },
          signal: controller.signal,
          temperature: settings.temperature,
        }
      )

      if (result.fallbackCount > 0) {
        const model = result.modelUsed.split("/").pop() || result.modelUsed
        toaster.create({
          title: `تم التبدي�� إلى ${model}`,
          description: "النموذج الأساسي غير متاح، تم استخدام بديل",
          type: "info",
        })
      }

      // Persist assistant message
      if (supabase) {
        supabase.from("messages").insert({
          id: assistantId,
          chat_id: activeChatId,
          role: "assistant",
          content: result.fullContent,
          model: result.modelUsed,
          user_id: userId,
        }).then(({ error }) => {
          if (error) console.warn("Failed to persist assistant message:", error.message)
        })

        supabase.from("chats")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", activeChatId)
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        // User stopped - keep partial response
      } else {
        console.error("Stream error:", err)
        if (!fullContent) {
          updateLocalMessage(activeChatId, assistantId, "عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.")
          toaster.create({
            title: "فشل الاتصال",
            description: "تعذّر الوصول للموديل. تحقق من صحة NVIDIA API Key.",
            type: "error",
          })
        }
      }
    } finally {
      setIsStreaming(false)
      setStreamController(null)
    }
  }, [activeChatId, selectedModel, settings, localMessages, isStreaming])

  const handleRegenerate = async () => {
    if (!activeChatId) return
    const msgs = localMessages[activeChatId] || []
    if (msgs.length < 2) return
    const lastUserMsg = [...msgs].reverse().find((m) => m.role === "user")
    if (!lastUserMsg) return
    const newMsgs = msgs.slice(0, -1)
    setLocalMessages(activeChatId, newMsgs)
    if (supabase) {
      supabase.from("messages").delete().eq("id", msgs[msgs.length - 1].id)
    }
    handleSend(lastUserMsg.content, [])
  }

  const showWelcome = messages.length === 0

  return (
    <Box h="100%" display="flex" flexDirection="column" bg="#0a0a0f" w="full">
      {/* Header */}
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
                    <Box as="span">جارٍ الإنشاء...</Box>
                  </HStack>
                ) : "جاهز"}
              </Text>
            </VStack>
          </HStack>
        </HStack>
      </Box>

      {/* Messages */}
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
            {/* Thinking indicator: shown when streaming but no content yet */}
            {isStreaming && messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content && (
              <ThinkingIndicator />
            )}
            <div ref={messagesEndRef} />
          </Box>
        )}
      </Box>

      {/* Model Selector */}
      <Box hideBelow="md">
        <ModelSelector mobile={false} />
      </Box>
      <Box hideFrom="md" flexShrink={0}>
        <ModelSelector mobile={true} />
      </Box>

      {/* Input */}
      <Box maxW={{ base: "full", md: "800px" }} mx="auto" w="full" px={{ base: "3", sm: "4", md: "6" }} pb={{ base: "3", md: "4" }} flexShrink={0}>
        <ChatInput onSend={handleSend} onStop={handleStop} />
      </Box>
    </Box>
  )
}

function ThinkingIndicator() {
  return (
    <Box
      display="flex"
      alignItems="flex-start"
      gap="3"
      mb="4"
      dir="ltr"
    >
      <Box
        w="32px"
        h="32px"
        borderRadius="full"
        bg="linear-gradient(135deg, #6366f1, #8b5cf6)"
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
        shadow="0 0 12px rgba(99,102,241,0.35)"
      >
        <Icon as={LuBrain} boxSize="15px" color="white" />
      </Box>
      <Box
        bg="rgba(15,15,26,0.9)"
        border="1px solid"
        borderColor="rgba(99,102,241,0.2)"
        borderRadius="2xl"
        px="4"
        py="3"
        maxW="240px"
      >
        <HStack gap="2" align="center">
          <Text fontSize="xs" color="gray.400">جارٍ التفكير</Text>
          <HStack gap="1">
            {[0, 1, 2].map((i) => (
              <Box
                key={i}
                w="6px"
                h="6px"
                borderRadius="full"
                bg="brand.500"
                style={{
                  animation: `thinkingDot 1.4s ease-in-out ${i * 0.2}s infinite`,
                  opacity: 0.3,
                }}
              />
            ))}
          </HStack>
        </HStack>
        <style>{`
          @keyframes thinkingDot {
            0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
            40% { opacity: 1; transform: scale(1.1); }
          }
        `}</style>
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
        كيف يمكنني مساعدتك اليوم؟
      </Heading>
      <Text color="gray.500" fontSize={{ base: "xs", md: "sm" }} mb={{ base: "6", md: "10" }} maxW="400px">
        أنا Shrpo AI — مساعدك الشامل للبرمجة والكتابة والتحليل والإبداع.
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
            textAlign="right"
            dir="rtl"
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
