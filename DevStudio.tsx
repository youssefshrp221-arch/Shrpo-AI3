import { useState, useEffect, useCallback } from "react"
import Editor from "@monaco-editor/react"
import {
  Box,
  HStack,
  VStack,
  Text,
  Button,
  Flex,
  Badge,
  Textarea,
  Icon,
  Spinner,
  useBreakpointValue,
} from "@chakra-ui/react"
import {
  LuTerminal,
  LuPlay,
  LuSave,
  LuRefreshCw,
  LuFileCode,
  LuFolder,
  LuSend,
  LuCheck,
  LuTriangleAlert,
  LuX,
  LuChevronRight,
  LuSparkles,
  LuPanelLeft,
  LuCode,
} from "react-icons/lu"
import { toaster } from "@/components/ui/toaster"

interface FileItem {
  path: string
  isOpen?: boolean
}

const CODER_MODEL = "qwen/qwen3-coder-480b-a35b-instruct"

type PanelId = "explorer" | "editor" | "ai"

export default function DevStudio() {
  const isMobile = useBreakpointValue({ base: true, md: false })
  const [activePanel, setActivePanel] = useState<PanelId>("explorer")

  const [files, setFiles] = useState<string[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>("")
  const [originalContent, setOriginalContent] = useState<string>("")
  const [isDirty, setIsDirty] = useState(false)
  const [loadingFile, setLoadingFile] = useState(false)
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiResponse, setAiResponse] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [pendingCode, setPendingCode] = useState<string | null>(null)
  const [openFiles, setOpenFiles] = useState<string[]>([])

  // Load file list
  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/dev/files")
      const data = await res.json()
      if (data.files) {
        setFiles(data.files.sort())
      }
    } catch (err) {
      console.error("Failed to load files", err)
    }
  }, [])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  // Open a file
  const openFile = async (filePath: string) => {
    setLoadingFile(true)
    try {
      const res = await fetch(`/api/dev/file?path=${encodeURIComponent(filePath)}`)
      const data = await res.json()
      if (data.content !== undefined) {
        setActiveFile(filePath)
        setFileContent(data.content)
        setOriginalContent(data.content)
        setIsDirty(false)
        setAiResponse("")
        setPendingCode(null)
        if (!openFiles.includes(filePath)) {
          setOpenFiles((prev) => [...prev, filePath])
        }
        if (isMobile) setActivePanel("editor")
      }
    } catch (err) {
      toaster.create({ title: "Error loading file", type: "error" })
    } finally {
      setLoadingFile(false)
    }
  }

  // Send AI request
  const runAI = async () => {
    if (!aiPrompt.trim() || !activeFile) return
    setAiLoading(true)
    setAiResponse("")
    setPendingCode(null)

    const system = `You are Shrpo Dev AI. You are editing the file: ${activeFile}.\n\nCurrent file content:\n\n\`\`\`${getLanguage(activeFile)}\n${fileContent}\n\`\`\`\n\nRules:\n- Only return the COMPLETE updated file code (no explanations outside the code unless necessary).\n- Include ALL unchanged parts as they are.\n- If the user's request is a bug fix, carefully identify and fix the issue.\n- If the user asks for a feature, add it without breaking existing code.\n- Wrap ONLY the final code output in a markdown code block with the language tag.`

    try {
      const response = await fetch("/api/dev/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: system },
            { role: "user", content: aiPrompt },
          ],
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${response.status}`)
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let fullText = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === "data: [DONE]") continue
          if (trimmed.startsWith("data: ")) {
            try {
              const json = JSON.parse(trimmed.slice(6))
              const delta = json?.choices?.[0]?.delta?.content
              if (delta) {
                fullText += delta
                setAiResponse(fullText)
              }
            } catch {}
          }
        }
      }

      // Try to extract code block from response
      const codeBlockMatch = fullText.match(/```(?:[a-zA-Z0-9]*)?\n?([\s\S]*?)```$/)
      if (codeBlockMatch) {
        setPendingCode(codeBlockMatch[1].trim())
      } else {
        setPendingCode(fullText.trim())
      }
    } catch (err: any) {
      toaster.create({ title: "AI Error", description: err.message, type: "error" })
    } finally {
      setAiLoading(false)
    }
  }

  // Apply AI-generated code
  const applyChanges = async () => {
    if (!pendingCode || !activeFile) return
    setFileContent(pendingCode)
    setIsDirty(true)
    setPendingCode(null)
    toaster.create({ title: "Changes applied to editor", type: "info" })
  }

  // Save file
  const saveFile = async () => {
    if (!activeFile || !isDirty) return
    try {
      const res = await fetch("/api/dev/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: activeFile, content: fileContent }),
      })
      const data = await res.json()
      if (data.success) {
        setOriginalContent(fileContent)
        setIsDirty(false)
        toaster.create({ title: "Saved — refresh to see changes", type: "success" })
      } else {
        throw new Error(data.error || "Save failed")
      }
    } catch (err: any) {
      toaster.create({ title: "Save failed", description: err.message, type: "error" })
    }
  }

  const getLanguage = (path: string) => {
    if (path.endsWith(".tsx") || path.endsWith(".ts")) return "typescript"
    if (path.endsWith(".jsx") || path.endsWith(".js")) return "javascript"
    if (path.endsWith(".css")) return "css"
    if (path.endsWith(".json")) return "json"
    if (path.endsWith(".html")) return "html"
    if (path.endsWith(".md")) return "markdown"
    return "text"
  }

  const closeFile = (filePath: string) => {
    setOpenFiles((prev) => prev.filter((f) => f !== filePath))
    if (activeFile === filePath) {
      const remaining = openFiles.filter((f) => f !== filePath)
      if (remaining.length > 0) {
        openFile(remaining[remaining.length - 1])
      } else {
        setActiveFile(null)
        setFileContent("")
        setOriginalContent("")
      }
    }
  }

  // Group files by folder
  const fileTree: Record<string, string[]> = {}
  files.forEach((f) => {
    const parts = f.split("/")
    const folder = parts.length > 1 ? parts[0] : "(root)"
    if (!fileTree[folder]) fileTree[folder] = []
    fileTree[folder].push(f)
  })

  const panelBtn = (id: PanelId, label: string, icon: any, count?: number | string) => (
    <Button
      key={id}
      size="sm"
      flex="1"
      variant={activePanel === id ? "solid" : "ghost"}
      colorScheme={activePanel === id ? "brand" : undefined}
      bg={activePanel === id ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "transparent"}
      color={activePanel === id ? "white" : "gray.500"}
      borderRadius="0"
      borderTop={activePanel === id ? "2px solid" : "none"}
      borderColor="brand.400"
      py="3"
      h="auto"
      onClick={() => setActivePanel(id)}
    >
      <VStack gap="0.5">
        <Icon as={icon} boxSize="18px" />
        <Text fontSize="2xs">{label}</Text>
        {count !== undefined && (
          <Text fontSize="2xs" opacity={0.7}>{count}</Text>
        )}
      </VStack>
    </Button>
  )

  return (
    <Box h="100%" bg="#0a0a0f" display="flex" flexDirection="column" overflow="hidden">
      {/* Header */}
      <Box
        px={{ base: "3", md: "4" }}
        py="2"
        borderBottom="1px solid"
        borderColor="rgba(99,102,241,0.15)"
        bg="rgba(10,10,15,0.95)"
        flexShrink={0}
      >
        <HStack gap="2" alignItems="center" flexWrap="wrap">
          <Icon as={LuTerminal} boxSize="18px" color="brand.400" />
          <Text fontSize="sm" fontWeight="700" color="white">
            Dev Studio
          </Text>
          <Badge size="sm" colorPalette="brand" variant="subtle" fontSize="2xs">
            {CODER_MODEL}
          </Badge>
          <Badge size="sm" colorPalette="green" variant="subtle" fontSize="2xs">
            Active
          </Badge>
          <HStack ml="auto" gap="2">
            <Button
              size="xs"
              onClick={loadFiles}
              variant="ghost"
              color="gray.400"
              _hover={{ color: "white", bg: "rgba(99,102,241,0.1)" }}
            >
              <Icon as={LuRefreshCw} boxSize="12px" />
            </Button>
          </HStack>
        </HStack>
      </Box>

      {/* Body */}
      <Flex flex="1" overflow="hidden" direction={{ base: "column", md: "row" }}>
        {/* File Explorer */}
        <Box
          w={{ base: "full", md: "220px" }}
          flexShrink={0}
          borderRight={{ base: "none", md: "1px solid" }}
          borderBottom={{ base: "1px solid", md: "none" }}
          borderColor="rgba(99,102,241,0.1)"
          bg="rgba(10,10,15,0.6)"
          overflowY="auto"
          py="2"
          display={{ base: isMobile && activePanel !== "explorer" ? "none" : "block", md: "block" }}
        >
          <Text fontSize="2xs" color="gray.600" fontWeight="700" px="3" py="1" letterSpacing="0.08em" textTransform="uppercase">
            Explorer
          </Text>
          {Object.entries(fileTree).map(([folder, folderFiles]) => (
            <Box key={folder} mb="1">
              <HStack px="3" py="1" gap="1.5">
                <Icon as={LuFolder} boxSize="10px" color="gray.600" />
                <Text fontSize="xs" color="gray.500" fontWeight="600">{folder}</Text>
              </HStack>
              {folderFiles.map((f) => {
                const fileName = f.split("/").pop() || f
                const isActive = activeFile === f
                return (
                  <Box
                    key={f}
                    display="flex"
                    alignItems="center"
                    gap="1.5"
                    px="5"
                    py="1.5"
                    cursor="pointer"
                    borderRadius="md"
                    color={isActive ? "brand.300" : "gray.500"}
                    bg={isActive ? "rgba(99,102,241,0.12)" : "transparent"}
                    _hover={{ bg: "rgba(99,102,241,0.08)" }}
                    onClick={() => openFile(f)}
                  >
                    <Icon as={LuFileCode} boxSize="10px" color={isActive ? "brand.400" : "gray.600"} />
                    <Text fontSize="xs" fontWeight={isActive ? "600" : "400"} noOfLines={1}>
                      {fileName}
                    </Text>
                  </Box>
                )
              })}
            </Box>
          ))}
        </Box>

        {/* Editor + AI Panel */}
        <Flex flex="1" direction="column" overflow="hidden"
          display={{ base: isMobile && activePanel === "explorer" ? "none" : "flex", md: "flex" }}
        >
          {/* Tabs */}
          {openFiles.length > 0 && (
            <HStack
              gap="0"
              borderBottom="1px solid"
              borderColor="rgba(99,102,241,0.1)"
              overflowX="auto"
              flexShrink={0}
            >
              {openFiles.map((f) => {
                const name = f.split("/").pop() || f
                const isActive = activeFile === f
                const modified = isActive && isDirty
                return (
                  <HStack
                    key={f}
                    px="3"
                    py="1.5"
                    gap="1.5"
                    cursor="pointer"
                    borderRight="1px solid"
                    borderColor="rgba(99,102,241,0.1)"
                    bg={isActive ? "rgba(99,102,241,0.08)" : "transparent"}
                    color={isActive ? "brand.300" : "gray.500"}
                    _hover={{ bg: "rgba(99,102,241,0.06)" }}
                    onClick={() => openFile(f)}
                    flexShrink={0}
                  >
                    <Icon as={LuFileCode} boxSize="10px" />
                    <Text fontSize="2xs" fontWeight={isActive ? "600" : "400"} whiteSpace="nowrap">
                      {name}{modified ? " •" : ""}
                    </Text>
                    <Box
                      as="span"
                      display="inline-flex"
                      alignItems="center"
                      justifyContent="center"
                      w="14px"
                      h="14px"
                      borderRadius="sm"
                      cursor="pointer"
                      _hover={{ bg: "rgba(239,68,68,0.2)", color: "red.400" }}
                      onClick={(e) => { e.stopPropagation(); closeFile(f) }}
                    >
                      <Icon as={LuX} boxSize="10px" />
                    </Box>
                  </HStack>
                )
              })}
            </HStack>
          )}

          <Flex flex="1" overflow="hidden" direction={{ base: "column", md: "row" }}>
            {/* Editor */}
            <Box
              flex="1"
              overflow="hidden"
              position="relative"
              display={{ base: isMobile && activePanel !== "editor" ? "none" : "block", md: "block" }}
            >
              {activeFile ? (
                <>
                  <Editor
                    height="100%"
                    language={getLanguage(activeFile)}
                    value={fileContent}
                    onChange={(val) => {
                      setFileContent(val || "")
                      setIsDirty(val !== originalContent)
                    }}
                    theme="vs-dark"
                    options={{
                      fontSize: isMobile ? 12 : 13,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2,
                      wordWrap: "on",
                      scrollbar: { alwaysConsumeMouseWheel: false },
                    }}
                    loading={
                      <Box display="flex" alignItems="center" justifyContent="center" h="100%">
                        <Spinner size="sm" color="brand.400" />
                      </Box>
                    }
                  />
                  {loadingFile && (
                    <Box
                      position="absolute"
                      inset={0}
                      bg="rgba(10,10,15,0.8)"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      zIndex={10}
                    >
                      <Spinner size="md" color="brand.400" />
                    </Box>
                  )}
                  {/* Save bar */}
                  {isDirty && (
                    <Box
                      position="absolute"
                      bottom="0"
                      left="0"
                      right="0"
                      px="4"
                      py="2"
                      bg="rgba(99,102,241,0.1)"
                      borderTop="1px solid"
                      borderColor="rgba(99,102,241,0.2)"
                      display="flex"
                      alignItems="center"
                      gap="3"
                      zIndex={20}
                    >
                      <Icon as={LuTriangleAlert} boxSize="14px" color="yellow.400" />
                      <Text fontSize="xs" color="gray.300">Unsaved changes</Text>
                      <Button
                        size="xs"
                        ml="auto"
                        bg="linear-gradient(135deg, #6366f1, #8b5cf6)"
                        color="white"
                        _hover={{ bg: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
                        onClick={saveFile}
                      >
                        <Icon as={LuSave} boxSize="12px" mr="1" />
                        Save
                      </Button>
                    </Box>
                  )}
                </>
              ) : (
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  h="100%"
                  flexDirection="column"
                  gap="3"
                >
                  <Icon as={LuTerminal} boxSize="32px" color="gray.700" />
                  <Text color="gray.600" fontSize="sm">Select a file from the explorer</Text>
                </Box>
              )}
            </Box>

            {/* AI Panel */}
            <Box
              w={{ base: "full", md: "340px" }}
              flexShrink={0}
              borderLeft={{ base: "none", md: "1px solid" }}
              borderTop={{ base: "1px solid", md: "none" }}
              borderColor="rgba(99,102,241,0.1)"
              bg="rgba(10,10,15,0.6)"
              display={{ base: isMobile && activePanel !== "ai" ? "none" : "flex", md: "flex" }}
              flexDirection="column"
            >
              <Box px="3" py="2" borderBottom="1px solid" borderColor="rgba(99,102,241,0.1)">
                <HStack gap="2">
                  <Icon as={LuSparkles} boxSize="14px" color="brand.400" />
                  <Text fontSize="xs" fontWeight="700" color="white">
                    AI Developer
                  </Text>
                  <Badge size="sm" colorPalette="brand" variant="subtle" fontSize="2xs">
                    Qwen Coder
                  </Badge>
                </HStack>
              </Box>

              <Box flex="1" overflowY="auto" px="3" py="2">
                {/* Prompt input */}
                <VStack gap="2" align="stretch">
                  <Textarea
                    placeholder="e.g. Add a new button to the header, fix the scroll issue, refactor this component..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    fontSize="xs"
                    bg="rgba(10,10,15,0.8)"
                    border="1px solid"
                    borderColor="rgba(99,102,241,0.2)"
                    color="white"
                    minH={{ base: "60px", md: "80px" }}
                    _placeholder={{ color: "gray.600" }}
                    _focus={{ borderColor: "brand.500", outline: "none" }}
                  />
                  <Button
                    size={{ base: "md", md: "sm" }}
                    w="full"
                    bg="linear-gradient(135deg, #6366f1, #8b5cf6)"
                    color="white"
                    _hover={{ bg: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
                    onClick={runAI}
                    loading={aiLoading}
                    loadingText="Coding..."
                    disabled={!aiPrompt.trim() || !activeFile}
                  >
                    <Icon as={LuSend} boxSize="12px" mr="1.5" />
                    Generate Code
                  </Button>
                </VStack>

                {/* AI Response */}
                {aiResponse && (
                  <Box mt="3">
                    <HStack gap="2" mb="1.5">
                      <Icon as={LuSparkles} boxSize="12px" color="brand.400" />
                      <Text fontSize="2xs" color="gray.500" fontWeight="600" textTransform="uppercase" letterSpacing="0.05em">
                        AI Output
                      </Text>
                    </HStack>
                    <Box
                      bg="rgba(10,10,15,0.9)"
                      border="1px solid"
                      borderColor="rgba(99,102,241,0.15)"
                      borderRadius="md"
                      p="2"
                      fontSize="xs"
                      color="gray.300"
                      maxH={{ base: "160px", md: "200px" }}
                      overflowY="auto"
                      whiteSpace="pre-wrap"
                      fontFamily="mono"
                    >
                      {aiResponse}
                    </Box>

                    {pendingCode && (
                      <Button
                        size={{ base: "sm", md: "xs" }}
                        mt="2"
                        w="full"
                        bg="rgba(34,197,94,0.2)"
                        color="green.300"
                        border="1px solid"
                        borderColor="rgba(34,197,94,0.3)"
                        _hover={{ bg: "rgba(34,197,94,0.3)" }}
                        onClick={() => { applyChanges(); if (isMobile) setActivePanel("editor") }}
                      >
                        <Icon as={LuPlay} boxSize="12px" mr="1" />
                        Apply Changes
                      </Button>
                    )}
                  </Box>
                )}
              </Box>

              <Box px="3" py="2" borderTop="1px solid" borderColor="rgba(99,102,241,0.1)">
                <Text fontSize="2xs" color="gray.600">
                  Using <strong style={{ color: "#818cf8" }}>Qwen3 Coder 480B</strong> via NVIDIA NIM
                </Text>
              </Box>
            </Box>
          </Flex>
        </Flex>
      </Flex>

      {/* Mobile bottom nav */}
      {isMobile && (
        <HStack
          borderTop="1px solid"
          borderColor="rgba(99,102,241,0.15)"
          bg="rgba(10,10,15,0.95)"
          flexShrink={0}
          spacing="0"
          h="auto"
        >
          {panelBtn("explorer", "Files", LuPanelLeft, Object.values(fileTree).flat().length)}
          {panelBtn("editor", "Editor", LuCode, openFiles.length)}
          {panelBtn("ai", "AI", LuSparkles)}
        </HStack>
      )}
    </Box>
  )
}
