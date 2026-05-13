import { useState, useCallback, useRef } from "react"
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
  Separator,
} from "@chakra-ui/react"
import {
  LuTerminal,
  LuSave,
  LuRefreshCw,
  LuSend,
  LuCheck,
  LuX,
  LuSparkles,
  LuCode,
  LuFolder,
  LuUpload,
  LuScanLine,
  LuCircleAlert,
  LuShieldCheck,
  LuEye,
  LuFileDiff,
} from "react-icons/lu"
import { useAppStore } from "@/store/appStore"
import { toaster } from "@/components/ui/toaster"

// ── Constants ──────────────────────────────────────────────────────────────────
const CODER_MODEL = "qwen/qwen3-coder-480b-a35b-instruct"
const VISION_MODEL = "meta/llama-3.2-90b-vision-instruct"
const MODEL_CONFIG_PATH = "index.ts"

// Patterns that MUST exist in any file touching auth. Saving is blocked if they disappear.
const AUTH_GUARD_PATTERNS = [
  "isAdmin",
  "rehydrateAdmin",
  "isAdminEmail",
  "userEmail",
]
const AUTH_FILES = ["appStore.ts", "App.tsx", "MainLayout.tsx"]

type PanelId = "vision" | "explorer" | "editor"

// ── Image helpers ──────────────────────────────────────────────────────────────
async function compressImage(
  file: File,
  maxWidth = 1200,
  quality = 0.82,
  onProgress?: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    onProgress?.(10)
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.onload = (e) => {
      onProgress?.(40)
      const img = new Image()
      img.onerror = () => reject(new Error("Failed to decode image"))
      img.onload = () => {
        onProgress?.(70)
        const scale = Math.min(1, maxWidth / img.width)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement("canvas")
        canvas.width = w
        canvas.height = h
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h)
        onProgress?.(95)
        resolve(canvas.toDataURL("image/jpeg", quality))
      }
      img.src = e.target!.result as string
    }
    reader.readAsDataURL(file)
  })
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(2)} MB`
}

// ── Simple diff helper ─────────────────────────────────────────────────────────
interface DiffLine { type: "add" | "remove" | "same"; text: string }
function computeDiff(before: string, after: string): DiffLine[] {
  const a = before.split("\n")
  const b = after.split("\n")
  const result: DiffLine[] = []
  const maxLen = Math.max(a.length, b.length)
  for (let i = 0; i < maxLen; i++) {
    if (i >= a.length) result.push({ type: "add", text: b[i] })
    else if (i >= b.length) result.push({ type: "remove", text: a[i] })
    else if (a[i] !== b[i]) {
      result.push({ type: "remove", text: a[i] })
      result.push({ type: "add", text: b[i] })
    } else {
      result.push({ type: "same", text: a[i] })
    }
  }
  return result
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function DevStudio() {
  const userEmail = useAppStore((s) => s.userEmail)
  const isAdmin = useAppStore((s) => s.isAdmin)

  const [activePanel, setActivePanel] = useState<PanelId>("vision")

  // File state
  const [files, setFiles] = useState<string[]>([])
  const [openFiles, setOpenFiles] = useState<string[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState("")
  const [originalContent, setOriginalContent] = useState("")
  const [isDirty, setIsDirty] = useState(false)
  const [loadingFile, setLoadingFile] = useState(false)

  // AI editor state
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiResponse, setAiResponse] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [pendingCode, setPendingCode] = useState<string | null>(null)
  const [showDiff, setShowDiff] = useState(false)

  // Vision state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageCompressed, setImageCompressed] = useState<string | null>(null)
  const [originalSize, setOriginalSize] = useState(0)
  const [compressedSize, setCompressedSize] = useState(0)
  const [visionPrompt, setVisionPrompt] = useState("")
  const [visionLoading, setVisionLoading] = useState(false)
  const [visionProgress, setVisionProgress] = useState(0)
  const [visionPhase, setVisionPhase] = useState<"idle" | "compressing" | "ready" | "uploading" | "analysing" | "done">("idle")
  const [extractedIds, setExtractedIds] = useState<string[]>([])
  const [newlyAdded, setNewlyAdded] = useState<string[]>([])
  const [visionError, setVisionError] = useState<string | null>(null)
  const [visionRawText, setVisionRawText] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Admin guard ──────────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <Flex h="100%" align="center" justify="center" bg="#0a0a0f" direction="column" gap="4">
        <Icon as={LuShieldCheck} boxSize="48px" color="brand.500" />
        <Text color="gray.400" fontWeight="600" fontSize="lg">Dev Studio — للمطور فقط</Text>
        <Text color="gray.600" fontSize="sm" textAlign="center" maxW="280px">
          هذه الصفحة محمية. سجّل دخولك بإيميل المطور من صفحة الإعدادات.
        </Text>
      </Flex>
    )
  }

  // ── File loading ──────────────────────────────────────────────────────────────
  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/dev/files", { headers: { "x-user-email": userEmail || "" } })
      const data = await res.json()
      if (data.files) setFiles(data.files.sort())
    } catch {}
  }, [userEmail])

  // Initial load
  useState(() => { loadFiles() })

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
        setAiResponse("")
        setPendingCode(null)
        setShowDiff(false)
        if (!openFiles.includes(filePath)) setOpenFiles((p) => [...p, filePath])
        setActivePanel("editor")
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

  // ── Auth guard for saves ──────────────────────────────────────────────────────
  const checkAuthSafety = (filePath: string, newContent: string): string | null => {
    if (!AUTH_FILES.some((af) => filePath.endsWith(af))) return null
    const missing = AUTH_GUARD_PATTERNS.filter((p) => !newContent.includes(p))
    if (missing.length > 0) {
      return `⚠️ الحفظ مرفوض: الكود الجديد يحذف كود الحماية (${missing.join(", ")}). أضف الكود يدويًا أو تراجع.`
    }
    return null
  }

  // ── AI code generation ────────────────────────────────────────────────────────
  const runAI = async () => {
    if (!aiPrompt.trim() || !activeFile) return
    setAiLoading(true)
    setAiResponse("")
    setPendingCode(null)
    setShowDiff(false)

    const system =
      `You are Shrpo Dev AI editing: ${activeFile}.\n\nFile:\n\`\`\`${getLanguage(activeFile)}\n${fileContent}\n\`\`\`\n\n` +
      `IMPORTANT: Never remove isAdmin, rehydrateAdmin, isAdminEmail, or any auth logic.\n` +
      `Return COMPLETE updated file only. Wrap code in a markdown code block.`

    try {
      const res = await fetch("/api/dev/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-email": userEmail || "" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: system },
            { role: "user", content: aiPrompt },
          ],
        }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`) }

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
              if (d) { full += d; setAiResponse(full) }
            } catch {}
          }
        }
      }
      const m = full.match(/```(?:[a-zA-Z0-9]*)?\n?([\s\S]*?)```/)
      setPendingCode(m ? m[1].trim() : full.trim())
    } catch (err: any) {
      toaster.create({ title: "AI Error", description: err.message, type: "error" })
    } finally {
      setAiLoading(false)
    }
  }

  const applyChanges = () => {
    if (!pendingCode || !activeFile) return
    const authErr = checkAuthSafety(activeFile, pendingCode)
    if (authErr) {
      toaster.create({ title: "محظور", description: authErr, type: "error" })
      return
    }
    setFileContent(pendingCode)
    setIsDirty(true)
    setPendingCode(null)
    setShowDiff(false)
    toaster.create({ title: "تم تطبيق التغييرات", type: "info" })
  }

  const saveFile = async () => {
    if (!activeFile || !isDirty) return
    const authErr = checkAuthSafety(activeFile, fileContent)
    if (authErr) {
      toaster.create({ title: "محظور", description: authErr, type: "error" })
      return
    }
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
        toaster.create({ title: "تم الحفظ", type: "success" })
      } else throw new Error(data.error || "Save failed")
    } catch (err: any) {
      toaster.create({ title: "فشل الحفظ", description: err.message, type: "error" })
    }
  }

  // ── Vision: pick & compress ───────────────────────────────────────────────────
  const handlePickImage = async (file: File) => {
    setVisionError(null)
    setExtractedIds([])
    setNewlyAdded([])
    setVisionRawText("")
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setOriginalSize(file.size)
    setVisionPhase("compressing")
    setVisionProgress(0)
    try {
      const compressed = await compressImage(file, 1200, 0.82, setVisionProgress)
      setImageCompressed(compressed)
      const byteLen = Math.round((compressed.length * 3) / 4)
      setCompressedSize(byteLen)
      setVisionProgress(100)
      setVisionPhase("ready")
    } catch (err: any) {
      setVisionError(err.message)
      setVisionPhase("idle")
    }
  }

  // ── Vision: send to API ────────────────────────────────────────────────────────
  const processImage = async () => {
    if (!imageCompressed) return
    setVisionLoading(true)
    setVisionPhase("uploading")
    setVisionProgress(0)
    setVisionError(null)
    setExtractedIds([])
    setNewlyAdded([])

    const userMsg = visionPrompt.trim() ||
      "Extract all NVIDIA model IDs visible in this screenshot. Return only JSON: { \"modelIds\": [...] }"

    try {
      // Simulate upload progress
      const progInterval = setInterval(() => {
        setVisionProgress((p) => (p < 60 ? p + 5 : p))
      }, 300)
      setVisionPhase("analysing")

      const res = await fetch("/api/dev/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-email": userEmail || "" },
        body: JSON.stringify({ imageBase64: imageCompressed, userPrompt: userMsg }),
      })

      clearInterval(progInterval)
      setVisionProgress(80)

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)

      setVisionRawText(data.rawText || "")
      const ids: string[] = data.modelIds || []

      if (!ids.length) {
        setVisionError("لم يتم العثور على أسماء موديلات في الصورة. جرّب صورة أوضح أو أضف نص توضيحي.")
        setVisionPhase("ready")
        setVisionProgress(0)
        return
      }

      setExtractedIds(ids)
      setVisionProgress(90)
      const added = await updateModelRegistry(ids)
      setNewlyAdded(added)
      setVisionProgress(100)
      setVisionPhase("done")

      toaster.create({
        title: added.length ? `✓ أُضيف ${added.length} موديل جديد` : "✓ التحليل اكتمل",
        description: added.length
          ? added.slice(0, 3).join("، ") + (added.length > 3 ? "..." : "")
          : "جميع الموديلات موجودة مسبقًا",
        type: "success",
      })
    } catch (err: any) {
      setVisionError(err.message)
      setVisionPhase("ready")
      setVisionProgress(0)
    } finally {
      setVisionLoading(false)
    }
  }

  // ── Update model registry ─────────────────────────────────────────────────────
  const updateModelRegistry = async (modelIds: string[]): Promise<string[]> => {
    const res = await fetch(`/api/dev/file?path=${encodeURIComponent(MODEL_CONFIG_PATH)}`, {
      headers: { "x-user-email": userEmail || "" },
    })
    const data = await res.json()
    if (!data.content) throw new Error("Could not load model registry")

    const current: string = data.content
    const toAdd = modelIds.filter((id) => !current.includes(`"${id}"`))
    if (!toAdd.length) return []

    const entries = toAdd.map((id) => {
      const name = id.split("/").pop() || id
      return `  {\n    id: "${id}",\n    name: "${name}",\n    provider: "NVIDIA",\n    type: "general",\n    size: "-",\n    description: "Auto-discovered via Image Context",\n    badges: ["new"],\n  },\n`
    })

    const marker = "const ALL_MODELS: ModelConfig[] = [\n"
    const idx = current.indexOf(marker)
    if (idx === -1) throw new Error("Model registry marker not found in index.ts")

    const updated =
      current.slice(0, idx + marker.length) +
      entries.join("") +
      current.slice(idx + marker.length)

    const saveRes = await fetch("/api/dev/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-email": userEmail || "" },
      body: JSON.stringify({ path: MODEL_CONFIG_PATH, content: updated }),
    })
    const saveData = await saveRes.json()
    if (!saveData.success) throw new Error(saveData.error || "Failed to save model registry")
    return toAdd
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

  // File tree grouping
  const fileTree: Record<string, string[]> = {}
  files.forEach((f) => {
    const parts = f.split("/")
    const folder = parts.length > 1 ? parts[0] : "(root)"
    if (!fileTree[folder]) fileTree[folder] = []
    fileTree[folder].push(f)
  })

  // Diff lines
  const diffLines = pendingCode && fileContent ? computeDiff(fileContent, pendingCode) : []
  const diffAdded = diffLines.filter((l) => l.type === "add").length
  const diffRemoved = diffLines.filter((l) => l.type === "remove").length

  // Phase labels
  const phaseLabel: Record<string, string> = {
    idle: "",
    compressing: `ضغط الصورة... ${visionProgress}%`,
    ready: "جاهزة للتحليل",
    uploading: `رفع الصورة... ${visionProgress}%`,
    analysing: `جارٍ التحليل بـ NVIDIA Vision... ${visionProgress}%`,
    done: "اكتمل التحليل ✓",
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Flex h="100%" bg="#0a0a0f" color="white" overflow="hidden" direction={{ base: "column", md: "row" }}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => e.target.files?.[0] && handlePickImage(e.target.files[0])}
      />

      {/* ══ SIDEBAR ════════════════════════════════════════════════════════════ */}
      <Box
        w="210px"
        flexShrink={0}
        borderRight="1px solid"
        borderColor="rgba(99,102,241,0.15)"
        display={{ base: "none", md: "flex" }}
        flexDirection="column"
        bg="rgba(10,10,15,0.98)"
        overflowY="auto"
      >
        <HStack px="3" py="3" gap="2" borderBottom="1px solid" borderColor="rgba(99,102,241,0.1)">
          <Icon as={LuTerminal} color="brand.400" boxSize="14px" />
          <Text fontSize="xs" fontWeight="700" color="brand.300" textTransform="uppercase" letterSpacing="0.08em">Dev Studio</Text>
        </HStack>

        {/* Nav items */}
        {([
          { id: "vision" as PanelId, label: "Image Context", icon: LuScanLine, badge: visionPhase === "done" ? "✓" : undefined },
          { id: "explorer" as PanelId, label: "Files", icon: LuFolder },
          { id: "editor" as PanelId, label: "AI Editor", icon: LuCode },
        ]).map(({ id, label, icon, badge }) => (
          <Box
            key={id}
            px="3" py="2.5" cursor="pointer" transition="all 0.15s"
            bg={activePanel === id ? "rgba(99,102,241,0.15)" : "transparent"}
            borderLeft="2px solid"
            borderColor={activePanel === id ? "brand.400" : "transparent"}
            onClick={() => setActivePanel(id)}
          >
            <HStack gap="2">
              <Icon as={icon} boxSize="13px" color={activePanel === id ? "brand.300" : "gray.500"} />
              <Text fontSize="xs" fontWeight={activePanel === id ? "600" : "400"} color={activePanel === id ? "gray.200" : "gray.500"}>
                {label}
              </Text>
              {badge && <Badge ml="auto" size="sm" colorPalette="green" variant="subtle" fontSize="2xs">{badge}</Badge>}
            </HStack>
          </Box>
        ))}

        <Separator borderColor="rgba(99,102,241,0.1)" my="1" />

        {/* File tree */}
        <Box flex="1" overflowY="auto">
          <HStack px="3" py="1.5" justify="space-between">
            <Text fontSize="2xs" color="gray.600" textTransform="uppercase" letterSpacing="0.06em">Files</Text>
            <Icon as={LuRefreshCw} boxSize="11px" color="gray.600" cursor="pointer" onClick={loadFiles} />
          </HStack>
          {Object.entries(fileTree).map(([folder, folderFiles]) => (
            <Box key={folder}>
              <HStack px="3" py="1" gap="1.5">
                <Icon as={LuFolder} boxSize="10px" color="gray.600" />
                <Text fontSize="2xs" color="gray.600" fontWeight="600">{folder}</Text>
              </HStack>
              {folderFiles.map((f) => (
                <Box
                  key={f} px="5" py="1" cursor="pointer" transition="all 0.1s"
                  bg={activeFile === f ? "rgba(99,102,241,0.12)" : "transparent"}
                  _hover={{ bg: "rgba(99,102,241,0.07)" }}
                  onClick={() => openFile(f)}
                >
                  <Text fontSize="2xs" color={activeFile === f ? "brand.300" : "gray.500"} isTruncated>
                    {f.split("/").pop()}
                  </Text>
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>

      {/* ══ MAIN CONTENT ═══════════════════════════════════════════════════════ */}
      <Flex flex="1" direction="column" overflow="hidden">

        {/* Mobile tabs */}
        <HStack display={{ base: "flex", md: "none" }} gap="0" borderBottom="1px solid" borderColor="rgba(99,102,241,0.15)">
          {(["vision", "explorer", "editor"] as PanelId[]).map((id) => (
            <Button key={id} flex="1" size="sm" borderRadius="0" variant="ghost"
              bg={activePanel === id ? "rgba(99,102,241,0.15)" : "transparent"}
              color={activePanel === id ? "brand.300" : "gray.500"}
              onClick={() => setActivePanel(id)}
            >
              {id === "vision" ? "Vision" : id === "explorer" ? "Files" : "Edit"}
            </Button>
          ))}
        </HStack>

        {/* ══ VISION PANEL ═══════════════════════════════════════════════════ */}
        {activePanel === "vision" && (
          <Box flex="1" overflowY="auto" p={{ base: "4", md: "6" }}>

            {/* Header */}
            <HStack gap="3" mb="5">
              <Box p="2" bg="rgba(99,102,241,0.15)" borderRadius="lg">
                <Icon as={LuScanLine} color="brand.400" boxSize="18px" />
              </Box>
              <VStack align="start" gap="0">
                <Text fontWeight="700" fontSize="md">Image Context</Text>
                <Text fontSize="xs" color="gray.500">ارفع صورة من NVIDIA → حلّلها → تحديث تلقائي للموديلات</Text>
              </VStack>
            </HStack>

            {/* ── Step 1: Upload ── */}
            <Box mb="4">
              <Text fontSize="xs" fontWeight="600" color="gray.500" textTransform="uppercase" letterSpacing="0.06em" mb="2">
                الخطوة 1 — رفع الصورة
              </Text>
              <Box
                border="2px dashed"
                borderColor={imagePreview ? "brand.600" : "rgba(99,102,241,0.3)"}
                borderRadius="xl"
                p="5"
                textAlign="center"
                cursor="pointer"
                _hover={{ borderColor: "brand.400", bg: "rgba(99,102,241,0.04)" }}
                transition="all 0.2s"
                onClick={() => fileInputRef.current?.click()}
              >
                {visionPhase === "compressing" ? (
                  <VStack gap="3">
                    <Spinner color="brand.400" size="md" />
                    <Text fontSize="sm" color="gray.400">{phaseLabel.compressing}</Text>
                    <Box w="full" bg="rgba(255,255,255,0.06)" borderRadius="full" h="4px">
                      <Box bg="brand.400" h="4px" borderRadius="full" w={`${visionProgress}%`} transition="width 0.3s" />
                    </Box>
                  </VStack>
                ) : imagePreview ? (
                  <VStack gap="3">
                    <Box as="img" src={imagePreview} alt="preview" maxH="180px" borderRadius="lg" mx="auto" objectFit="contain" />
                    <HStack gap="2" justify="center" flexWrap="wrap">
                      <Badge colorPalette="gray" variant="subtle" fontSize="xs" fontFamily="mono">{imageFile?.name}</Badge>
                      <Badge colorPalette="orange" variant="subtle" fontSize="xs">أصل: {fmtBytes(originalSize)}</Badge>
                      {compressedSize > 0 && (
                        <Badge colorPalette="green" variant="subtle" fontSize="xs">
                          مضغوط: {fmtBytes(compressedSize)} (−{Math.round((1 - compressedSize / originalSize) * 100)}%)
                        </Badge>
                      )}
                    </HStack>
                    <Text fontSize="xs" color="gray.600">اضغط لتغيير الصورة</Text>
                  </VStack>
                ) : (
                  <VStack gap="3">
                    <Box p="4" bg="rgba(99,102,241,0.1)" borderRadius="xl">
                      <Icon as={LuUpload} boxSize="28px" color="brand.400" />
                    </Box>
                    <Text color="gray.300" fontWeight="500">اضغط لاختيار صورة</Text>
                    <Text fontSize="xs" color="gray.600">PNG / JPG / WebP · يُضغط تلقائيًا إلى max 1200px</Text>
                  </VStack>
                )}
              </Box>

              {/* Upload button alternative */}
              <Button
                mt="3" w="full" size="sm"
                variant="outline"
                borderColor="rgba(99,102,241,0.3)"
                color="gray.400"
                _hover={{ borderColor: "brand.400", color: "white" }}
                onClick={() => fileInputRef.current?.click()}
                leftIcon={<LuUpload />}
              >
                {imageFile ? `تغيير الصورة (${imageFile.name})` : "اختيار صورة"}
              </Button>
            </Box>

            {/* ── Step 2: Custom prompt ── */}
            {visionPhase !== "idle" && (
              <Box mb="4">
                <Text fontSize="xs" fontWeight="600" color="gray.500" textTransform="uppercase" letterSpacing="0.06em" mb="2">
                  الخطوة 2 — ماذا تريد من هذه الصورة؟
                </Text>
                <Textarea
                  value={visionPrompt}
                  onChange={(e) => setVisionPrompt(e.target.value)}
                  placeholder={`مثال: استخرج جميع أسماء الموديلات\nأو: حلّل القائمة وأخبرني بأسماء جميع موديلات الـ Meta\nأو: ما هو الموديل المختار حاليًا؟`}
                  rows={3}
                  fontSize="sm"
                  bg="rgba(255,255,255,0.03)"
                  border="1px solid"
                  borderColor="rgba(99,102,241,0.2)"
                  borderRadius="lg"
                  color="gray.300"
                  _focus={{ borderColor: "brand.400", outline: "none" }}
                  _placeholder={{ color: "gray.600", fontSize: "xs" }}
                  resize="vertical"
                />
                <Text fontSize="xs" color="gray.600" mt="1">
                  اتركه فارغًا لاستخراج أسماء الموديلات تلقائيًا، أو اكتب سؤالًا مخصصًا
                </Text>
              </Box>
            )}

            {/* ── Step 3: Process button ── */}
            {(visionPhase === "ready" || visionPhase === "done") && (
              <Box mb="4">
                <Text fontSize="xs" fontWeight="600" color="gray.500" textTransform="uppercase" letterSpacing="0.06em" mb="2">
                  الخطوة 3 — التحليل
                </Text>
                <Button
                  w="full"
                  size="lg"
                  bg="linear-gradient(135deg, #6366f1, #8b5cf6)"
                  color="white"
                  _hover={{ opacity: 0.9, transform: "translateY(-1px)" }}
                  _active={{ transform: "translateY(0)" }}
                  transition="all 0.2s"
                  onClick={processImage}
                  disabled={visionLoading}
                >
                  <HStack gap="2">
                    {visionLoading ? <Spinner size="sm" /> : <Icon as={LuScanLine} />}
                    <Text>{visionLoading ? phaseLabel[visionPhase] : visionPhase === "done" ? "إعادة التحليل" : "تحليل الصورة بـ NVIDIA Vision"}</Text>
                  </HStack>
                </Button>
              </Box>
            )}

            {/* Processing in progress */}
            {(visionPhase === "uploading" || visionPhase === "analysing") && (
              <Box mb="4" bg="rgba(99,102,241,0.08)" border="1px solid" borderColor="rgba(99,102,241,0.2)" borderRadius="xl" p="4">
                <HStack gap="3" mb="3">
                  <Spinner color="brand.400" size="sm" />
                  <Text fontSize="sm" color="gray.300" fontWeight="500">{phaseLabel[visionPhase]}</Text>
                </HStack>
                <Box w="full" bg="rgba(255,255,255,0.06)" borderRadius="full" h="6px">
                  <Box
                    bg="linear-gradient(90deg, #6366f1, #8b5cf6)"
                    h="6px"
                    borderRadius="full"
                    w={`${visionProgress}%`}
                    transition="width 0.4s ease"
                  />
                </Box>
                <Text fontSize="xs" color="gray.600" mt="2">
                  Timeout: 120 ثانية · Model: {VISION_MODEL}
                </Text>
              </Box>
            )}

            {/* Error */}
            {visionError && (
              <Box bg="rgba(239,68,68,0.08)" border="1px solid" borderColor="rgba(239,68,68,0.25)" borderRadius="lg" p="4" mb="4">
                <HStack gap="2" mb="1">
                  <Icon as={LuCircleAlert} color="red.400" boxSize="15px" />
                  <Text fontSize="sm" color="red.300" fontWeight="600">خطأ</Text>
                </HStack>
                <Text fontSize="xs" color="red.400">{visionError}</Text>
              </Box>
            )}

            {/* Results */}
            {visionPhase === "done" && extractedIds.length > 0 && (
              <Box bg="rgba(99,102,241,0.07)" border="1px solid" borderColor="rgba(99,102,241,0.2)" borderRadius="xl" p="5" mb="4">
                <HStack gap="2" mb="4">
                  <Icon as={LuCheck} color="green.400" boxSize="16px" />
                  <Text fontWeight="700" fontSize="sm">نتيجة التحليل</Text>
                  <Badge colorPalette="brand" variant="subtle" ml="auto">{extractedIds.length} موديل</Badge>
                </HStack>

                <VStack align="start" gap="2" mb="4">
                  {extractedIds.map((id) => {
                    const isNew = newlyAdded.includes(id)
                    return (
                      <HStack key={id} gap="2" w="full">
                        <Box w="1.5" h="1.5" borderRadius="full" bg={isNew ? "green.400" : "gray.600"} flexShrink={0} />
                        <Text fontSize="xs" fontFamily="mono" color={isNew ? "gray.200" : "gray.500"} flex="1" isTruncated>{id}</Text>
                        {isNew && <Badge colorPalette="green" variant="subtle" fontSize="2xs" flexShrink={0}>جديد</Badge>}
                      </HStack>
                    )
                  })}
                </VStack>

                {newlyAdded.length > 0 ? (
                  <Box bg="rgba(34,197,94,0.08)" border="1px solid" borderColor="rgba(34,197,94,0.2)" borderRadius="lg" p="3">
                    <Text fontSize="xs" color="green.400" fontWeight="600">
                      ✓ أُضيف {newlyAdded.length} موديل جديد إلى {MODEL_CONFIG_PATH}
                    </Text>
                  </Box>
                ) : (
                  <Box bg="rgba(99,102,241,0.06)" borderRadius="lg" p="3">
                    <Text fontSize="xs" color="gray.500">جميع الموديلات موجودة مسبقًا في النظام</Text>
                  </Box>
                )}

                {/* Raw response toggle */}
                {visionRawText && (
                  <Box mt="3">
                    <Text fontSize="xs" color="gray.600" mb="1">الرد الخام من الموديل:</Text>
                    <Box
                      bg="rgba(0,0,0,0.4)" borderRadius="md" p="3" maxH="100px" overflowY="auto"
                      fontFamily="mono" fontSize="2xs" color="gray.500"
                    >
                      {visionRawText.slice(0, 500)}{visionRawText.length > 500 ? "..." : ""}
                    </Box>
                  </Box>
                )}
              </Box>
            )}

            {/* Info footer */}
            <Box p="3" bg="rgba(99,102,241,0.05)" borderRadius="lg" border="1px solid" borderColor="rgba(99,102,241,0.1)">
              <Text fontSize="xs" color="gray.600" lineHeight="tall">
                <Text as="span" color="brand.400" fontWeight="600">Vision: </Text>{VISION_MODEL}
                {"  ·  "}
                <Text as="span" color="brand.400" fontWeight="600">Timeout: </Text>120s
                {"  ·  "}
                <Text as="span" color="brand.400" fontWeight="600">ضغط: </Text>max 1200px JPEG 82%
              </Text>
            </Box>
          </Box>
        )}

        {/* ══ EXPLORER PANEL (mobile) ═════════════════════════════════════════ */}
        {activePanel === "explorer" && (
          <Box flex="1" overflowY="auto" p="3">
            <HStack justify="space-between" mb="3">
              <Text fontSize="xs" color="gray.500" fontWeight="600" textTransform="uppercase" letterSpacing="0.06em">ملفات المشروع</Text>
              <Icon as={LuRefreshCw} boxSize="12px" color="gray.600" cursor="pointer" onClick={loadFiles} />
            </HStack>
            {Object.entries(fileTree).map(([folder, folderFiles]) => (
              <Box key={folder} mb="2">
                <HStack gap="1.5" mb="1">
                  <Icon as={LuFolder} boxSize="11px" color="gray.600" />
                  <Text fontSize="2xs" color="gray.600" fontWeight="700">{folder}</Text>
                </HStack>
                {folderFiles.map((f) => (
                  <Box
                    key={f} pl="5" pr="3" py="1.5" cursor="pointer" borderRadius="md"
                    bg={activeFile === f ? "rgba(99,102,241,0.12)" : "transparent"}
                    _hover={{ bg: "rgba(99,102,241,0.07)" }}
                    onClick={() => openFile(f)}
                  >
                    <Text fontSize="xs" color={activeFile === f ? "brand.300" : "gray.400"} isTruncated>{f.split("/").pop()}</Text>
                  </Box>
                ))}
              </Box>
            ))}
          </Box>
        )}

        {/* ══ EDITOR PANEL ═══════════════════════════════════════════════════ */}
        {activePanel === "editor" && (
          <Flex flex="1" direction="column" overflow="hidden">
            {/* Open file tabs */}
            {openFiles.length > 0 && (
              <HStack gap="0" borderBottom="1px solid" borderColor="rgba(99,102,241,0.1)" overflowX="auto" flexShrink={0} bg="rgba(10,10,15,0.8)">
                {openFiles.map((f) => (
                  <HStack
                    key={f} gap="2" px="3" py="2" cursor="pointer" flexShrink={0}
                    borderBottom="2px solid"
                    borderColor={activeFile === f ? "brand.400" : "transparent"}
                    bg={activeFile === f ? "rgba(99,102,241,0.1)" : "transparent"}
                    onClick={() => openFile(f)}
                  >
                    <Text fontSize="xs" color={activeFile === f ? "gray.200" : "gray.500"}>
                      {f.split("/").pop()}
                    </Text>
                    {activeFile === f && isDirty && <Box w="1.5" h="1.5" borderRadius="full" bg="orange.400" />}
                    <Icon
                      as={LuX} boxSize="10px" color="gray.600"
                      _hover={{ color: "gray.300" }}
                      onClick={(e) => { e.stopPropagation(); closeFile(f) }}
                    />
                  </HStack>
                ))}
              </HStack>
            )}

            {activeFile ? (
              <>
                {/* ── Diff view ── */}
                {showDiff && pendingCode ? (
                  <Box flex="1" overflowY="auto" fontFamily="mono" fontSize="xs">
                    <HStack px="4" py="2" bg="rgba(10,10,15,0.9)" borderBottom="1px solid" borderColor="rgba(99,102,241,0.1)" flexShrink={0}>
                      <Icon as={LuFileDiff} color="brand.400" boxSize="13px" />
                      <Text fontSize="xs" color="gray.400">معاينة التغييرات</Text>
                      <Badge colorPalette="green" variant="subtle" fontSize="2xs" ml="2">+{diffAdded}</Badge>
                      <Badge colorPalette="red" variant="subtle" fontSize="2xs">−{diffRemoved}</Badge>
                      <Button
                        size="xs" variant="ghost" ml="auto" color="gray.500"
                        onClick={() => setShowDiff(false)}
                      >
                        <Icon as={LuX} boxSize="11px" />
                      </Button>
                    </HStack>
                    <Box overflowY="auto" flex="1">
                      {diffLines.map((line, i) => (
                        <Box
                          key={i}
                          px="4" py="0.5"
                          bg={
                            line.type === "add" ? "rgba(34,197,94,0.1)" :
                            line.type === "remove" ? "rgba(239,68,68,0.1)" :
                            "transparent"
                          }
                          borderLeft="3px solid"
                          borderColor={
                            line.type === "add" ? "green.500" :
                            line.type === "remove" ? "red.500" :
                            "transparent"
                          }
                        >
                          <Text
                            color={
                              line.type === "add" ? "green.300" :
                              line.type === "remove" ? "red.300" :
                              "gray.600"
                            }
                            whiteSpace="pre"
                            fontSize="xs"
                          >
                            {line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  "}
                            {line.text}
                          </Text>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                ) : (
                  <Box flex="1" overflow="hidden">
                    {loadingFile ? (
                      <Flex h="full" align="center" justify="center">
                        <Spinner color="brand.400" />
                      </Flex>
                    ) : (
                      <Editor
                        height="100%"
                        language={getLanguage(activeFile)}
                        value={fileContent}
                        onChange={(v) => { setFileContent(v || ""); setIsDirty(v !== originalContent) }}
                        theme="vs-dark"
                        options={{ fontSize: 13, minimap: { enabled: false }, wordWrap: "on", scrollBeyondLastLine: false }}
                      />
                    )}
                  </Box>
                )}

                {/* ── AI prompt bar ── */}
                <Box
                  borderTop="1px solid" borderColor="rgba(99,102,241,0.15)"
                  bg="rgba(10,10,15,0.98)" p="3" flexShrink={0}
                >
                  {/* Status bar */}
                  <HStack gap="2" mb="2" flexWrap="wrap">
                    <HStack gap="1.5">
                      <Icon as={LuSparkles} color="brand.400" boxSize="11px" />
                      <Text fontSize="2xs" color="gray.600" fontFamily="mono">{CODER_MODEL}</Text>
                    </HStack>
                    {AUTH_FILES.some((af) => activeFile?.endsWith(af)) && (
                      <Badge colorPalette="orange" variant="subtle" fontSize="2xs">
                        <Icon as={LuShieldCheck} boxSize="9px" mr="1" />
                        محمي
                      </Badge>
                    )}
                    {isDirty && <Badge colorPalette="orange" variant="subtle" fontSize="2xs">تغييرات غير محفوظة</Badge>}
                    {pendingCode && (
                      <Badge colorPalette="purple" variant="subtle" fontSize="2xs" cursor="pointer" onClick={() => setShowDiff(!showDiff)}>
                        <Icon as={LuEye} boxSize="9px" mr="1" />
                        {showDiff ? "إخفاء Diff" : "عرض Diff"}
                      </Badge>
                    )}
                  </HStack>

                  {/* Prompt + action buttons */}
                  <HStack gap="2" align="flex-end">
                    <Textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="اطلب تعديلًا على الكود... (مثل: أضف dark mode toggle)"
                      fontSize="sm"
                      resize="none"
                      rows={2}
                      bg="rgba(255,255,255,0.03)"
                      border="1px solid"
                      borderColor="rgba(99,102,241,0.2)"
                      borderRadius="lg"
                      _focus={{ borderColor: "brand.400", outline: "none" }}
                      flex="1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runAI() }
                      }}
                    />
                    <VStack gap="1.5" flexShrink={0}>
                      <Button
                        size="sm" w="8" h="8" p="0"
                        bg="linear-gradient(135deg, #6366f1, #8b5cf6)"
                        color="white" borderRadius="lg"
                        onClick={runAI}
                        disabled={aiLoading || !aiPrompt.trim()}
                        title="توليد (Enter)"
                      >
                        {aiLoading ? <Spinner size="xs" /> : <Icon as={LuSend} boxSize="13px" />}
                      </Button>
                      <Button
                        size="sm" w="8" h="8" p="0"
                        variant="ghost" colorScheme="green"
                        borderRadius="lg" border="1px solid"
                        borderColor={pendingCode ? "green.600" : "gray.700"}
                        onClick={applyChanges}
                        disabled={!pendingCode}
                        title="تطبيق التغييرات"
                      >
                        <Icon as={LuCheck} boxSize="13px" color={pendingCode ? "green.400" : "gray.600"} />
                      </Button>
                      <Button
                        size="sm" w="8" h="8" p="0"
                        variant="ghost"
                        borderRadius="lg" border="1px solid"
                        borderColor={isDirty ? "blue.600" : "gray.700"}
                        onClick={saveFile}
                        disabled={!isDirty}
                        title="حفظ الملف"
                      >
                        <Icon as={LuSave} boxSize="13px" color={isDirty ? "blue.400" : "gray.600"} />
                      </Button>
                    </VStack>
                  </HStack>

                  {/* AI response preview */}
                  {aiResponse && !pendingCode && (
                    <Box
                      mt="2" maxH="80px" overflowY="auto"
                      bg="rgba(0,0,0,0.4)" borderRadius="md" p="2"
                    >
                      <Text fontSize="2xs" color="gray.500" fontFamily="mono" whiteSpace="pre-wrap">
                        {aiResponse.slice(0, 300)}{aiResponse.length > 300 ? "..." : ""}
                      </Text>
                    </Box>
                  )}
                </Box>
              </>
            ) : (
              <Flex flex="1" align="center" justify="center" direction="column" gap="3">
                <Box p="4" bg="rgba(99,102,241,0.08)" borderRadius="xl">
                  <Icon as={LuCode} boxSize="28px" color="gray.600" />
                </Box>
                <Text color="gray.600" fontSize="sm">اختر ملفًا من القائمة على اليسار</Text>
                <Button size="sm" variant="ghost" color="brand.400" onClick={loadFiles} leftIcon={<LuRefreshCw />}>
                  تحديث القائمة
                </Button>
              </Flex>
            )}
          </Flex>
        )}
      </Flex>
    </Flex>
  )
}

