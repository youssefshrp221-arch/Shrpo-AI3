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

export default function ChatInput({ onSend, onStop }: ChatInputProps) {
  const { isStreaming } = useAppStore()
  const [input, setInput] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = () => {
    if (!input.trim() && attachments.length === 0) return
    if (isStreaming) return
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
    // Auto-grow
    const el = e.target
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 200) + "px"
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newAttachments = files.map((f) => {
      const type = f.type.startsWith("image/")
        ? "image"
        : f.type === "application/pdf"
        ? "pdf"
        : f.type.startsWith("audio/")
        ? "audio"
        : f.type.startsWith("video/")
        ? "video"
        : "file"
      return {
        id: uuidv4(),
        type: type as Attachment["type"],
        name: f.name,
        url: URL.createObjectURL(f),
        size: f.size,
      }
    })
    setAttachments((prev) => [...prev, ...newAttachments])
    e.target.value = ""
  }

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const attachmentIcon = (type: Attachment["type"]) => {
    if (type === "image") return LuImage
    if (type === "pdf") return LuFileText
    if (type === "audio") return LuVolume2
    return LuPaperclip
  }

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
              {att.type === "image" ? (
                <Box as="img" src={att.url} w="20px" h="20px" objectFit="cover" borderRadius="sm" flexShrink={0} />
              ) : (
                <Icon as={attachmentIcon(att.type)} boxSize="12px" color="brand.400" flexShrink={0} />
              )}
              <Text fontSize={{ base: "2xs", md: "xs" }} color="gray.400" maxW={{ base: "80px", md: "100px" }} isTruncated>
                {att.name}
              </Text>
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

      {/* Input area - responsive borderRadius and padding */}
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
        {/* Textarea - responsive padding */}
        <Box px={{ base: "3", md: "4" }} pt={{ base: "2.5", md: "3" }} pb={{ base: "2", md: "2" }}>
          <Box
            as="textarea"
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={{ base: "Message Shrpo...", md: "Message Shrpo AI... (Enter to send, Shift+Enter for new line)" }}
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
            style={{
              fontFamily: "inherit",
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

        {/* Bottom toolbar - responsive layout */}
        <Flex px={{ base: "2", md: "3" }} pb={{ base: "2", md: "3" }} gap={{ base: "1", md: "2" }} alignItems="center" justify="space-between" minW="0" w="full">
          <Flex gap={{ base: "0.5", md: "1" }} alignItems="center" flexShrink={0}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,audio/*,video/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <IconButton
              aria-label="Attach file"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              color="gray.600"
              _hover={{ color: "brand.400", bg: "rgba(99,102,241,0.1)" }}
              borderRadius="lg"
              h="7"
              minW="7"
              flexShrink={0}
            >
              <Icon as={LuPaperclip} boxSize={{ base: "13px", md: "14px" }} />
            </IconButton>
            <IconButton
              aria-label="Voice input"
              variant="ghost"
              size="sm"
              color={isRecording ? "red.400" : "gray.600"}
              _hover={{ color: isRecording ? "red.300" : "brand.400", bg: "rgba(99,102,241,0.1)" }}
              borderRadius="lg"
              h="7"
              minW="7"
              flexShrink={0}
            >
              <Icon as={LuMic} boxSize={{ base: "13px", md: "14px" }} />
            </IconButton>
          </Flex>

          <Flex gap={{ base: "1", md: "2" }} alignItems="center" flexShrink={0}>
            {isStreaming ? (
              <Box
                as="button"
                display="flex"
                alignItems="center"
                gap={{ base: "1", md: "1.5" }}
                px={{ base: "2", md: "3" }}
                py={{ base: "1", md: "1.5" }}
                bg="rgba(239,68,68,0.15)"
                border="1px solid"
                borderColor="rgba(239,68,68,0.3)"
                borderRadius="xl"
                color="red.400"
                fontSize={{ base: "2xs", md: "xs" }}
                fontWeight="600"
                cursor="pointer"
                _hover={{ bg: "rgba(239,68,68,0.25)", borderColor: "rgba(239,68,68,0.5)" }}
                onClick={onStop}
                transition="all 0.15s"
                style={{ animation: "pulse 2s ease-in-out infinite" }}
                whiteSpace="nowrap"
              >
                <Icon as={LuCircleStop} boxSize={{ base: "12px", md: "13px" }} flexShrink={0} />
                <Box hideBelow="sm">Stop</Box>
              </Box>
            ) : (
              <Box
                as="button"
                display="flex"
                alignItems="center"
                justifyContent="center"
                w={{ base: "7", md: "8" }}
                h={{ base: "7", md: "8" }}
                bg={input.trim() || attachments.length > 0 ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(99,102,241,0.15)"}
                borderRadius="xl"
                color={input.trim() || attachments.length > 0 ? "white" : "gray.700"}
                cursor={input.trim() || attachments.length > 0 ? "pointer" : "not-allowed"}
                _hover={input.trim() || attachments.length > 0 ? { shadow: "0 0 15px rgba(99,102,241,0.4)", transform: "scale(1.05)" } : {}}
                _active={input.trim() || attachments.length > 0 ? { transform: "scale(0.95)" } : {}}
                onClick={handleSubmit}
                transition="all 0.15s"
                minW={{ base: "7", md: "8" }}
                flexShrink={0}
              >
                <Icon as={LuSend} boxSize={{ base: "12px", md: "13px" }} />
              </Box>
            )}
          </Flex>
        </Flex>
      </Box>

      <Text fontSize="2xs" color="gray.700" textAlign="center" mt="2" px="2">
        Shrpo AI may produce inaccurate information. Verify important details.
      </Text>
    </Box>
  )
}
