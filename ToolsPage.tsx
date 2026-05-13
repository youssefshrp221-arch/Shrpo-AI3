import { useState } from "react"
import {
  Box,
  VStack,
  HStack,
  Text,
  Icon,
  Heading,
  SimpleGrid,
  Textarea,
  Button,
  Badge,
  Input,
} from "@chakra-ui/react"
import {
  LuFileText,
  LuLanguages,
  LuBrainCircuit,
  LuWalletCards,
  LuCode,
  LuGraduationCap,
  LuArrowRight,
  LuStar,
  LuCopy,
  LuCheck,
} from "react-icons/lu"
import { useAppStore } from "@/store/appStore"
import { chatOnce } from "@/lib/nvidia"
import { toaster } from "@/components/ui/toaster"

interface Tool {
  id: string
  icon: any
  label: string
  description: string
  color: string
  placeholder: string
  action: string
  extra?: { label: string; key: string }
}

const TOOLS: Tool[] = [
  {
    id: "summarizer",
    icon: LuFileText,
    label: "Summarizer",
    description: "Condense long texts into clear, concise summaries",
    color: "blue",
    placeholder: "Paste your text here to summarize...",
    action: "Summarize this text concisely, highlighting the key points:\n\n",
  },
  {
    id: "translator",
    icon: LuLanguages,
    label: "Translator",
    description: "Translate text between any languages",
    color: "green",
    placeholder: "Enter text to translate...",
    action: "Translate the following text to English (or detect source language and translate to English if already English, translate to Spanish):\n\n",
    extra: { label: "Target Language", key: "lang" },
  },
  {
    id: "quiz",
    icon: LuBrainCircuit,
    label: "Quiz Generator",
    description: "Generate quiz questions from any content",
    color: "orange",
    placeholder: "Paste your study material here...",
    action: "Generate 5 multiple-choice quiz questions with answers based on this content:\n\n",
  },
  {
    id: "flashcards",
    icon: LuWalletCards,
    label: "Flashcard Generator",
    description: "Create study flashcards automatically",
    color: "cyan",
    placeholder: "Enter your study content...",
    action: "Create 8 study flashcards (Q: ... A: ...) from this content:\n\n",
  },
  {
    id: "coding",
    icon: LuCode,
    label: "Coding Assistant",
    description: "Debug, review, and improve your code",
    color: "brand",
    placeholder: "Paste your code here...",
    action: "Review this code, identify any bugs or improvements, and provide a corrected version with explanations:\n\n",
  },
  {
    id: "study",
    icon: LuGraduationCap,
    label: "Study Helper",
    description: "Break down complex topics for easy learning",
    color: "pink",
    placeholder: "Enter a topic or concept to study...",
    action: "Explain this topic clearly with examples, key concepts, and a summary. Make it easy to understand:\n\n",
  },
]

