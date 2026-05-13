import { useState, useRef, useCallback } from "react"
import {
  Box,
  HStack,
  Icon,
  IconButton,
  Text,
  Flex,
} from "@chakra-ui/react"
import {
  LuSend,
  LuPaperclip,
  LuMic,
  LuCircleStop,
  LuX,
  LuImage,
  LuFileText,
  LuVolume2,
} from "react-icons/lu"
import { useAppStore } from "@/store/appStore"
import type { Attachment } from "@/types"
import { v4 as uuidv4 } from "uuid"

interface ChatInputProps {
  onSend: (content: string, attachments: Attachment[]) => void
  onStop: () => void
}

/**
 * Convert a File to a base64 data URL
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Extract text from plain text files
 */
async function extractFileText(file: File): Promise<string | undefined> {
  const isText = file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md") || file.name.endsWith(".csv")
  if (!isText) return undefined
  return await file.text()
}

export default function ChatInput({ onSend, onStop }: ChatInputProps) {
  const { isStreaming } = useAppStore()
  const [input, setInput] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = () => {
    if ((!input.trim() && attachments.length === 0) || isStreaming || isLoading) return
    onSend(input.trim(), attachments)
    setInput("")
    setAttachments([])
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 200) + "px"
  }

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setIsLoading(true)

    try {
      const newAttachments: Attachment[] = await Promise.all(
        files.map(async (f) => {
          const type: Attachment["type"] = f.type.startsWith("image/")
            ? "image"
            : f.type === "application/pdf"
            ? "pdf"
            : f.type.startsWith("audio/")
            ? "audio"
            : f.type.startsWith("video/")
            ? "video"
            : "file"

          const att: Attachment = {
            id: uuidv4(),
            type,
            name: f.name,
            url: URL.createObjectURL(f),
            size: f.size,
          }

          // Convert images to base64 for API transmission and preview
          if (type === "image") {
            att.base64 = await fileToBase64(f)
          }

          // Extract text from text files for context
          const fileText = await extractFileText(f)
          if (fileText) {
            att.fileText = fileText
          }

          return att
        })
      )

      setAttachments((prev) => [...prev, ...newAttachments])
    } catch (err) {
      console.error("File processing error:", err)
    } finally {
      setIsLoading(false)
    }
    e.target.value = ""
  }, [])

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const attachmentIcon = (type: Attachment["type"]) => {
    if (type === "image") return LuImage
    if (type === "pdf") return LuFileText
    if (type === "audio") return LuVolume2
    return LuPaperclip
  }

  const canSend = (input.trim() || attachments.length > 0) && !isStreaming && !isLoading

  return (
    <Box
      borderTop="1px solid"
      borderColor="rgba(99,102,241,0.12)"
      bg="rgba(10,10,15,0.95)"
      backdropFilter="blur(20px)"
      px={{ base: "2.5", sm: "3", md: "6" }}
      py={{ base: "3", md: "4" }}
      w="full"
    >
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <HStack gap="2" mb="3" flexWrap="wrap" w="full">
          {attachments.map((att) => (
            <Box
              key={att.id}
              display="flex"
              alignItems="center"
              gap="1"
              bg="rgba(99,102,241,0.1)"
              border="1px solid"
              borderColor="rgba(99,102,241,0.2)"
              borderRadius="lg"
              px={{ base: "2", md: "2.5" }}
              py="1"
              position="relative"
              minW="0"
            >
              {att.type === "image" && att.base64 ? (
                <Box as="img" src={att.base64} w="28px" h="28px" objectFit="cover" borderRadius="sm" flexShrink={0} />
              ) : att.type === "image" ? (
                <Box as="img" src={att.url} w="28px" h="28px" objectFit="cover" borderRadius="sm" flexShrink={0} />
              ) : (
                <Icon as={attachmentIcon(att.type)} boxSize="12px" color="brand.400" flexShrink={0} />
              )}
              <Text fontSize={{ base: "2xs", md: "xs" }} color="gray.400" maxW={{ base: "80px", md: "100px" }} isTruncated>
                {att.name}
              </Text>
              {att.type === "image" && (
                <Text fontSize="2xs" color="cyan.600" fontWeight="600">IMG</Text>
              )}
              {att.fileText && (
                <Text fontSize="2xs" color="green.600" fontWeight="600">TXT</Text>
              )}
              <Icon
                as={LuX}
                boxSize="10px"
                color="gray.600"
                cursor="pointer"
                _hover={{ color: "white" }}
                onClick={() => removeAttachment(att.id)}
                flexShrink={0}
              />
            </Box>
          ))}
        </HStack>
      )}

      {/* Input area */}
      <Box
        bg="rgba(15,15,26,0.8)"
        border="1px solid"
        borderColor="rgba(99,102,241,0.2)"
        borderRadius={{ base: "xl", md: "2xl" }}
        overflow="hidden"
        _focusWithin={{
          borderColor: "rgba(99,102,241,0.45)",
          shadow: "0 0 0 1px rgba(99,102,241,0.2)",
        }}
        transition="all 0.2s"
        w="full"
      >
        {/* Textarea */}
        <Box px={{ base: "3", md: "4" }} pt={{ base: "2.5", md: "3" }} pb={{ base: "2", md: "2" }}>
          <Box
            as="textarea"
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="اكتب رسالتك... (Enter للإرسال، Shift+Enter لسطر جديد)"
            rows={1}
            w="full"
            bg="transparent"
            border="none"
            outline="none"
            resize="none"
            color="white"
            fontSize={{ base: "sm", md: "base" }}
            lineHeight="1.6"
            maxW="full"
            dir="auto"
            style={{
              fontFamily: "'Cairo', 'Inter', sans-serif",
              overflow: "hidden",
              minHeight: "24px",
              maxHeight: "200px",
              boxSizing: "border-box",
            }}
            css={{
              "&::placeholder": { color: "#4b5563" },
            }}
          />
        </Box>

        {/* Bottom toolbar */}
        <Flex px={{ base: "2", md: "3" }} pb={{ base: "2", md: "3" }} gap={{ base: "1", md: "2" }} alignItems="center" justify="space-between" minW="0" w="full">
          <Flex gap={{ base: "0.5", md: "1" }} alignItems="center" flexShrink={0}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,audio/*,video/*,text/plain,text/markdown,.txt,.md,.csv"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <IconButton
              aria-label="إرفاق ملف"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              color={isLoading ? "brand.400" : "gray.600"}
              _hover={{ color: "brand.400", bg: "rgba(99,102,241,0.1)" }}
              borderRadius="lg"
              h="7" minW="7" flexShrink={0}
              disabled={isLoading}
            >
              <Icon as={LuPaperclip} boxSize={{ base: "13px", md: "14px" }} />
            </IconButton>
            <IconButton
              aria-label="إدخال صوتي"
              variant="ghost"
              size="sm"
              color="gray.600"
              _hover={{ color: "brand.400", bg: "rgba(99,102,241,0.1)" }}
              borderRadius="lg"
              h="7" minW="7" flexShrink={0}
            >
              <Icon as={LuMic} boxSize={{ base: "13px", md: "14px" }} />
            </IconButton>
          </Flex>

          <Flex gap={{ base: "1", md: "2" }} alignItems="center" flexShrink={0}>
            {isStreaming ? (
              <Box
                as="button"
                display="flex" alignItems="center" gap={{ base: "1", md: "1.5" }}
                px={{ base: "2", md: "3" }} py={{ base: "1", md: "1.5" }}
                bg="rgba(239,68,68,0.15)" border="1px solid" borderColor="rgba(239,68,68,0.3)"
                borderRadius="xl" color="red.400"
                fontSize={{ base: "2xs", md: "xs" }} fontWeight="600"
                cursor="pointer"
                _hover={{ bg: "rgba(239,68,68,0.25)", borderColor: "rgba(239,68,68,0.5)" }}
                onClick={onStop}
                transition="all 0.15s"
                style={{ animation: "pulse 2s ease-in-out infinite" }}
                whiteSpace="nowrap"
              >
                <Icon as={LuCircleStop} boxSize={{ base: "12px", md: "13px" }} flexShrink={0} />
                <Box hideBelow="sm">إيقاف</Box>
              </Box>
            ) : (
              <Box
                as="button"
                display="flex" alignItems="center" justifyContent="center"
                w={{ base: "7", md: "8" }} h={{ base: "7", md: "8" }}
                bg={canSend ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(99,102,241,0.15)"}
                borderRadius="xl"
                color={canSend ? "white" : "gray.700"}
                cursor={canSend ? "pointer" : "not-allowed"}
                _hover={canSend ? { shadow: "0 0 15px rgba(99,102,241,0.4)", transform: "scale(1.05)" } : {}}
                _active={canSend ? { transform: "scale(0.95)" } : {}}
                onClick={handleSubmit}
                transition="all 0.15s"
                minW={{ base: "7", md: "8" }} flexShrink={0}
              >
                <Icon as={LuSend} boxSize={{ base: "12px", md: "13px" }} />
              </Box>
            )}
          </Flex>
        </Flex>
      </Box>

      <Text fontSize="2xs" color="gray.700" textAlign="center" mt="2" px="2">
        Shrpo AI قد يُنتج معلومات غير دقيقة. تحقق من التفاصيل المهمة.
      </Text>
    </Box>
  )
}
