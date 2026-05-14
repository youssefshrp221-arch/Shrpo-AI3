import { useState, useRef, useEffect, useCallback } from "react"
import Editor from "@monaco-editor/react"
import {
  Box, HStack, VStack, Text, Button, Flex, Badge,
  Textarea, Icon, Spinner,
} from "@chakra-ui/react"
import {
  LuTerminal, LuSave, LuRefreshCw, LuSend, LuCheck,
  LuX, LuCode, LuUpload, LuShieldCheck,
  LuBot, LuFileDiff, LuFileCode, LuTrash2,
} from "react-icons/lu"
import { useAppStore } from "@/store/appStore"
import { toaster } from "@/components/ui/toaster"

// ── Constants ──────────────────────────────────────────────────────────────────
const CODER_MODEL = "qwen/qwen3-coder-480b-a35b-instruct"
const VISION_MODEL = "meta/llama-3.2-90b-vision-instruct"

// Auth files that need extra protection
const AUTH_FILES = ["appStore.ts", "App.tsx", "MainLayout.tsx"]
const AUTH_PATTERNS = ["isAdmin", "rehydrateAdmin", "isAdminEmail", "ADMIN_EMAIL"]

// ── Types ──────────────────────────────────────────────────────────────────────
interface ChatMsg {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  imagePreview?: string
  code?: string
  codeFile?: string
  applied?: boolean
  model?: "vision" | "coder"
  ts: number
}

interface PendingImage {
  base64: string
  preview: string
  name: string
  originalSize: number
  compressedSize: number
}

interface SessionCtx {
  extractedModels: string[]
  lastImageAnalysis: string
  lastImageBase64: string | null
  lastImageName: string | null
}

