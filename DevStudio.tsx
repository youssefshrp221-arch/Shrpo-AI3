import { useState, useRef, useEffect, useCallback } from "react"
import Editor from "@monaco-editor/react"
import {
  Box, HStack, VStack, Text, Button, Flex, Badge, Textarea, Icon, Spinner,
} from "@chakra-ui/react"
import {
  LuSave, LuSend, LuCheck, LuX, LuCode, LuUpload, LuShieldCheck,
  LuBot, LuFileDiff, LuFileCode, LuTrash2, LuFolderOpen, LuFolder,
  LuRefreshCw, LuWrench, LuPencil, LuList, LuCircleAlert,
} from "react-icons/lu"
import { useAppStore } from "@/store/appStore"
import { toaster } from "@/components/ui/toaster"

// ── Models ────────────────────────────────────────────────────────────────────
const CODER_MODEL  = "qwen/qwen3-coder-480b-a35b-instruct"
const VISION_MODEL = "meta/llama-3.2-90b-vision-instruct"

// ── Types ──────────────────────────────────────────────────────────────────────
type AgentEvt =
  | { type: "thinking"; iter: number }
  | { type: "tool_call"; tool: string; args: Record<string, unknown>; callId: string }
  | { type: "tool_result"; tool: string; success: boolean; preview: string }
  | { type: "write_result"; path: string; success: boolean; message: string }
  | { type: "content"; text: string }
  | { type: "error"; message: string }
  | { type: "done" }

interface ChatMsg {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  imagePreview?: string
  agentEvents?: AgentEvt[]
  model?: "vision" | "coder" | "agent"
  code?: string      // for vision/coder path only
  codeFile?: string
  applied?: boolean
  ts: number
}

interface PendingImage {
  base64: string; preview: string; name: string
  originalSize: number; compressedSize: number
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2)
const fmtBytes = (b: number) => b < 1024 ? `${b}B` : b < 1048576 ? `${(b/1024).toFixed(0)}KB` : `${(b/1048576).toFixed(1)}MB`

async function compressImage(file: File, maxW = 1000, q = 0.8): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onerror = () => rej(new Error("Read failed"))
    r.onload = (e) => {
      const img = new Image()
      img.onerror = () => rej(new Error("Decode failed"))
      img.onload = () => {
        const s = Math.min(1, maxW / img.width)
        const c = document.createElement("canvas")
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height)
        res(c.toDataURL("image/jpeg", q))
      }
      img.src = e.target!.result as string
    }
    r.readAsDataURL(file)
  })
}

function extractCode(text: string) {
  const m = text.match(/```([a-zA-Z0-9]*)\n?([\s\S]*?)```/)
  return m && m[2].trim().length > 30 ? { code: m[2].trim(), lang: m[1] || "text" } : null
}

interface DiffLine { type: "add" | "remove" | "same"; text: string }
function computeDiff(a: string, b: string): DiffLine[] {
  const la = a.split("\n"), lb = b.split("\n"), out: DiffLine[] = []
  for (let i = 0; i < Math.max(la.length, lb.length); i++) {
    if (i >= la.length) out.push({ type: "add", text: lb[i] })
    else if (i >= lb.length) out.push({ type: "remove", text: la[i] })
    else if (la[i] !== lb[i]) { out.push({ type: "remove", text: la[i] }); out.push({ type: "add", text: lb[i] }) }
    else out.push({ type: "same", text: la[i] })
  }
  return out
}

function getLanguage(p: string) {
  if (p.endsWith(".tsx") || p.endsWith(".ts")) return "typescript"
  if (p.endsWith(".jsx") || p.endsWith(".js")) return "javascript"
  if (p.endsWith(".css")) return "css"
  if (p.endsWith(".json")) return "json"
  if (p.endsWith(".html")) return "html"
  return "markdown"
}