export default function ToolsPage() {
  const { selectedModel, settings, apiKey } = useAppStore()
  const [activeTool, setActiveTool] = useState<Tool | null>(null)
  const [input, setInput] = useState("")
  const [extra, setExtra] = useState("")
  const [output, setOutput] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const runTool = async () => {
    if (!input.trim() || !apiKey) return
    setLoading(true)
    setOutput("")
    try {
      const prompt = activeTool!.action + input + (extra ? `\n\nTarget: ${extra}` : "")
      const result = await chatOnce(
        [{ role: "user", content: prompt }],
        selectedModel,
        settings.temperature,
        apiKey
      )
      setOutput(result)
    } catch (err: any) {
      toaster.create({ title: "Error", description: err.message, type: "error" })
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (activeTool) {
    return (
      <Box h="100%" bg="#0a0a0f" display="flex" flexDirection="column">
        {/* Header */}
        <Box
          px={{ base: "3", md: "6" }}
          py={{ base: "2", md: "3" }}
          borderBottom="1px solid"
          borderColor="rgba(99,102,241,0.12)"
          bg="rgba(10,10,15,0.95)"
          backdropFilter="blur(20px)"
          flexShrink={0}
        >
          <HStack justify="space-between" gap="2">
            <HStack gap={{ base: "2", md: "3" }} minW="0">
              <Box
                w={{ base: "32px", md: "36px" }}
                h={{ base: "32px", md: "36px" }}
                borderRadius="xl"
                bg={`rgba(99,102,241,0.15)`}
                display="flex"
                alignItems="center"
                justifyContent="center"
                flexShrink={0}
              >
                <Icon as={activeTool.icon} color="brand.400" boxSize={{ base: "14px", md: "16px" }} />
              </Box>
              <VStack align="start" gap="0" minW="0">
                <Text fontWeight="700" fontSize={{ base: "xs", md: "sm" }} color="white">{activeTool.label}</Text>
                <Text fontSize="2xs" color="gray.600" isTruncated>{activeTool.description}</Text>
              </VStack>
            </HStack>
            <Button
              size="xs"
              variant="ghost"
              color="gray.500"
              _hover={{ color: "white" }}
              onClick={() => { setActiveTool(null); setInput(""); setOutput("") }}
              borderRadius="xl"
              flexShrink={0}
            >
              <Box as="span" hideBelow="sm">Back to Tools</Box>
              <Box as="span" hideFrom="sm">Back</Box>
            </Button>
          </HStack>
        </Box>

        <Box flex="1" overflow="auto" p={{ base: "3", md: "6" }} maxW="900px" mx="auto" w="full">
          <VStack gap={{ base: "3", md: "4" }} align="stretch">
            {activeTool.extra && (
              <Input
                placeholder={activeTool.extra.label}
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                bg="rgba(15,15,26,0.8)"
                border="1px solid"
                borderColor="rgba(99,102,241,0.2)"
                color="white"
                fontSize="sm"
                borderRadius="xl"
                _focus={{ borderColor: "brand.500", outline: "none" }}
                maxW={{ base: "full", md: "300px" }}
              />
            )}

            <Textarea
              placeholder={activeTool.placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              bg="rgba(15,15,26,0.8)"
              border="1px solid"
              borderColor="rgba(99,102,241,0.2)"
              color="white"
              fontSize="sm"
              borderRadius="xl"
              rows={8}
              _focus={{ borderColor: "brand.500", outline: "none" }}
              resize="vertical"
            />

            <Button
              onClick={runTool}
              loading={loading}
              loadingText="Processing..."
              bg="linear-gradient(135deg, #6366f1, #8b5cf6)"
              color="white"
              borderRadius="xl"
              _hover={{ shadow: "0 0 20px rgba(99,102,241,0.4)" }}
              _active={{ transform: "scale(0.98)" }}
              alignSelf="flex-start"
              px="6"
              minH="44px"
            >
              <Icon as={LuStar} mr="2" boxSize="14px" />
              Run {activeTool.label}
            </Button>

            {output && (
              <Box
                bg="rgba(15,15,26,0.8)"
                border="1px solid"
                borderColor="rgba(16,185,129,0.2)"
                borderRadius="2xl"
                p={{ base: "3", md: "5" }}
                position="relative"
              >
                <HStack justify="space-between" mb="3">
                  <HStack gap="2">
                    <Icon as={LuStar} color="green.400" boxSize="14px" />
                    <Text fontSize="xs" fontWeight="600" color="green.400">Result</Text>
                  </HStack>
                  <Box
                    as="button"
                    display="flex"
                    alignItems="center"
                    gap="1"
                    px="2"
                    py="1"
                    borderRadius="lg"
                    fontSize="2xs"
                    color="gray.500"
                    _hover={{ color: "gray.300" }}
                    onClick={handleCopy}
                  >
                    <Icon as={copied ? LuCheck : LuCopy} boxSize="11px" />
                    {copied ? "Copied" : "Copy"}
                  </Box>
                </HStack>
                <Text
                  fontSize="sm"
                  color="gray.200"
                  lineHeight="1.8"
                  whiteSpace="pre-wrap"
                  wordBreak="break-word"
                >
                  {output}
                </Text>
              </Box>
            )}
          </VStack>
        </Box>
      </Box>
    )
  }

  return (
    <Box h="100%" bg="#0a0a0f" overflow="auto">
      <Box maxW="900px" mx="auto" px={{ base: "4", md: "6" }} py={{ base: "5", md: "8" }}>
        <VStack align="start" gap="1" mb={{ base: "5", md: "8" }}>
          <Heading fontSize={{ base: "xl", md: "2xl" }} fontWeight="800" color="white">AI Tools</Heading>
          <Text fontSize={{ base: "2xs", md: "sm" }} color="gray.500">Powerful AI utilities for every task</Text>
        </VStack>

        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={{ base: "3", md: "4" }}>
          {TOOLS.map((tool) => (
            <Box
              key={tool.id}
              bg="rgba(15,15,26,0.8)"
              border="1px solid"
              borderColor="rgba(99,102,241,0.12)"
              borderRadius="2xl"
              p={{ base: "4", md: "5" }}
              cursor="pointer"
              _hover={{
                borderColor: "rgba(99,102,241,0.35)",
                transform: "translateY(-2px)",
                shadow: "0 10px 30px rgba(0,0,0,0.3)",
                bg: "rgba(99,102,241,0.06)",
              }}
              _active={{ transform: "scale(0.98)", bg: "rgba(99,102,241,0.08)" }}
              onClick={() => { setActiveTool(tool); setInput(""); setOutput("") }}
              transition="all 0.2s"
              position="relative"
              overflow="hidden"
              group
            >
              <Box
                position="absolute"
                top={0}
                left={0}
                right={0}
                h="2px"
                bg="linear-gradient(90deg, #6366f1, #8b5cf6)"
                opacity={0}
                _groupHover={{ opacity: 1 }}
                transition="opacity 0.2s"
              />
              <HStack mb="3" justify="space-between">
                <Box
                  w={{ base: "36px", md: "42px" }}
                  h={{ base: "36px", md: "42px" }}
                  borderRadius="xl"
                  bg="rgba(99,102,241,0.12)"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon as={tool.icon} color="brand.400" boxSize={{ base: "16px", md: "18px" }} />
                </Box>
                <Icon as={LuArrowRight} color="gray.700" boxSize="14px" />
              </HStack>
              <Text fontWeight="700" fontSize={{ base: "xs", md: "sm" }} color="white" mb="1">{tool.label}</Text>
              <Text fontSize={{ base: "2xs", md: "xs" }} color="gray.500" lineHeight="1.5">{tool.description}</Text>
            </Box>
          ))}
        </SimpleGrid>
      </Box>
    </Box>
  )
}