// ── Image compression ──────────────────────────────────────────────────────────
async function compressImage(file: File, maxWidth = 1000, quality = 0.80): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Read failed"))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error("Decode failed"))
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width)
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL("image/jpeg", quality))
      }
      img.src = e.target!.result as string
    }
    reader.readAsDataURL(file)
  })
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b}B`
  if (b < 1048576) return `${(b / 1024).toFixed(0)}KB`
  return `${(b / 1048576).toFixed(1)}MB`
}

function uid() { return Math.random().toString(36).slice(2) }

// ── Code extraction ────────────────────────────────────────────────────────────
function extractCode(text: string): { code: string; lang: string } | null {
  const m = text.match(/```([a-zA-Z0-9]*)\n?([\s\S]*?)```/)
  if (m && m[2].trim().length > 30) return { code: m[2].trim(), lang: m[1] || "text" }
  return null
}

// ── Diff helper ────────────────────────────────────────────────────────────────
interface DiffLine { type: "add" | "remove" | "same"; text: string }
function computeDiff(a: string, b: string): DiffLine[] {
  const la = a.split("\n"), lb = b.split("\n")
  const out: DiffLine[] = []
  const max = Math.max(la.length, lb.length)
  for (let i = 0; i < max; i++) {
    if (i >= la.length) out.push({ type: "add", text: lb[i] })
    else if (i >= lb.length) out.push({ type: "remove", text: la[i] })
    else if (la[i] !== lb[i]) { out.push({ type: "remove", text: la[i] }); out.push({ type: "add", text: lb[i] }) }
    else out.push({ type: "same", text: la[i] })
  }
  return out
}

// ══════════════════════════════════════════════════════════════════════════════
export default function DevStudio() {
  const userEmail = useAppStore((s) => s.userEmail)
  const isAdmin = useAppStore((s) => s.isAdmin)

  // Chat state
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: uid(), role: "system", ts: Date.now(),
      content: `مرحبًا! أنا Shrpo Dev AI.\n\nأستطيع:\n• تعديل ملفات المشروع بناءً على طلبك\n• تحليل الصور واستخراج معلومات منها\n• قراءة أي ملف من القائمة وتعديله\n\nاختر ملفًا من القائمة يمين ثم اكتب طلبك.`,
    },
  ])
  const [inputText, setInputText] = useState("")
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [sessionCtx, setSessionCtx] = useState<SessionCtx>({
    extractedModels: [],
    lastImageAnalysis: "",
    lastImageBase64: null,
    lastImageName: null,
  })

  // Editor state
  const [files, setFiles] = useState<string[]>([])
  const [openFiles, setOpenFiles] = useState<string[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState("")
  const [originalContent, setOriginalContent] = useState("")
  const [isDirty, setIsDirty] = useState(false)
  const [loadingFile, setLoadingFile] = useState(false)
  const [showDiff, setShowDiff] = useState<{ code: string } | null>(null)

  // Mobile panel
  const [mobilePanel, setMobilePanel] = useState<"chat" | "editor">("chat")

  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ── Admin guard ──────────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <Flex h="100%" align="center" justify="center" bg="#0a0a0f" direction="column" gap="4">
        <Icon as={LuShieldCheck} boxSize="48px" color="brand.500" />
        <Text color="gray.400" fontWeight="600" fontSize="lg">Dev Studio — للمطور فقط</Text>
        <Text color="gray.600" fontSize="sm">سجّل دخولك بإيميل المطور من الإعدادات</Text>
      </Flex>
    )
  }

  // ── Scroll chat to bottom ────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // ── Load file list ────────────────────────────────────────────────────────────
  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/dev/files", { headers: { "x-user-email": userEmail || "" } })
      const data = await res.json()
      if (data.files) setFiles(data.files.sort())
    } catch {}
  }, [userEmail])

  useEffect(() => { loadFiles() }, [loadFiles])

  // ── Open file ────────────────────────────────────────────────────────────────
  const openFile = async (filePath: string) => {
    setLoadingFile(true)
    try {
      const res = await fetch(`/api/dev/file?path=${encodeURIComponent(filePath)}`, {
        headers: { "x-user-email": userEmail || "" },
      })
      const data = await res.json()
      if (data.content !== undefined) {
        setActiveFile(filePath)
        setFileContent(data.content)
        setOriginalContent(data.content)
        setIsDirty(false)
        setShowDiff(null)
        if (!openFiles.includes(filePath)) setOpenFiles((p) => [...p, filePath])
        setMobilePanel("editor")
        addSystemMsg(`📂 تم فتح \`${filePath}\` — ${data.content.split("\n").length} سطر`)
      }
    } catch {
      toaster.create({ title: "Error loading file", type: "error" })
    } finally {
      setLoadingFile(false)
    }
  }

  const closeFile = (fp: string) => {
    setOpenFiles((p) => p.filter((f) => f !== fp))
    if (activeFile === fp) {
      const rest = openFiles.filter((f) => f !== fp)
      if (rest.length) openFile(rest[rest.length - 1])
      else { setActiveFile(null); setFileContent(""); setOriginalContent("") }
    }
  }

  // ── Helper: add system message ────────────────────────────────────────────────
  const addSystemMsg = (content: string) => {
    setMessages((m) => [...m, { id: uid(), role: "system", content, ts: Date.now() }])
  }

  // ── Image pick & compress ─────────────────────────────────────────────────────
  const handlePickImage = async (file: File) => {
    setCompressing(true)
    try {
      const base64 = await compressImage(file, 1000, 0.80)
      const byteLen = Math.round((base64.length * 3) / 4)
      setPendingImage({
        base64,
        preview: URL.createObjectURL(file),
        name: file.name,
        originalSize: file.size,
        compressedSize: byteLen,
      })
    } catch (err: any) {
      toaster.create({ title: "Image error", description: err.message, type: "error" })
    } finally {
      setCompressing(false)
    }
  }

  // ── Auth safety check ─────────────────────────────────────────────────────────
  const checkAuth = (filePath: string, code: string): string | null => {
    if (!AUTH_FILES.some((af) => filePath.endsWith(af))) return null
    const missing = AUTH_PATTERNS.filter((p) => !code.includes(p))
    return missing.length > 0 ? `⚠️ الكود يحذف حماية الـ Admin (${missing.join(", ")})` : null
  }

  // ── Send message ──────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    const text = inputText.trim()
    if (!text && !pendingImage) return
    if (isStreaming) return

    const hasImage = !!pendingImage
    const useLastImage = !hasImage && !!sessionCtx.lastImageBase64 &&
      (text.includes("الصورة") || text.includes("image") || text.includes("صورة"))

    // Capture image data BEFORE clearing state
    const imgBase64 = hasImage ? pendingImage!.base64 : (useLastImage ? sessionCtx.lastImageBase64 : null)
    const imgPreview = hasImage ? pendingImage!.preview : undefined
    const imgName   = hasImage ? pendingImage!.name : (useLastImage ? sessionCtx.lastImageName : null)

    // Add user message
    const userMsg: ChatMsg = {
      id: uid(),
      role: "user",
      content: text || (hasImage ? `[صورة: ${imgName}]` : ""),
      imagePreview: imgPreview,
      ts: Date.now(),
    }
    setMessages((m) => [...m, userMsg])
    setInputText("")
    setPendingImage(null)
    setIsStreaming(true)

    // ── Build API messages ──
    // For text-only: include file context in system prompt (server passes as-is to coder model)
    // For image: server builds the image_url payload itself — we just send text history + imageBase64
    const sysContent =
      `You are Shrpo Dev AI — a code editor AI assistant.\n` +
      (activeFile
        ? `Active file: ${activeFile}\n\nFile content:\n\`\`\`${getLanguage(activeFile)}\n${fileContent.slice(0, 6000)}\n\`\`\`\n\n`
        : "") +
      (!imgBase64 && sessionCtx.lastImageAnalysis
        ? `Previous image analysis context:\n${sessionCtx.lastImageAnalysis}\n\n`
        : "") +
      `Rules:\n` +
      `- Return COMPLETE updated file content in a markdown code block when editing.\n` +
      `- Never remove isAdmin, rehydrateAdmin, isAdminEmail, ADMIN_EMAIL, or auth code.\n` +
      `- Reply in Arabic when the user writes in Arabic.`

    // History: text-only content (strip any image content from old messages)
    const historyMsgs = messages
      .filter((m) => m.role !== "system")
      .slice(-8)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))

    const apiMessages = [
      { role: "system", content: sysContent },
      ...historyMsgs,
      { role: "user", content: text || "تحليل هذه الصورة" },
    ]

    // Placeholder for streaming response — track which model we're expecting
    const asstId = uid()
    const modelUsed: "vision" | "coder" = imgBase64 ? "vision" : "coder"
    setMessages((m) => [...m, { id: asstId, role: "assistant", content: "", model: modelUsed, ts: Date.now() }])

    try {
      const res = await fetch("/api/dev/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-email": userEmail || "" },
        body: JSON.stringify({
          messages: apiMessages,
          imageBase64: imgBase64 || undefined,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${res.status}`)
      }

      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let buf = "", full = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split("\n"); buf = lines.pop() ?? ""
        for (const line of lines) {
          const t = line.trim()
          if (!t || t === "data: [DONE]") continue
          if (t.startsWith("data: ")) {
            try {
              const j = JSON.parse(t.slice(6))
              const d = j?.choices?.[0]?.delta?.content
              if (d) {
                full += d
                setMessages((prev) =>
                  prev.map((msg) => msg.id === asstId ? { ...msg, content: full } : msg)
                )
              }
            } catch {}
          }
        }
      }

      // Extract code block if present
      const extracted = extractCode(full)
      const targetFile = activeFile || guessFileFromResponse(full)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === asstId
            ? {
                ...msg,
                content: full,
                code: extracted?.code,
                codeFile: extracted ? (targetFile || undefined) : undefined,
              }
            : msg
        )
      )

      // Save to session context
      if (imgBase64) {
        setSessionCtx((ctx) => ({
          ...ctx,
          lastImageBase64: hasImage ? imgBase64 : ctx.lastImageBase64,
          lastImageName: hasImage ? (imgName || ctx.lastImageName) : ctx.lastImageName,
          lastImageAnalysis: full.slice(0, 800),
        }))
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === asstId ? { ...msg, content: `❌ خطأ: ${err.message}` } : msg
        )
      )
    } finally {
      setIsStreaming(false)
    }
  }

  // ── Apply code changes ────────────────────────────────────────────────────────
  const applyCode = async (msgId: string, code: string, file: string | undefined) => {
    const targetFile = file || activeFile
    if (!targetFile) {
      toaster.create({ title: "اختر ملفًا أولاً", type: "error" })
      return
    }

    const authErr = checkAuth(targetFile, code)
    if (authErr) {
      toaster.create({ title: "محظور", description: authErr, type: "error" })
      return
    }

    setFileContent(code)
    setIsDirty(true)
    setShowDiff(null)
    setMessages((m) =>
      m.map((msg) => msg.id === msgId ? { ...msg, applied: true } : msg)
    )
    toaster.create({ title: `✓ تم تطبيق الكود على ${targetFile.split("/").pop()}`, type: "success" })
  }

  // ── Save file ────────────────────────────────────────────────────────────────
  const saveFile = async () => {
    if (!activeFile || !isDirty) return
    const authErr = checkAuth(activeFile, fileContent)
    if (authErr) { toaster.create({ title: "محظور", description: authErr, type: "error" }); return }
    try {
      const res = await fetch("/api/dev/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-email": userEmail || "" },
        body: JSON.stringify({ path: activeFile, content: fileContent }),
      })
      const data = await res.json()
      if (data.success) {
        setOriginalContent(fileContent)
        setIsDirty(false)
        addSystemMsg(`✅ تم حفظ \`${activeFile}\` بنجاح`)
        toaster.create({ title: "تم الحفظ", type: "success" })
      } else throw new Error(data.error)
    } catch (err: any) {
      toaster.create({ title: "فشل الحفظ", description: err.message, type: "error" })
    }
  }

  const getLanguage = (p: string) => {
    if (p.endsWith(".tsx") || p.endsWith(".ts")) return "typescript"
    if (p.endsWith(".jsx") || p.endsWith(".js")) return "javascript"
    if (p.endsWith(".css")) return "css"
    if (p.endsWith(".json")) return "json"
    if (p.endsWith(".html")) return "html"
    if (p.endsWith(".md")) return "markdown"
    return "text"
  }

  // File tree
  const fileTree: Record<string, string[]> = {}
  files.forEach((f) => {
    const parts = f.split("/")
    const folder = parts.length > 1 ? parts[0] : "(root)"
    if (!fileTree[folder]) fileTree[folder] = []
    fileTree[folder].push(f)
  })

  const diffLines = showDiff && fileContent ? computeDiff(fileContent, showDiff.code) : []

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Flex h="100%" bg="#0a0a0f" color="white" overflow="hidden" direction="column">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => e.target.files?.[0] && handlePickImage(e.target.files[0])}
      />

      {/* Mobile tab bar */}
      <HStack
        display={{ base: "flex", md: "none" }}
        gap="0"
        borderBottom="1px solid"
        borderColor="rgba(99,102,241,0.15)"
        flexShrink={0}
      >
        <Button flex="1" size="sm" borderRadius="0" variant="ghost"
          bg={mobilePanel === "chat" ? "rgba(99,102,241,0.15)" : "transparent"}
          color={mobilePanel === "chat" ? "brand.300" : "gray.500"}
          onClick={() => setMobilePanel("chat")}
        >
          <Icon as={LuBot} mr="1.5" boxSize="12px" />Chat
        </Button>
        <Button flex="1" size="sm" borderRadius="0" variant="ghost"
          bg={mobilePanel === "editor" ? "rgba(99,102,241,0.15)" : "transparent"}
          color={mobilePanel === "editor" ? "brand.300" : "gray.500"}
          onClick={() => setMobilePanel("editor")}
        >
          <Icon as={LuCode} mr="1.5" boxSize="12px" />Editor
        </Button>
      </HStack>

      {/* Main split layout */}
      <Flex flex="1" overflow="hidden">

        {/* ══ CHAT PANEL ════════════════════════════════════════════════════════ */}
        <Flex
          direction="column"
          w={{ base: "100%", md: "420px" }}
          flexShrink={0}
          borderRight={{ md: "1px solid" }}
          borderColor="rgba(99,102,241,0.15)"
          display={{ base: mobilePanel === "chat" ? "flex" : "none", md: "flex" }}
          bg="rgba(8,8,14,0.98)"
          overflow="hidden"
        >
          {/* Chat header */}
          <HStack
            px="4" py="3"
            borderBottom="1px solid"
            borderColor="rgba(99,102,241,0.12)"
            gap="2"
            flexShrink={0}
          >
            <Box p="1.5" bg="rgba(99,102,241,0.15)" borderRadius="md">
              <Icon as={LuBot} color="brand.400" boxSize="14px" />
            </Box>
            <VStack align="start" gap="0" flex="1">
              <Text fontSize="xs" fontWeight="700" color="gray.200">Shrpo Dev AI</Text>
              <Text fontSize="2xs" color="gray.600" fontFamily="mono">{CODER_MODEL.split("/")[1]}</Text>
            </VStack>
            {activeFile && (
              <Badge colorPalette="brand" variant="subtle" fontSize="2xs" maxW="120px" isTruncated>
                {activeFile.split("/").pop()}
              </Badge>
            )}
            {sessionCtx.lastImageName && (
              <Badge colorPalette="purple" variant="subtle" fontSize="2xs" title={`صورة محفوظة: ${sessionCtx.lastImageName}`}>
                📷
              </Badge>
            )}
            <Icon as={LuTrash2} boxSize="13px" color="gray.700" cursor="pointer"
              _hover={{ color: "gray.400" }}
              onClick={() => {
                setMessages([{ id: uid(), role: "system", content: "تم مسح المحادثة.", ts: Date.now() }])
                setSessionCtx({ extractedModels: [], lastImageAnalysis: "", lastImageBase64: null, lastImageName: null })
              }}
            />
          </HStack>

          {/* File selector strip */}
          <Box
            px="3" py="2"
            borderBottom="1px solid"
            borderColor="rgba(99,102,241,0.08)"
            flexShrink={0}
            overflowX="auto"
          >
            <HStack gap="1.5" minW="max-content">
              <Text fontSize="2xs" color="gray.700" fontWeight="600" textTransform="uppercase" letterSpacing="0.05em" mr="1">
                ملف:
              </Text>
              {files.slice(0, 12).map((f) => (
                <Box
                  key={f}
                  as="button"
                  px="2" py="0.5"
                  borderRadius="md"
                  bg={activeFile === f ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)"}
                  border="1px solid"
                  borderColor={activeFile === f ? "brand.600" : "rgba(99,102,241,0.1)"}
                  onClick={() => openFile(f)}
                  flexShrink={0}
                >
                  <Text fontSize="2xs" color={activeFile === f ? "brand.300" : "gray.600"} fontFamily="mono">
                    {f.split("/").pop()}
                  </Text>
                </Box>
              ))}
              <Box
                as="button"
                px="2" py="0.5"
                borderRadius="md"
                bg="rgba(255,255,255,0.03)"
                border="1px solid"
                borderColor="rgba(99,102,241,0.08)"
                onClick={loadFiles}
                flexShrink={0}
              >
                <Icon as={LuRefreshCw} boxSize="10px" color="gray.600" />
              </Box>
            </HStack>
          </Box>

          {/* Message history */}
          <Box flex="1" overflowY="auto" px="3" py="3"
            css={{
              "&::-webkit-scrollbar": { width: "4px" },
              "&::-webkit-scrollbar-thumb": { background: "rgba(99,102,241,0.2)", borderRadius: "2px" },
            }}
          >
            <VStack align="stretch" gap="3">
              {messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  msg={msg}
                  activeFile={activeFile}
                  fileContent={fileContent}
                  onApply={applyCode}
                  onShowDiff={(code) => setShowDiff({ code })}
                  onOpenFile={openFile}
                />
              ))}
              {isStreaming && messages[messages.length - 1]?.role === "assistant" &&
                messages[messages.length - 1].content === "" && (
                  <Flex px="3" py="2" gap="2" align="center">
                    <Icon as={LuBot} boxSize="13px" color="brand.400" />
                    <HStack gap="1">
                      {[0, 1, 2].map((i) => (
                        <Box
                          key={i} w="5px" h="5px" borderRadius="full" bg="brand.400"
                          style={{ animation: `bounce 1.2s ${i * 0.2}s infinite` }}
                        />
                      ))}
                    </HStack>
                  </Flex>
                )}
            </VStack>
            <div ref={chatEndRef} />
          </Box>

          {/* Pending image preview */}
          {pendingImage && (
            <Box
              px="3" py="2"
              borderTop="1px solid"
              borderColor="rgba(99,102,241,0.1)"
              flexShrink={0}
            >
              <HStack gap="2">
                <Box position="relative">
                  <Box as="img" src={pendingImage.preview} alt={pendingImage.name}
                    w="48px" h="48px" objectFit="cover" borderRadius="md" border="1px solid" borderColor="brand.600" />
                  <Icon as={LuX} boxSize="12px" position="absolute" top="-4px" right="-4px"
                    bg="red.600" borderRadius="full" p="0.5" cursor="pointer" color="white"
                    onClick={() => setPendingImage(null)} />
                </Box>
                <VStack align="start" gap="0" flex="1">
                  <Text fontSize="2xs" color="gray.300" isTruncated maxW="180px">{pendingImage.name}</Text>
                  <Text fontSize="2xs" color="gray.600">
                    {fmtBytes(pendingImage.originalSize)} → {fmtBytes(pendingImage.compressedSize)}
                    {" "}(−{Math.round((1 - pendingImage.compressedSize / pendingImage.originalSize) * 100)}%)
                  </Text>
                </VStack>
                <Badge colorPalette="purple" variant="subtle" fontSize="2xs">{VISION_MODEL.split("/")[1]}</Badge>
              </HStack>
            </Box>
          )}

          {/* Input area */}
          <Box
            px="3" py="3"
            borderTop="1px solid"
            borderColor="rgba(99,102,241,0.12)"
            bg="rgba(10,10,15,0.98)"
            flexShrink={0}
          >
            <HStack gap="2" align="flex-end">
              <Textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  activeFile
                    ? `اطلب تعديلًا على ${activeFile.split("/").pop()}...`
                    : "اختر ملفًا ثم اكتب طلبك..."
                }
                fontSize="sm"
                resize="none"
                rows={2}
                bg="rgba(255,255,255,0.03)"
                border="1px solid"
                borderColor="rgba(99,102,241,0.2)"
                borderRadius="xl"
                _focus={{ borderColor: "brand.500", outline: "none", bg: "rgba(99,102,241,0.05)" }}
                flex="1"
                disabled={isStreaming}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() }
                }}
              />
              <VStack gap="1.5" flexShrink={0}>
                {/* Upload image button */}
                <Button
                  size="sm" w="9" h="9" p="0" borderRadius="lg"
                  variant="ghost"
                  border="1px solid"
                  borderColor={pendingImage ? "purple.500" : "rgba(99,102,241,0.2)"}
                  bg={pendingImage ? "rgba(139,92,246,0.15)" : "transparent"}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={compressing}
                  title="رفع صورة"
                >
                  {compressing ? <Spinner size="xs" /> : <Icon as={LuUpload} boxSize="13px" color={pendingImage ? "purple.400" : "gray.500"} />}
                </Button>
                {/* Send button */}
                <Button
                  size="sm" w="9" h="9" p="0" borderRadius="lg"
                  bg={isStreaming ? "rgba(99,102,241,0.2)" : "linear-gradient(135deg, #6366f1, #8b5cf6)"}
                  color="white"
                  onClick={sendMessage}
                  disabled={isStreaming || (!inputText.trim() && !pendingImage)}
                  title="إرسال (Enter)"
                >
                  {isStreaming ? <Spinner size="xs" /> : <Icon as={LuSend} boxSize="13px" />}
                </Button>
              </VStack>
            </HStack>
            <Text fontSize="2xs" color="gray.700" mt="1.5">
              {pendingImage ? `📷 Vision: ${VISION_MODEL.split("/")[1]}` : `💻 Coder: ${CODER_MODEL.split("/")[1]}`}
              {sessionCtx.lastImageName && !pendingImage ? ` · 📷 ${sessionCtx.lastImageName} محفوظة` : ""}
            </Text>
          </Box>
        </Flex>

        {/* ══ EDITOR PANEL ══════════════════════════════════════════════════════ */}
        <Flex
          direction="column"
          flex="1"
          overflow="hidden"
          display={{ base: mobilePanel === "editor" ? "flex" : "none", md: "flex" }}
        >
          {/* Editor header */}
          <HStack
            px="3" py="2"
            borderBottom="1px solid"
            borderColor="rgba(99,102,241,0.12)"
            bg="rgba(10,10,15,0.98)"
            gap="2"
            flexShrink={0}
          >
            <Icon as={LuCode} color="brand.400" boxSize="13px" />
            <Text fontSize="xs" color="gray.500" fontWeight="600">EDITOR</Text>
            {isDirty && activeFile && (
              <>
                <Badge colorPalette="orange" variant="subtle" fontSize="2xs">تغييرات غير محفوظة</Badge>
                <Button
                  size="xs" ml="auto"
                  bg="linear-gradient(135deg, #6366f1, #8b5cf6)"
                  color="white"
                  onClick={saveFile}
                >
                  <Icon as={LuSave} mr="1" boxSize="11px" />حفظ
                </Button>
              </>
            )}
            {activeFile && !isDirty && (
              <Text fontSize="2xs" color="gray.700" ml="auto" fontFamily="mono">{activeFile}</Text>
            )}
          </HStack>

          {/* Open file tabs */}
          {openFiles.length > 0 && (
            <HStack
              gap="0" borderBottom="1px solid" borderColor="rgba(99,102,241,0.08)"
              overflowX="auto" flexShrink={0}
              bg="rgba(8,8,14,0.9)"
            >
              {openFiles.map((f) => (
                <HStack
                  key={f} gap="1.5" px="3" py="2" cursor="pointer" flexShrink={0}
                  borderBottom="2px solid"
                  borderColor={activeFile === f ? "brand.400" : "transparent"}
                  bg={activeFile === f ? "rgba(99,102,241,0.1)" : "transparent"}
                  _hover={{ bg: "rgba(99,102,241,0.06)" }}
                  onClick={() => openFile(f)}
                  transition="all 0.1s"
                >
                  <Icon as={LuFileCode} boxSize="10px" color={activeFile === f ? "brand.400" : "gray.600"} />
                  <Text fontSize="xs" color={activeFile === f ? "gray.200" : "gray.500"}>
                    {f.split("/").pop()}
                  </Text>
                  {activeFile === f && isDirty && (
                    <Box w="5px" h="5px" borderRadius="full" bg="orange.400" flexShrink={0} />
                  )}
                  <Icon
                    as={LuX} boxSize="9px" color="gray.700"
                    _hover={{ color: "gray.400" }}
                    flexShrink={0}
                    onClick={(e) => { e.stopPropagation(); closeFile(f) }}
                  />
                </HStack>
              ))}
            </HStack>
          )}

          {/* Diff view or Monaco */}
          {showDiff ? (
            <Flex direction="column" flex="1" overflow="hidden">
              <HStack px="4" py="2" bg="rgba(10,10,15,0.9)" borderBottom="1px solid" borderColor="rgba(99,102,241,0.1)" flexShrink={0}>
                <Icon as={LuFileDiff} color="brand.400" boxSize="13px" />
                <Text fontSize="xs" color="gray.400">معاينة Diff</Text>
                <Badge colorPalette="green" variant="subtle" fontSize="2xs" ml="2">
                  +{diffLines.filter((l) => l.type === "add").length}
                </Badge>
                <Badge colorPalette="red" variant="subtle" fontSize="2xs">
                  −{diffLines.filter((l) => l.type === "remove").length}
                </Badge>
                <Button size="xs" ml="auto" variant="ghost" color="gray.500" onClick={() => setShowDiff(null)}>
                  <Icon as={LuX} boxSize="11px" />
                </Button>
              </HStack>
              <Box flex="1" overflowY="auto" fontFamily="mono">
                {diffLines.map((line, i) => (
                  <Box
                    key={i} px="4" py="0.5"
                    bg={line.type === "add" ? "rgba(34,197,94,0.08)" : line.type === "remove" ? "rgba(239,68,68,0.08)" : "transparent"}
                    borderLeft="2px solid"
                    borderColor={line.type === "add" ? "green.600" : line.type === "remove" ? "red.600" : "transparent"}
                  >
                    <Text
                      fontSize="xs" whiteSpace="pre"
                      color={line.type === "add" ? "green.300" : line.type === "remove" ? "red.300" : "gray.600"}
                    >
                      {line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  "}{line.text}
                    </Text>
                  </Box>
                ))}
              </Box>
            </Flex>
          ) : activeFile ? (
            <Box flex="1" overflow="hidden">
              {loadingFile ? (
                <Flex h="full" align="center" justify="center"><Spinner color="brand.400" /></Flex>
              ) : (
                <Editor
                  height="100%"
                  language={getLanguage(activeFile)}
                  value={fileContent}
                  onChange={(v) => { setFileContent(v || ""); setIsDirty(v !== originalContent) }}
                  theme="vs-dark"
                  options={{
                    fontSize: 13,
                    minimap: { enabled: false },
                    wordWrap: "on",
                    scrollBeyondLastLine: false,
                    lineNumbers: "on",
                  }}
                />
              )}
            </Box>
          ) : (
            <Flex flex="1" align="center" justify="center" direction="column" gap="4">
              <Box p="5" bg="rgba(99,102,241,0.08)" borderRadius="2xl">
                <Icon as={LuCode} boxSize="36px" color="gray.700" />
              </Box>
              <Text color="gray.600" fontSize="sm">اختر ملفًا من شريط الملفات في الشات</Text>
              <VStack gap="2" maxH="300px" overflowY="auto" w="full" px="6">
                {Object.entries(fileTree).slice(0, 5).map(([folder, fs]) => (
                  <Box key={folder} w="full">
                    <Text fontSize="2xs" color="gray.700" fontWeight="600" mb="1">{folder}</Text>
                    {fs.slice(0, 5).map((f) => (
                      <Box
                        key={f} px="3" py="1.5" cursor="pointer" borderRadius="md"
                        _hover={{ bg: "rgba(99,102,241,0.08)" }}
                        onClick={() => openFile(f)}
                      >
                        <Text fontSize="xs" color="gray.500" fontFamily="mono">{f.split("/").pop()}</Text>
                      </Box>
                    ))}
                  </Box>
                ))}
              </VStack>
            </Flex>
          )}
        </Flex>
      </Flex>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </Flex>
  )
}