// ─────────────────────────────────────────────────────────────────────────────
// FILE TREE
// ─────────────────────────────────────────────────────────────────────────────
function FileTree({
  files, activeFile, recentWrites, onOpen, onRefresh,
}: {
  files: string[]
  activeFile: string | null
  recentWrites: Set<string>
  onOpen: (f: string) => void
  onRefresh: () => void
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // Group into folder tree
  const tree: Record<string, string[]> = {}
  files.forEach((f) => {
    const parts = f.split("/")
    const folder = parts.length > 1 ? parts[0] : ""
    if (!tree[folder]) tree[folder] = []
    tree[folder].push(f)
  })

  const toggleFolder = (f: string) =>
    setCollapsed((s) => { const n = new Set(s); n.has(f) ? n.delete(f) : n.add(f); return n })

  const fileExt = (f: string) => f.split(".").pop() || ""
  const extColor = (ext: string) => {
    if (["tsx","jsx"].includes(ext)) return "#61afef"
    if (["ts","js"].includes(ext)) return "#e5c07b"
    if (ext === "css") return "#c678dd"
    if (ext === "json") return "#98c379"
    return "#abb2bf"
  }

  return (
    <Flex direction="column" h="full" bg="rgba(6,6,10,0.98)" overflow="hidden">
      {/* Header */}
      <HStack px="3" py="2.5" borderBottom="1px solid" borderColor="rgba(99,102,241,0.12)" flexShrink={0}>
        <Icon as={LuFolderOpen} color="brand.400" boxSize="13px" />
        <Text fontSize="xs" fontWeight="700" color="gray.400" flex="1">PROJECT FILES</Text>
        <Box
          as="button" p="1" borderRadius="md" cursor="pointer"
          _hover={{ bg: "rgba(99,102,241,0.1)", color: "gray.300" }}
          color="gray.700" onClick={onRefresh}
        >
          <Icon as={LuRefreshCw} boxSize="11px" />
        </Box>
      </HStack>

      {/* Tree */}
      <Box flex="1" overflowY="auto" py="1"
        css={{ "&::-webkit-scrollbar": { width: "3px" }, "&::-webkit-scrollbar-thumb": { background: "rgba(99,102,241,0.15)" } }}
      >
        {/* Root-level files first */}
        {(tree[""] || []).map((f) => (
          <FileRow key={f} file={f} active={activeFile === f} flash={recentWrites.has(f)}
            ext={fileExt(f)} extColor={extColor(fileExt(f))} indent={0} onOpen={onOpen} />
        ))}
        {/* Folders */}
        {Object.entries(tree).filter(([k]) => k !== "").sort().map(([folder, fs]) => (
          <Box key={folder}>
            <HStack
              px="3" py="1" gap="1.5" cursor="pointer"
              _hover={{ bg: "rgba(99,102,241,0.06)" }}
              onClick={() => toggleFolder(folder)}
            >
              <Icon as={collapsed.has(folder) ? LuFolder : LuFolderOpen} boxSize="11px" color="yellow.600" />
              <Text fontSize="xs" color="gray.500" fontWeight="600">{folder}</Text>
              <Text fontSize="2xs" color="gray.700" ml="auto">{fs.length}</Text>
            </HStack>
            {!collapsed.has(folder) && fs.map((f) => (
              <FileRow key={f} file={f} active={activeFile === f} flash={recentWrites.has(f)}
                ext={fileExt(f)} extColor={extColor(fileExt(f))} indent={1} onOpen={onOpen} />
            ))}
          </Box>
        ))}
      </Box>
      <Box px="3" py="1.5" borderTop="1px solid" borderColor="rgba(99,102,241,0.08)" flexShrink={0}>
        <Text fontSize="2xs" color="gray.700">{files.length} files</Text>
      </Box>
    </Flex>
  )
}

function FileRow({ file, active, flash, ext, extColor, indent, onOpen }: {
  file: string; active: boolean; flash: boolean; ext: string; extColor: string; indent: number; onOpen: (f: string) => void
}) {
  const name = file.split("/").pop() || file
  return (
    <Box
      as="button" w="full" textAlign="left"
      pl={`${12 + indent * 14}px`} pr="3" py="1"
      bg={active ? "rgba(99,102,241,0.15)" : flash ? "rgba(34,197,94,0.08)" : "transparent"}
      borderLeft="2px solid"
      borderColor={active ? "brand.400" : flash ? "green.500" : "transparent"}
      _hover={{ bg: active ? "rgba(99,102,241,0.18)" : "rgba(99,102,241,0.06)" }}
      onClick={() => onOpen(file)}
      transition="all 0.15s"
    >
      <HStack gap="1.5">
        <Text fontSize="2xs" color={extColor} fontFamily="mono" fontWeight="600"
          minW="20px" opacity={0.7}>.{ext}</Text>
        <Text fontSize="xs" color={active ? "gray.100" : flash ? "green.300" : "gray.400"}
          fontFamily="mono" truncate>{name}</Text>
        {flash && <Box w="5px" h="5px" borderRadius="full" bg="green.400" flexShrink={0} />}
      </HStack>
    </Box>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT EVENT ROW
// ─────────────────────────────────────────────────────────────────────────────
function AgentEventRow({ evt }: { evt: AgentEvt }) {
  if (evt.type === "thinking") {
    return (
      <HStack gap="2" py="1">
        <Spinner size="xs" color="brand.400" />
        <Text fontSize="xs" color="gray.500">جاري التفكير...</Text>
      </HStack>
    )
  }
  if (evt.type === "tool_call") {
    const icons: Record<string, any> = { list_files: LuList, read_file: LuFileCode, write_file: LuPencil }
    const labels: Record<string, string> = {
      list_files: "يستعرض ملفات المشروع",
      read_file:  `يقرأ ${(evt.args as any).path || ""}`,
      write_file: `يكتب ${(evt.args as any).path || ""}`,
    }
    const colors: Record<string, string> = { list_files: "blue", read_file: "yellow", write_file: "purple" }
    return (
      <HStack gap="2" py="1">
        <Box p="1" bg={`rgba(99,102,241,0.12)`} borderRadius="md">
          <Icon as={icons[evt.tool] || LuWrench} boxSize="11px" color={`${colors[evt.tool] || "brand"}.400`} />
        </Box>
        <Text fontSize="xs" color="gray.400">{labels[evt.tool] || evt.tool}</Text>
        <Spinner size="xs" color="gray.600" />
      </HStack>
    )
  }
  if (evt.type === "tool_result") {
    return (
      <HStack gap="2" py="0.5" pl="1">
        <Icon as={evt.success ? LuCheck : LuCircleAlert} boxSize="10px"
          color={evt.success ? "green.500" : "red.400"} />
        <Text fontSize="2xs" color={evt.success ? "gray.600" : "red.400"} fontFamily="mono">
          {evt.preview}
        </Text>
      </HStack>
    )
  }
  if (evt.type === "write_result") {
    return (
      <HStack gap="2" py="1"
        bg={evt.success ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)"}
        px="2" borderRadius="md"
        border="1px solid"
        borderColor={evt.success ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}
      >
        <Icon as={evt.success ? LuCheck : LuCircleAlert} boxSize="11px"
          color={evt.success ? "green.400" : "red.400"} />
        <VStack align="start" gap="0">
          <Text fontSize="xs" color={evt.success ? "green.300" : "red.300"} fontWeight="600">
            {evt.success ? "✅ تم التعديل" : "❌ فشل التعديل"}
          </Text>
          <Text fontSize="2xs" color="gray.600" fontFamily="mono">{evt.path} · {evt.message}</Text>
        </VStack>
      </HStack>
    )
  }
  if (evt.type === "error") {
    return (
      <HStack gap="2" py="1" px="2" bg="rgba(239,68,68,0.06)" borderRadius="md"
        border="1px solid" borderColor="rgba(239,68,68,0.2)">
        <Icon as={LuCircleAlert} boxSize="11px" color="red.400" />
        <Text fontSize="xs" color="red.300">{evt.message}</Text>
      </HStack>
    )
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT BUBBLE
// ─────────────────────────────────────────────────────────────────────────────
function splitParts(content: string) {
  const parts: Array<{ type: "text" | "code"; text: string; code: string; lang: string }> = []
  const re = /```([a-zA-Z0-9]*)\n?([\s\S]*?)```/g
  let last = 0, m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) parts.push({ type: "text", text: content.slice(last, m.index), code: "", lang: "" })
    parts.push({ type: "code", code: m[2].trim(), lang: m[1] || "code", text: "" })
    last = m.index + m[0].length
  }
  if (last < content.length) parts.push({ type: "text", text: content.slice(last), code: "", lang: "" })
  return parts.length ? parts : [{ type: "text" as const, text: content, code: "", lang: "" }]
}

function ChatBubble({
  msg, fileContent, onApply, onDiff,
}: {
  msg: ChatMsg
  fileContent: string
  onApply: (id: string, code: string, file: string | undefined) => void
  onDiff:  (code: string) => void
}) {
  if (msg.role === "system") return (
    <Box px="3" py="2" bg="rgba(99,102,241,0.05)" borderRadius="lg"
      border="1px solid" borderColor="rgba(99,102,241,0.1)">
      <Text fontSize="xs" color="gray.500" whiteSpace="pre-wrap">{msg.content}</Text>
    </Box>
  )

  if (msg.role === "user") return (
    <Flex justify="flex-end">
      <Box maxW="85%">
        {msg.imagePreview && (
          <Box as="img" src={msg.imagePreview} alt="img" maxH="100px"
            borderRadius="lg" mb="1" ml="auto" display="block" />
        )}
        {msg.content && (
          <Box bg="linear-gradient(135deg,rgba(99,102,241,.25),rgba(139,92,246,.2))"
            border="1px solid" borderColor="rgba(99,102,241,.3)"
            borderRadius="2xl" borderBottomRightRadius="sm" px="3" py="2">
            <Text fontSize="sm" color="gray.200" whiteSpace="pre-wrap">{msg.content}</Text>
          </Box>
        )}
      </Box>
    </Flex>
  )

  // Assistant
  const isAgent  = msg.model === "agent"
  const events   = msg.agentEvents || []
  const parts    = splitParts(msg.content)
  const hasCode  = !!msg.code

  return (
    <Flex gap="2" align="flex-start">
      <Box p="1.5" bg={isAgent ? "rgba(34,197,94,0.12)" : "rgba(99,102,241,0.12)"}
        borderRadius="full" flexShrink={0} mt="1">
        <Icon as={LuBot} boxSize="12px" color={isAgent ? "green.400" : "brand.400"} />
      </Box>
      <Box flex="1" minW="0">
        {/* Agent events */}
        {events.length > 0 && (
          <VStack align="stretch" gap="1" mb="2" px="2" py="2"
            bg="rgba(6,6,12,0.6)" borderRadius="lg"
            border="1px solid" borderColor="rgba(99,102,241,0.1)">
            {events.filter((e) => e.type !== "done" && e.type !== "content").map((e, i) => (
              <AgentEventRow key={i} evt={e} />
            ))}
          </VStack>
        )}

        {/* Streaming content */}
        {msg.content && (
          <Box>
            {parts.map((p, i) => {
              if (p.type === "text") return (
                <Text key={i} fontSize="sm" color="gray.300" whiteSpace="pre-wrap"
                  lineHeight="tall" mb={p.text.trim() ? "2" : "0"}>
                  {p.text}
                </Text>
              )
              return (
                <Box key={i} mb="2">
                  <HStack px="3" py="1.5" bg="rgba(10,10,15,0.8)"
                    borderTopRadius="lg" border="1px solid" borderColor="rgba(99,102,241,0.2)"
                    borderBottom="none" justify="space-between">
                    <HStack gap="1.5">
                      <Icon as={LuCode} boxSize="11px" color="brand.400" />
                      <Text fontSize="2xs" color="gray.500" fontFamily="mono">{p.lang}</Text>
                    </HStack>
                    {msg.codeFile && (
                      <Text fontSize="2xs" color="gray.600" fontFamily="mono" truncate maxW="120px">
                        {msg.codeFile.split("/").pop()}
                      </Text>
                    )}
                  </HStack>
                  <Box bg="rgba(10,10,15,0.9)" border="1px solid" borderColor="rgba(99,102,241,0.15)"
                    borderBottomRadius="lg" p="3" maxH="180px" overflowY="auto"
                    css={{ "&::-webkit-scrollbar": { width: "3px" }, "&::-webkit-scrollbar-thumb": { background: "rgba(99,102,241,0.2)" } }}>
                    <Text fontSize="xs" color="gray.400" fontFamily="mono" whiteSpace="pre">
                      {p.code.slice(0, 1500)}{p.code.length > 1500 ? "\n..." : ""}
                    </Text>
                  </Box>
                </Box>
              )
            })}
          </Box>
        )}

        {/* Apply / Diff buttons for non-agent messages */}
        {hasCode && !isAgent && (
          <HStack gap="2" flexWrap="wrap" mt="1">
            {!msg.applied ? (
              <Button size="xs" bg="linear-gradient(135deg,#6366f1,#8b5cf6)" color="white"
                borderRadius="lg" onClick={() => onApply(msg.id, msg.code!, msg.codeFile)}>
                <Icon as={LuCheck} mr="1" boxSize="11px" />
                Apply{msg.codeFile ? ` → ${msg.codeFile.split("/").pop()}` : ""}
              </Button>
            ) : (
              <Badge colorPalette="green" variant="subtle" fontSize="xs">
                <Icon as={LuCheck} mr="1" boxSize="10px" />تم
              </Badge>
            )}
            {!msg.applied && fileContent && (
              <Button size="xs" variant="ghost" borderRadius="lg"
                border="1px solid" borderColor="rgba(99,102,241,0.2)"
                color="gray.500" _hover={{ color: "gray.300" }}
                onClick={() => onDiff(msg.code!)}>
                <Icon as={LuFileDiff} mr="1" boxSize="11px" />Diff
              </Button>
            )}
          </HStack>
        )}

        {/* Footer */}
        <HStack gap="2" mt="1.5">
          <Text fontSize="2xs" color="gray.700">
            {new Date(msg.ts).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
          </Text>
          {msg.model && (
            <Badge fontSize="2xs" px="1.5" variant="subtle"
              colorPalette={msg.model === "vision" ? "purple" : msg.model === "agent" ? "green" : "brand"}>
              {msg.model === "vision" ? "📷 Vision" : msg.model === "agent" ? "🤖 Agent" : "💻 Coder"}
            </Badge>
          )}
        </HStack>
      </Box>
    </Flex>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function DevStudio() {
  const userEmail = useAppStore((s) => s.userEmail)
  const isAdmin   = useAppStore((s) => s.isAdmin)

  // ── State ──────────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMsg[]>([{
    id: uid(), role: "system", ts: Date.now(),
    content: "مرحبًا! أنا Shrpo Dev AI — وكيل برمجة مستقل.\n\nأستطيع:\n• قراءة وتعديل ملفات المشروع مباشرةً\n• استعراض هيكل المشروع كاملاً\n• تحليل الصور وتنفيذ التعديلات تلقائياً\n\nاختر ملفًا من الشجرة يسار، أو اكتب طلبك مباشرةً.",
  }])
  const [inputText, setInputText]     = useState("")
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null)
  const [isWorking, setIsWorking]     = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [lastImageB64, setLastImageB64] = useState<string | null>(null)
  const [lastImageName, setLastImageName] = useState<string | null>(null)

  const [files, setFiles]             = useState<string[]>([])
  const [activeFile, setActiveFile]   = useState<string | null>(null)
  const [fileContent, setFileContent] = useState("")
  const [origContent, setOrigContent] = useState("")
  const [isDirty, setIsDirty]         = useState(false)
  const [openFiles, setOpenFiles]     = useState<string[]>([])
  const [loadingFile, setLoadingFile] = useState(false)
  const [recentWrites, setRecentWrites] = useState<Set<string>>(new Set())
  const [showDiff, setShowDiff]       = useState<{ code: string } | null>(null)
  const [treeOpen, setTreeOpen]       = useState(true)

  const [mobileTab, setMobileTab] = useState<"files" | "chat" | "editor">("chat")

  const chatEndRef  = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Admin guard ────────────────────────────────────────────────────────────
  if (!isAdmin) return (
    <Flex h="100%" align="center" justify="center" bg="#0a0a0f" direction="column" gap="4">
      <Icon as={LuShieldCheck} boxSize="48px" color="brand.500" />
      <Text color="gray.400" fontWeight="600" fontSize="lg">Dev Studio — للمطور فقط</Text>
    </Flex>
  )

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  // ── Load files ─────────────────────────────────────────────────────────────
  const loadFiles = useCallback(async () => {
    try {
      const r = await fetch("/api/dev/files", { headers: { "x-user-email": userEmail || "" } })
      const d = await r.json()
      if (d.files) setFiles(d.files.sort())
    } catch {}
  }, [userEmail])

  useEffect(() => { loadFiles() }, [loadFiles])

  // ── Flash written file ─────────────────────────────────────────────────────
  const flashFile = (fp: string) => {
    setRecentWrites((s) => new Set([...s, fp]))
    setTimeout(() => setRecentWrites((s) => { const n = new Set(s); n.delete(fp); return n }), 4000)
  }

  // ── Open file in editor ────────────────────────────────────────────────────
  const openFile = async (fp: string) => {
    setLoadingFile(true)
    try {
      const r = await fetch(`/api/dev/file?path=${encodeURIComponent(fp)}`, {
        headers: { "x-user-email": userEmail || "" },
      })
      const d = await r.json()
      if (d.content !== undefined) {
        setActiveFile(fp); setFileContent(d.content); setOrigContent(d.content)
        setIsDirty(false); setShowDiff(null)
        if (!openFiles.includes(fp)) setOpenFiles((p) => [...p, fp])
        setMobileTab("editor")
      }
    } catch { toaster.create({ title: "خطأ في فتح الملف", type: "error" }) }
    finally { setLoadingFile(false) }
  }

  const closeTab = (fp: string) => {
    setOpenFiles((p) => p.filter((f) => f !== fp))
    if (activeFile === fp) {
      const rest = openFiles.filter((f) => f !== fp)
      rest.length ? openFile(rest[rest.length - 1]) : (setActiveFile(null), setFileContent(""), setOrigContent(""))
    }
  }

  // ── Save file ──────────────────────────────────────────────────────────────
  const saveFile = async () => {
    if (!activeFile || !isDirty) return
    try {
      const r = await fetch("/api/dev/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-email": userEmail || "" },
        body: JSON.stringify({ path: activeFile, content: fileContent }),
      })
      const d = await r.json()
      if (d.success) {
        setOrigContent(fileContent); setIsDirty(false)
        flashFile(activeFile)
        toaster.create({ title: "تم الحفظ", type: "success" })
      } else throw new Error(d.error)
    } catch (e: any) { toaster.create({ title: "فشل الحفظ", description: e.message, type: "error" }) }
  }

  // ── Image pick ─────────────────────────────────────────────────────────────
  const pickImage = async (file: File) => {
    setCompressing(true)
    try {
      const b64 = await compressImage(file)
      const bytes = Math.round((b64.length * 3) / 4)
      setPendingImage({ base64: b64, preview: URL.createObjectURL(file), name: file.name, originalSize: file.size, compressedSize: bytes })
    } catch (e: any) { toaster.create({ title: "خطأ", description: e.message, type: "error" }) }
    finally { setCompressing(false) }
  }

  // ── Apply code (manual, non-agent path) ───────────────────────────────────
  const applyCode = async (msgId: string, code: string, file: string | undefined) => {
    const fp = file || activeFile
    if (!fp) { toaster.create({ title: "اختر ملفًا أولاً", type: "error" }); return }
    setFileContent(code); setIsDirty(true); setShowDiff(null)
    setMessages((m) => m.map((msg) => msg.id === msgId ? { ...msg, applied: true } : msg))
    toaster.create({ title: `✓ تم تطبيق الكود على ${fp.split("/").pop()}`, type: "success" })
  }

  // ── SEND (agent for text, vision for image) ────────────────────────────────
  const sendMessage = async () => {
    const text = inputText.trim()
    if (!text && !pendingImage) return
    if (isWorking) return

    const hasImg = !!pendingImage
    const useLastImg = !hasImg && !!lastImageB64 && (text.includes("صورة") || text.includes("image"))
    const imgB64 = hasImg ? pendingImage!.base64 : (useLastImg ? lastImageB64 : null)
    const imgPreview = hasImg ? pendingImage!.preview : undefined
    const imgName    = hasImg ? pendingImage!.name    : (useLastImg ? lastImageName : null)

    const userMsg: ChatMsg = {
      id: uid(), role: "user",
      content: text || (hasImg ? `[صورة: ${imgName}]` : ""),
      imagePreview: imgPreview,
      ts: Date.now(),
    }
    setMessages((m) => [...m, userMsg])
    setInputText(""); setPendingImage(null); setIsWorking(true)

    if (imgB64) {
      // ── VISION PATH ──────────────────────────────────────────────────────
      await runVisionPath(text, imgB64, hasImg, imgName)
    } else {
      // ── AGENT PATH ───────────────────────────────────────────────────────
      await runAgentPath(text)
    }
    setIsWorking(false)
  }

  // ── Agent path (agentic loop via SSE) ─────────────────────────────────────
  const runAgentPath = async (text: string) => {
    const sysContent =
      `You are Shrpo Dev AI — an autonomous coding agent.\n` +
      (activeFile
        ? `Currently open file: ${activeFile}\n\`\`\`${getLanguage(activeFile)}\n${fileContent.slice(0, 4000)}\n\`\`\`\n\n`
        : "") +
      `Use tools (list_files, read_file, write_file) to fulfill any code requests. Reply in Arabic if user writes in Arabic.`

    const historyMsgs = messages
      .filter((m) => m.role !== "system")
      .slice(-6)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))

    const apiMessages = [
      { role: "system", content: sysContent },
      ...historyMsgs,
      { role: "user", content: text },
    ]

    const asstId = uid()
    const eventsRef: AgentEvt[] = []
    setMessages((prev) => [...prev, {
      id: asstId, role: "assistant", content: "", model: "agent", agentEvents: [], ts: Date.now(),
    }])

    try {
      const res = await fetch("/api/dev/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-email": userEmail || "" },
        body: JSON.stringify({ messages: apiMessages }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || `HTTP ${res.status}`)
      }

      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let buf = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split("\n"); buf = lines.pop() ?? ""
        for (const line of lines) {
          const t = line.trim()
          if (!t || !t.startsWith("data: ")) continue
          let evt: AgentEvt
          try { evt = JSON.parse(t.slice(6)) } catch { continue }

          if (evt.type === "done") continue

          if (evt.type === "content") {
            eventsRef.push(evt)
            setMessages((prev) => prev.map((m) =>
              m.id === asstId ? { ...m, content: evt.type === "content" ? evt.text : m.content, agentEvents: [...eventsRef] } : m
            ))
          } else {
            eventsRef.push(evt)
            setMessages((prev) => prev.map((m) =>
              m.id === asstId ? { ...m, agentEvents: [...eventsRef] } : m
            ))
            // Reflect agent writes in editor
            if (evt.type === "write_result" && evt.success) {
              flashFile(evt.path)
              loadFiles()
              // Reload file in editor if it's the active one
              if (evt.path === activeFile) {
                setTimeout(() => openFile(evt.path), 300)
              }
            }
          }
        }
      }
    } catch (e: any) {
      eventsRef.push({ type: "error", message: e.message })
      setMessages((prev) => prev.map((m) =>
        m.id === asstId ? { ...m, agentEvents: [...eventsRef] } : m
      ))
    }
  }

  // ── Vision path (image + text → coder) ────────────────────────────────────
  const runVisionPath = async (
    text: string, imgB64: string,
    hasImg: boolean, imgName: string | null,
  ) => {
    const sysContent =
      `You are Shrpo Dev AI — a code editor assistant.\n` +
      (activeFile ? `Active file: ${activeFile}\n\`\`\`${getLanguage(activeFile)}\n${fileContent.slice(0, 4000)}\n\`\`\`\n\n` : "") +
      `Rules: wrap code in markdown blocks. Reply in Arabic if user writes in Arabic.`

    const historyMsgs = messages
      .filter((m) => m.role !== "system").slice(-6)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))

    const apiMessages = [
      { role: "system", content: sysContent },
      ...historyMsgs,
      { role: "user", content: text || "تحليل هذه الصورة" },
    ]

    const asstId = uid()
    setMessages((prev) => [...prev, { id: asstId, role: "assistant", content: "", model: "vision", ts: Date.now() }])

    try {
      const res = await fetch("/api/dev/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-email": userEmail || "" },
        body: JSON.stringify({ messages: apiMessages, imageBase64: imgB64 }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`) }

      const reader = res.body!.getReader(); const dec = new TextDecoder()
      let buf = "", full = ""
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split("\n"); buf = lines.pop() ?? ""
        for (const line of lines) {
          const t = line.trim()
          if (!t || t === "data: [DONE]" || !t.startsWith("data: ")) continue
          try { const j = JSON.parse(t.slice(6)); const d = j?.choices?.[0]?.delta?.content; if (d) { full += d; setMessages((p) => p.map((m) => m.id === asstId ? { ...m, content: full } : m)) } } catch {}
        }
      }
      const extracted = extractCode(full)
      if (extracted) {
        const target = activeFile || null
        setMessages((p) => p.map((m) => m.id === asstId ? { ...m, content: full, code: extracted.code, codeFile: target || undefined } : m))
      }
      if (hasImg) { setLastImageB64(imgB64); setLastImageName(imgName) }
    } catch (e: any) {
      setMessages((p) => p.map((m) => m.id === asstId ? { ...m, content: `❌ خطأ: ${e.message}` } : m))
    }
  }

  const diffLines = showDiff && fileContent ? computeDiff(fileContent, showDiff.code) : []

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Flex h="100%" bg="#0a0a0f" color="white" overflow="hidden" direction="column">
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => e.target.files?.[0] && pickImage(e.target.files[0])} />

      {/* Mobile tab bar */}
      <HStack display={{ base: "flex", md: "none" }} gap="0" borderBottom="1px solid"
        borderColor="rgba(99,102,241,0.15)" flexShrink={0}>
        {(["files","chat","editor"] as const).map((tab) => (
          <Button key={tab} flex="1" size="sm" borderRadius="0" variant="ghost"
            bg={mobileTab === tab ? "rgba(99,102,241,0.15)" : "transparent"}
            color={mobileTab === tab ? "brand.300" : "gray.500"}
            onClick={() => setMobileTab(tab)}>
            <Icon as={tab === "files" ? LuFolderOpen : tab === "chat" ? LuBot : LuCode}
              mr="1" boxSize="12px" />
            {tab === "files" ? "Files" : tab === "chat" ? "Chat" : "Editor"}
          </Button>
        ))}
      </HStack>

      <Flex flex="1" overflow="hidden">

        {/* ══ FILE TREE (left) ═════════════════════════════════════════════ */}
        <Box
          w={{ base: "100%", md: treeOpen ? "190px" : "0px" }}
          flexShrink={0}
          borderRight={{ md: "1px solid" }}
          borderColor="rgba(99,102,241,0.12)"
          overflow="hidden"
          transition="width 0.2s"
          display={{ base: mobileTab === "files" ? "block" : "none", md: "block" }}
        >
          <FileTree files={files} activeFile={activeFile}
            recentWrites={recentWrites} onOpen={openFile} onRefresh={loadFiles} />
        </Box>

        {/* ══ CHAT PANEL (middle) ══════════════════════════════════════════ */}
        <Flex
          direction="column"
          w={{ base: "100%", md: "400px" }}
          flexShrink={0}
          borderRight={{ md: "1px solid" }}
          borderColor="rgba(99,102,241,0.12)"
          bg="rgba(8,8,14,0.98)"
          overflow="hidden"
          display={{ base: mobileTab === "chat" ? "flex" : "none", md: "flex" }}
        >
          {/* Chat header */}
          <HStack px="3" py="2.5" borderBottom="1px solid" borderColor="rgba(99,102,241,0.12)" flexShrink={0} gap="2">
            <Box
              as="button" display={{ md: "flex" }} display_base="none"
              p="1" borderRadius="md" cursor="pointer" mr="-1"
              _hover={{ bg: "rgba(99,102,241,0.1)" }}
              onClick={() => setTreeOpen((v) => !v)}
            >
              <Icon as={LuFolderOpen} boxSize="13px" color="gray.600" />
            </Box>
            <Box p="1.5" bg="rgba(34,197,94,0.1)" borderRadius="md">
              <Icon as={LuBot} color="green.400" boxSize="13px" />
            </Box>
            <VStack align="start" gap="0" flex="1">
              <Text fontSize="xs" fontWeight="700" color="gray.200">Shrpo Dev AI</Text>
              <Text fontSize="2xs" color="gray.700" fontFamily="mono">Autonomous Agent</Text>
            </VStack>
            {activeFile && (
              <Badge colorPalette="brand" variant="subtle" fontSize="2xs" maxW="100px" isTruncated>
                {activeFile.split("/").pop()}
              </Badge>
            )}
            {lastImageName && (
              <Badge colorPalette="purple" variant="subtle" fontSize="2xs"
                title={`صورة: ${lastImageName}`}>📷</Badge>
            )}
            <Box as="button" p="1" borderRadius="md" cursor="pointer" color="gray.700"
              _hover={{ color: "gray.400", bg: "rgba(239,68,68,0.08)" }}
              onClick={() => {
                setMessages([{ id: uid(), role: "system", content: "تم مسح المحادثة.", ts: Date.now() }])
                setLastImageB64(null); setLastImageName(null)
              }}>
              <Icon as={LuTrash2} boxSize="12px" />
            </Box>
          </HStack>

          {/* Messages */}
          <Box flex="1" overflowY="auto" px="3" py="3"
            css={{ "&::-webkit-scrollbar": { width: "4px" }, "&::-webkit-scrollbar-thumb": { background: "rgba(99,102,241,0.2)", borderRadius: "2px" } }}>
            <VStack align="stretch" gap="3">
              {messages.map((msg) => (
                <ChatBubble key={msg.id} msg={msg} fileContent={fileContent}
                  onApply={applyCode} onDiff={(code) => setShowDiff({ code })} />
              ))}
              {isWorking && messages.at(-1)?.content === "" && messages.at(-1)?.role === "assistant" && (
                <Flex px="3" py="2" gap="2" align="center">
                  <Spinner size="xs" color="green.400" />
                  <Text fontSize="xs" color="gray.600">الوكيل يعمل...</Text>
                </Flex>
              )}
            </VStack>
            <div ref={chatEndRef} />
          </Box>

          {/* Pending image */}
          {pendingImage && (
            <Box px="3" py="2" borderTop="1px solid" borderColor="rgba(99,102,241,0.1)" flexShrink={0}>
              <HStack gap="2">
                <Box position="relative">
                  <Box as="img" src={pendingImage.preview} w="40px" h="40px"
                    objectFit="cover" borderRadius="md" border="1px solid" borderColor="purple.600" />
                  <Box as="button" position="absolute" top="-3px" right="-3px"
                    bg="red.700" borderRadius="full" p="0.5"
                    onClick={() => setPendingImage(null)}>
                    <Icon as={LuX} boxSize="8px" color="white" />
                  </Box>
                </Box>
                <VStack align="start" gap="0" flex="1">
                  <Text fontSize="2xs" color="gray.300" truncate maxW="160px">{pendingImage.name}</Text>
                  <Text fontSize="2xs" color="gray.600">
                    {fmtBytes(pendingImage.originalSize)} → {fmtBytes(pendingImage.compressedSize)}
                  </Text>
                </VStack>
                <Badge colorPalette="purple" variant="subtle" fontSize="2xs">Vision</Badge>
              </HStack>
            </Box>
          )}

          {/* Input */}
          <Box px="3" py="3" borderTop="1px solid" borderColor="rgba(99,102,241,0.12)" bg="rgba(10,10,15,0.98)" flexShrink={0}>
            <HStack gap="2" align="flex-end">
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={isWorking ? "الوكيل يعمل..." : activeFile ? `اطلب تعديلًا على ${activeFile.split("/").pop()}...` : "اكتب طلبك للوكيل..."}
                fontSize="sm" resize="none" rows={2}
                bg="rgba(255,255,255,0.03)" border="1px solid"
                borderColor="rgba(99,102,241,0.2)" borderRadius="xl"
                _focus={{ borderColor: "brand.500", bg: "rgba(99,102,241,0.04)" }}
                flex="1" disabled={isWorking}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              />
              <VStack gap="1.5" flexShrink={0}>
                <Button size="sm" w="9" h="9" p="0" borderRadius="lg" variant="ghost"
                  border="1px solid"
                  borderColor={pendingImage ? "purple.500" : "rgba(99,102,241,0.2)"}
                  bg={pendingImage ? "rgba(139,92,246,0.12)" : "transparent"}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={compressing}>
                  {compressing ? <Spinner size="xs" /> : <Icon as={LuUpload} boxSize="13px" color={pendingImage ? "purple.400" : "gray.600"} />}
                </Button>
                <Button size="sm" w="9" h="9" p="0" borderRadius="lg"
                  bg={isWorking ? "rgba(99,102,241,0.15)" : pendingImage ? "linear-gradient(135deg,#7c3aed,#a855f7)" : "linear-gradient(135deg,#22c55e,#16a34a)"}
                  color="white"
                  disabled={isWorking || (!inputText.trim() && !pendingImage)}
                  onClick={sendMessage}>
                  {isWorking ? <Spinner size="xs" /> : <Icon as={LuSend} boxSize="13px" />}
                </Button>
              </VStack>
            </HStack>
            <Text fontSize="2xs" color="gray.700" mt="1.5">
              {pendingImage ? `📷 Vision: ${VISION_MODEL.split("/")[1]}` : `🤖 Agent: ${CODER_MODEL.split("/")[1]}`}
            </Text>
          </Box>
        </Flex>

        {/* ══ EDITOR PANEL (right) ═════════════════════════════════════════ */}
        <Flex direction="column" flex="1" overflow="hidden"
          display={{ base: mobileTab === "editor" ? "flex" : "none", md: "flex" }}>
          {/* Toolbar */}
          <HStack px="3" py="2" borderBottom="1px solid" borderColor="rgba(99,102,241,0.12)"
            bg="rgba(10,10,15,0.98)" flexShrink={0} gap="2">
            <Icon as={LuCode} color="brand.400" boxSize="13px" />
            <Text fontSize="xs" color="gray.600" fontWeight="600">EDITOR</Text>
            {isDirty && activeFile && (
              <>
                <Badge colorPalette="orange" variant="subtle" fontSize="2xs">unsaved</Badge>
                <Button size="xs" ml="auto"
                  bg="linear-gradient(135deg,#6366f1,#8b5cf6)" color="white"
                  onClick={saveFile}>
                  <Icon as={LuSave} mr="1" boxSize="11px" />حفظ
                </Button>
              </>
            )}
            {activeFile && !isDirty && (
              <Text fontSize="2xs" color="gray.700" ml="auto" fontFamily="mono">{activeFile}</Text>
            )}
          </HStack>

          {/* File tabs */}
          {openFiles.length > 0 && (
            <HStack gap="0" borderBottom="1px solid" borderColor="rgba(99,102,241,0.08)"
              overflowX="auto" flexShrink={0} bg="rgba(8,8,14,0.9)">
              {openFiles.map((f) => (
                <HStack key={f} gap="1.5" px="3" py="2" cursor="pointer" flexShrink={0}
                  borderBottom="2px solid"
                  borderColor={activeFile === f ? "brand.400" : "transparent"}
                  bg={activeFile === f ? "rgba(99,102,241,0.08)" : "transparent"}
                  _hover={{ bg: "rgba(99,102,241,0.05)" }}
                  onClick={() => openFile(f)} transition="all 0.1s">
                  <Icon as={LuFileCode} boxSize="10px" color={activeFile === f ? "brand.400" : "gray.600"} />
                  <Text fontSize="xs" color={activeFile === f ? "gray.200" : "gray.500"}>{f.split("/").pop()}</Text>
                  {activeFile === f && isDirty && <Box w="5px" h="5px" borderRadius="full" bg="orange.400" />}
                  {recentWrites.has(f) && <Box w="5px" h="5px" borderRadius="full" bg="green.400" />}
                  <Icon as={LuX} boxSize="9px" color="gray.700" _hover={{ color: "gray.400" }}
                    onClick={(e) => { e.stopPropagation(); closeTab(f) }} />
                </HStack>
              ))}
            </HStack>
          )}

          {/* Diff view or Monaco */}
          {showDiff ? (
            <Flex direction="column" flex="1" overflow="hidden">
              <HStack px="4" py="2" bg="rgba(10,10,15,0.9)" borderBottom="1px solid"
                borderColor="rgba(99,102,241,0.1)" flexShrink={0}>
                <Icon as={LuFileDiff} color="brand.400" boxSize="13px" />
                <Text fontSize="xs" color="gray.400">Diff</Text>
                <Badge colorPalette="green" variant="subtle" fontSize="2xs">
                  +{diffLines.filter((l) => l.type === "add").length}
                </Badge>
                <Badge colorPalette="red" variant="subtle" fontSize="2xs">
                  -{diffLines.filter((l) => l.type === "remove").length}
                </Badge>
                <Button size="xs" ml="auto" variant="ghost" color="gray.500"
                  onClick={() => setShowDiff(null)}>
                  <Icon as={LuX} boxSize="11px" />
                </Button>
              </HStack>
              <Box flex="1" overflowY="auto" fontFamily="mono">
                {diffLines.map((l, i) => (
                  <Box key={i} px="4" py="0.5"
                    bg={l.type === "add" ? "rgba(34,197,94,0.07)" : l.type === "remove" ? "rgba(239,68,68,0.07)" : "transparent"}
                    borderLeft="2px solid"
                    borderColor={l.type === "add" ? "green.600" : l.type === "remove" ? "red.600" : "transparent"}>
                    <Text fontSize="xs" whiteSpace="pre"
                      color={l.type === "add" ? "green.300" : l.type === "remove" ? "red.300" : "gray.600"}>
                      {l.type === "add" ? "+ " : l.type === "remove" ? "- " : "  "}{l.text}
                    </Text>
                  </Box>
                ))}
              </Box>
            </Flex>
          ) : activeFile ? (
            <Box flex="1" overflow="hidden">
              {loadingFile
                ? <Flex h="full" align="center" justify="center"><Spinner color="brand.400" /></Flex>
                : <Editor height="100%" language={getLanguage(activeFile)} value={fileContent}
                    onChange={(v) => { setFileContent(v || ""); setIsDirty(v !== origContent) }}
                    theme="vs-dark"
                    options={{ fontSize: 13, minimap: { enabled: false }, wordWrap: "on", scrollBeyondLastLine: false }}
                  />
              }
            </Box>
          ) : (
            <Flex flex="1" align="center" justify="center" direction="column" gap="3">
              <Icon as={LuCode} boxSize="36px" color="gray.800" />
              <Text color="gray.700" fontSize="sm">اختر ملفًا من شجرة الملفات</Text>
            </Flex>
          )}
        </Flex>
      </Flex>
    </Flex>
  )
}
