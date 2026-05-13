import { useState } from "react"
import {
  Box,
  HStack,
  Text,
  Icon,
  IconButton,
  Badge,
  VStack,
} from "@chakra-ui/react"
import {
  AccordionRoot,
  AccordionItem,
  AccordionItemContent,
  AccordionItemTrigger,
} from "@/components/ui/accordion"
import {
  LuUser,
  LuCopy,
  LuCheck,
  LuRefreshCw,
  LuPencil,
  LuBrain,
  LuChevronDown,
} from "react-icons/lu"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import type { Message } from "@/types"
import "katex/dist/katex.min.css"

interface MessageBubbleProps {
  message: Message
  onRegenerate?: () => void
  onEdit?: (content: string) => void
  isLast?: boolean
  isStreaming?: boolean
}

export default function MessageBubble({
  message,
  onRegenerate,
  onEdit,
  isLast,
  isStreaming,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)

  const isUser = message.role === "user"

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveEdit = () => {
    if (onEdit) onEdit(editContent)
    setEditing(false)
  }

  return (
    <Box
      display="flex"
      gap={{ base: "2", md: "3" }}
      px={{ base: "2", md: "4" }}
      py={{ base: "2", md: "3" }}
      flexDir={isUser ? "row-reverse" : "row"}
      _hover={{ "& .msg-actions": { opacity: 1 } }}
      position="relative"
      alignItems="flex-start"
    >
      {/* Avatar */}
      <Box
        w={{ base: "28px", md: "32px" }}
        h={{ base: "28px", md: "32px" }}
        borderRadius="full"
        flexShrink={0}
        display="flex"
        alignItems="center"
        justifyContent="center"
        mt="0.5"
        bg={isUser
          ? "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))"
          : "linear-gradient(135deg, rgba(6,182,212,0.2), rgba(99,102,241,0.2))"}
        border="1px solid"
        borderColor={isUser ? "rgba(99,102,241,0.3)" : "rgba(6,182,212,0.2)"}
      >
        <Icon
          as={isUser ? LuUser : LuBrain}
          boxSize={{ base: "12px", md: "14px" }}
          color={isUser ? "brand.400" : "cyan.400"}
        />
      </Box>

      {/* Content */}
      <Box maxW={{ base: "88%", md: "75%" }} minW="0">
        {/* Role label + model */}
        <HStack gap="2" mb="1" flexDir={isUser ? "row-reverse" : "row"}>
          <Text fontSize="2xs" fontWeight="600" color={isUser ? "brand.400" : "cyan.400"} letterSpacing="0.06em" textTransform="uppercase">
            {isUser ? "You" : "Shrpo AI"}
          </Text>
          {message.model && !isUser && (
            <Badge size="xs" variant="subtle" colorPalette="gray" fontSize="2xs">
              {message.model.split("/").pop()?.split("-").slice(0, 2).join(" ")}
            </Badge>
          )}
        </HStack>

        {/* Bubble */}
        <Box
          bg={isUser
            ? "linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(139,92,246,0.15) 100%)"
            : "rgba(15,15,26,0.8)"}
          border="1px solid"
          borderColor={isUser ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.06)"}
          borderRadius={isUser ? "2xl 2xl 0 2xl" : "0 2xl 2xl 2xl"}
          px={{ base: "3", md: "4" }}
          py={{ base: "2.5", md: "3" }}
          backdropFilter="blur(10px)"
          position="relative"
          overflow="hidden"
        >
          {editing ? (
            <VStack align="stretch" gap="2">
              <Box
                as="textarea"
                value={editContent}
                onChange={(e: any) => setEditContent(e.target.value)}
                rows={4}
                bg="rgba(10,10,15,0.8)"
                border="1px solid"
                borderColor="rgba(99,102,241,0.3)"
                borderRadius="lg"
                color="white"
                fontSize="sm"
                p="2"
                resize="vertical"
                _focus={{ outline: "none", borderColor: "brand.500" }}
                style={{ fontFamily: "inherit" }}
              />
              <HStack gap="2" justify="flex-end">
                <Box
                  as="button"
                  px="3"
                  py="1"
                  borderRadius="lg"
                  fontSize="xs"
                  color="gray.400"
                  _hover={{ color: "white" }}
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Box>
                <Box
                  as="button"
                  px="3"
                  py="1"
                  borderRadius="lg"
                  fontSize="xs"
                  bg="brand.600"
                  color="white"
                  _hover={{ bg: "brand.500" }}
                  onClick={handleSaveEdit}
                >
                  Save & Regenerate
                </Box>
              </HStack>
            </VStack>
          ) : (
            <>
              {isUser ? (
                <Text
                  fontSize={{ base: "sm", md: "sm" }}
                  color="gray.200"
                  lineHeight="1.7"
                  whiteSpace="pre-wrap"
                  wordBreak="break-word"
                >
                  {message.content}
                </Text>
              ) : (
                <VStack align="stretch" gap="2">
                  {message.thinking && (
                    <AccordionRoot collapsible>
                      <AccordionItem value="thinking">
                        <AccordionItemTrigger
                          px="3"
                          py="2"
                          bg="rgba(99,102,241,0.08)"
                          _hover={{ bg: "rgba(99,102,241,0.12)" }}
                        >
                          <HStack gap="2">
                            <Icon as={LuBrain} boxSize="4" color="cyan.400" />
                            <Text fontSize="xs" fontWeight="600" color="cyan.300">
                              عملية التفكير
                            </Text>
                          </HStack>
                        </AccordionItemTrigger>
                        <AccordionItemContent
                          bg="rgba(10,10,20,0.6)"
                          px="3"
                          py="2.5"
                          fontSize="xs"
                          color="gray.300"
                          lineHeight="1.6"
                          whiteSpace="pre-wrap"
                          wordBreak="break-word"
                          maxH="200px"
                          overflow="auto"
                        >
                          {message.thinking}
                        </AccordionItemContent>
                      </AccordionItem>
                    </AccordionRoot>
                  )}
                  <Box
                    className="markdown-body"
                    fontSize={{ base: "sm", md: "sm" }}
                    color="gray.200"
                    lineHeight="1.8"
                    overflow="auto"
                    css={{
                    "& p": { marginBottom: "0.75em" },
                    "& p:last-child": { marginBottom: 0 },
                    "& h1, & h2, & h3": { fontWeight: "700", marginTop: "1em", marginBottom: "0.5em", color: "white" },
                    "& h1": { fontSize: "1.25em" },
                    "& h2": { fontSize: "1.1em" },
                    "& h3": { fontSize: "1em" },
                    "& ul, & ol": { paddingLeft: "1.5em", marginBottom: "0.75em" },
                    "& li": { marginBottom: "0.25em" },
                    "& blockquote": {
                      borderLeft: "3px solid rgba(99,102,241,0.5)",
                      paddingLeft: "1em",
                      color: "#94a3b8",
                      marginLeft: 0,
                    },
                    "& table": { width: "100%", borderCollapse: "collapse", marginBottom: "1em" },
                    "& th, & td": {
                      border: "1px solid rgba(99,102,241,0.2)",
                      padding: "0.4em 0.8em",
                      textAlign: "left",
                    },
                    "& th": { background: "rgba(99,102,241,0.1)", fontWeight: "600" },
                    "& a": { color: "#818cf8", textDecoration: "underline" },
                    "& hr": { border: "none", borderTop: "1px solid rgba(255,255,255,0.08)", margin: "1em 0" },
                    "& strong": { color: "white", fontWeight: "600" },
                    "& em": { color: "#cbd5e1" },
                    "& .katex": { color: "#e2e8f0", fontSize: "1.05em" },
                    "& .katex-display": { margin: "0.75em 0", overflowX: "auto", overflowY: "hidden" },
                    "& .katex-display > .katex": { textAlign: "center" },
                    "& .katex .base": { color: "#e2e8f0" },
                    "& .katex .mord, & .katex .mbin, & .katex .mrel, & .katex .mop, & .katex .mopen, & .katex .mclose": { color: "#e2e8f0" },
                    "& .katex .mfrac-line": { borderColor: "rgba(255,255,255,0.3)" },
                  }}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || "")
                        return !inline && match ? (
                          <Box
                            position="relative"
                            mb="0.75em"
                            borderRadius="xl"
                            overflow="auto"
                            border="1px solid"
                            borderColor="rgba(99,102,241,0.15)"
                            maxW="100%"
                          >
                            <HStack
                              px="3"
                              py="1.5"
                              bg="rgba(10,10,20,0.8)"
                              justify="space-between"
                              borderBottom="1px solid"
                              borderColor="rgba(99,102,241,0.1)"
                            >
                              <Badge size="xs" variant="subtle" colorPalette="brand" fontSize="2xs">
                                {match[1]}
                              </Badge>
                              <CopyCodeButton code={String(children).replace(/\n$/, "")} />
                            </HStack>
                            <SyntaxHighlighter
                              style={oneDark}
                              language={match[1]}
                              PreTag="div"
                              customStyle={{
                                margin: 0,
                                background: "rgba(10,10,18,0.9)",
                                fontSize: "0.75rem",
                                borderRadius: 0,
                              }}
                              {...props}
                            >
                              {String(children).replace(/\n$/, "")}
                            </SyntaxHighlighter>
                          </Box>
                        ) : (
                          <Box
                            as="code"
                            px="1.5"
                            py="0.5"
                            bg="rgba(99,102,241,0.12)"
                            borderRadius="md"
                            fontSize="0.85em"
                            color="brand.300"
                            fontFamily="mono"
                            {...props}
                          >
                            {children}
                          </Box>
                        )
                      },
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                  {isStreaming && (
                    <Box
                      display="inline-block"
                      w="2px"
                      h="14px"
                      bg="brand.400"
                      ml="1"
                      verticalAlign="middle"
                      style={{ animation: "blink 1s step-end infinite" }}
                    />
                  )}
                  </Box>
                </VStack>
              )}
            </>
          )}
        </Box>

        {/* Actions */}
        {!editing && (
          <HStack
            gap="1"
            mt="1"
            className="msg-actions"
            opacity={{ base: 1, md: 0 }}
            transition="opacity 0.2s"
            flexDir={isUser ? "row-reverse" : "row"}
          >
            <IconButton
              aria-label="Copy"
              variant="ghost"
              size="2xs"
              onClick={handleCopy}
              color="gray.600"
              _hover={{ color: "gray.300", bg: "rgba(255,255,255,0.05)" }}
              borderRadius="lg"
            >
              <Icon as={copied ? LuCheck : LuCopy} boxSize="11px" />
            </IconButton>
            {isUser && onEdit && (
              <IconButton
                aria-label="Edit"
                variant="ghost"
                size="2xs"
                onClick={() => setEditing(true)}
                color="gray.600"
                _hover={{ color: "gray.300", bg: "rgba(255,255,255,0.05)" }}
                borderRadius="lg"
              >
                <Icon as={LuPencil} boxSize="11px" />
              </IconButton>
            )}
            {!isUser && onRegenerate && isLast && (
              <IconButton
                aria-label="Regenerate"
                variant="ghost"
                size="2xs"
                onClick={onRegenerate}
                color="gray.600"
                _hover={{ color: "gray.300", bg: "rgba(255,255,255,0.05)" }}
                borderRadius="lg"
              >
                <Icon as={LuRefreshCw} boxSize="11px" />
              </IconButton>
            )}
          </HStack>
        )}
      </Box>
    </Box>
  )
}

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Box
      as="button"
      display="flex"
      alignItems="center"
      gap="1"
      px="2"
      py="0.5"
      borderRadius="md"
      fontSize="2xs"
      color="gray.500"
      _hover={{ color: "gray.300", bg: "rgba(255,255,255,0.05)" }}
      onClick={handleCopy}
      transition="all 0.15s"
    >
      <Icon as={copied ? LuCheck : LuCopy} boxSize="10px" />
      {copied ? "Copied" : "Copy"}
    </Box>
  )
}