// ── Chat bubble component ──────────────────────────────────────────────────────
function ChatBubble({
  msg, activeFile, fileContent, onApply, onShowDiff, onOpenFile,
}: {
  msg: ChatMsg
  activeFile: string | null
  fileContent: string
  onApply: (id: string, code: string, file: string | undefined) => void
  onShowDiff: (code: string) => void
  onOpenFile: (f: string) => void
}) {
  if (msg.role === "system") {
    return (
      <Box
        px="3" py="2"
        bg="rgba(99,102,241,0.06)"
        borderRadius="lg"
        border="1px solid"
        borderColor="rgba(99,102,241,0.1)"
      >
        <Text fontSize="xs" color="gray.500" whiteSpace="pre-wrap">{msg.content}</Text>
      </Box>
    )
  }

  if (msg.role === "user") {
    return (
      <Flex justify="flex-end">
        <Box maxW="85%">
          {msg.imagePreview && (
            <Box as="img" src={msg.imagePreview} alt="uploaded" maxH="120px" borderRadius="lg" mb="1" ml="auto" display="block" />
          )}
          {msg.content && (
            <Box
              bg="linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.2))"
              border="1px solid"
              borderColor="rgba(99,102,241,0.3)"
              borderRadius="2xl"
              borderBottomRightRadius="sm"
              px="3" py="2"
            >
              <Text fontSize="sm" color="gray.200" whiteSpace="pre-wrap">{msg.content}</Text>
            </Box>
          )}
        </Box>
      </Flex>
    )
  }

  // Assistant message
  const hasCode = !!msg.code
  const parts = splitMessageParts(msg.content)

  return (
    <Flex gap="2" align="flex-start">
      <Box p="1.5" bg="rgba(99,102,241,0.15)" borderRadius="full" flexShrink={0} mt="1">
        <Icon as={LuBot} boxSize="12px" color="brand.400" />
      </Box>
      <Box flex="1" maxW="calc(100% - 32px)">
        {parts.map((part, i) => {
          if (part.type === "text") {
            return (
              <Text key={i} fontSize="sm" color="gray.300" whiteSpace="pre-wrap" lineHeight="tall" mb={part.text.trim() ? "2" : "0"}>
                {part.text}
              </Text>
            )
          }
          // Code block
          return (
            <Box key={i} mb="2">
              <HStack
                px="3" py="1.5"
                bg="rgba(10,10,15,0.8)"
                borderTopRadius="lg"
                border="1px solid"
                borderColor="rgba(99,102,241,0.2)"
                borderBottom="none"
                justify="space-between"
              >
                <HStack gap="1.5">
                  <Icon as={LuCode} boxSize="11px" color="brand.400" />
                  <Text fontSize="2xs" color="gray.500" fontFamily="mono">{part.lang || "code"}</Text>
                </HStack>
                {msg.codeFile && (
                  <Text fontSize="2xs" color="gray.600" fontFamily="mono" isTruncated maxW="120px">
                    {msg.codeFile.split("/").pop()}
                  </Text>
                )}
              </HStack>
              <Box
                bg="rgba(10,10,15,0.9)"
                border="1px solid"
                borderColor="rgba(99,102,241,0.15)"
                borderBottomRadius="lg"
                p="3"
                maxH="200px"
                overflowY="auto"
                css={{
                  "&::-webkit-scrollbar": { width: "3px" },
                  "&::-webkit-scrollbar-thumb": { background: "rgba(99,102,241,0.2)" },
                }}
              >
                <Text fontSize="xs" color="gray.400" fontFamily="mono" whiteSpace="pre">
                  {part.code.slice(0, 1500)}{part.code.length > 1500 ? "\n..." : ""}
                </Text>
              </Box>
            </Box>
          )
        })}

        {/* Action buttons for messages with code */}
        {hasCode && (
          <HStack gap="2" flexWrap="wrap" mt="1">
            {!msg.applied ? (
              <Button
                size="xs"
                bg="linear-gradient(135deg, #6366f1, #8b5cf6)"
                color="white"
                borderRadius="lg"
                onClick={() => onApply(msg.id, msg.code!, msg.codeFile)}
              >
                <Icon as={LuCheck} mr="1" boxSize="11px" />
                Apply Changes
                {msg.codeFile && (
                  <Text as="span" ml="1" opacity={0.7}>{msg.codeFile.split("/").pop()}</Text>
                )}
              </Button>
            ) : (
              <Badge colorPalette="green" variant="subtle" fontSize="xs">
                <Icon as={LuCheck} mr="1" boxSize="10px" />تم التطبيق
              </Badge>
            )}
            {!msg.applied && fileContent && (
              <Button
                size="xs" variant="ghost"
                borderRadius="lg"
                border="1px solid"
                borderColor="rgba(99,102,241,0.2)"
                color="gray.500"
                _hover={{ color: "gray.300", borderColor: "brand.600" }}
                onClick={() => onShowDiff(msg.code!)}
              >
                <Icon as={LuFileDiff} mr="1" boxSize="11px" />Diff
              </Button>
            )}
          </HStack>
        )}

        <HStack gap="2" mt="1.5">
          <Text fontSize="2xs" color="gray.700">
            {new Date(msg.ts).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
          </Text>
          {msg.model && (
            <Badge
              colorPalette={msg.model === "vision" ? "purple" : "brand"}
              variant="subtle"
              fontSize="2xs"
              px="1.5"
            >
              {msg.model === "vision" ? "📷 Vision" : "💻 Coder"}
            </Badge>
          )}
        </HStack>
      </Box>
    </Flex>
  )
}

// ── Split message into text + code parts ──────────────────────────────────────
interface MsgPart {
  type: "text" | "code"
  text: string
  code: string
  lang: string
}

function splitMessageParts(content: string): MsgPart[] {
  const parts: MsgPart[] = []
  const regex = /```([a-zA-Z0-9]*)\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", text: content.slice(lastIndex, match.index), code: "", lang: "" })
    }
    parts.push({ type: "code", code: match[2].trim(), lang: match[1] || "code", text: "" })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < content.length) {
    parts.push({ type: "text", text: content.slice(lastIndex), code: "", lang: "" })
  }
  return parts.length > 0 ? parts : [{ type: "text", text: content, code: "", lang: "" }]
}

// ── Guess target file from AI response ────────────────────────────────────────
function guessFileFromResponse(text: string): string | null {
  const m = text.match(/(?:editing|file|في|ملف)[:\s`"]*([a-zA-Z0-9/_.-]+\.(tsx?|jsx?|css|json|md))/i)
  return m ? m[1] : null
}
