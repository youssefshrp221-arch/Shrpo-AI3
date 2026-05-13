import { useState, useEffect, useCallback, useRef } from "react"
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
  Separator,
  Input,
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
} from "react-icons/lu"
import { useAppStore } from "@/store/appStore"
import { toaster } from "@/components/ui/toaster"

const CODER_MODEL = "qwen/qwen3-coder-480b-a35b-instruct"
const MODEL_CONFIG_PATH = "index.ts"

type PanelId = "explorer" | "editor" | "vision"

// ── Image helpers ──────────────────────────────────────────────────────────────

async function compressImage(file: File, maxWidth = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error("Failed to decode image"))
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement("canvas")
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext("2d")!
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL("image/jpeg", quality))
      }
      img.src = e.target!.result as string
    }
    reader.readAsDataURL(file)
  })
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// ── DevStudio ─────────────────────────────────────────────────────────────────

export default function DevStudio() {
  const isMobile = useBreakpointValue({ base: true, md: false })
  const userEmail = useAppStore((s) => s.userEmail)
  const isAdmin = useAppStore((s) => s.isAdmin)

  const [activePanel, setActivePanel] = useState<PanelId>("vision")

  // File explorer state
  const [files, setFiles] = useState<string[]>([])
  const [openFiles, setOpenFiles] = useState<string[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState("")
  const [originalContent, setOriginalContent] = useState("")
  const [isDirty, setIsDirty] = useState(false)
  const [loadingFile, setLoadingFile] = useState(false)

  // AI assistant state
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiResponse, setAiResponse] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [pendingCode, setPendingCode] = useState<string | null>(null)

  // Vision / image-context state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageCompressed, setImageCompressed] = useState<string | null>(null)
  const [originalSize, setOriginalSize] = useState(0)
  const [compressedSize, setCompressedSize] = useState(0)
  const [visionLoading, setVisionLoading] = useState(false)
  const [visionStep, setVisionStep] = useState<"idle" | "compressing" | "ready" | "analysing" | "done">("idle")
  const [extractedIds, setExtractedIds] = useState<string[]>([])
  const [newlyAdded, setNewlyAdded] = useState<string[]>([])
  const [visionError, setVisionError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Admin guard ──────────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <Flex h="100%" align="center" justify="center" bg="#0a0a0f" direction="column" gap="4">
        <Icon as={LuShieldCheck} boxSize="48px" color="brand.500" />
        <Text color="gray.400" fontWeight="600">Dev Studio — Admin Only</Text>
        <Text color="gray.600" fontSize="sm">هذه الصفحة متاحة فقط لـ {userEmail || "غير مسجّل"}</Text>
      </Flex>
    )
  }

  // ── Load file list ───────────────────────────────────────────────────────────
  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/dev/files", { headers: { "x-user-email": userEmail || "" } })
      const data = await res.json()
      if (data.files) setFiles(data.files.sort())
    } catch {}
  }, [userEmail])

  useEffect(() => { loadFiles() }, [loadFiles])

  // ── File open ────────────────────────────────────────────────────────────────
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
        if (!openFiles.includes(filePath)) setOpenFiles((p) => [...p, filePath])
        if (isMobile) setActivePanel("editor")
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

  // ── AI generate ──────────────────────────────────────────────────────────────
  const runAI = async () => {
    if (!aiPrompt.trim() || !activeFile) return
    setAiLoading(true)
    setAiResponse("")
    setPendingCode(null)

    const system =
      `You are Shrpo Dev AI editing: ${activeFile}.\n\nFile:\n\`\`\`${getLanguage(activeFile)}\n${fileContent}\n\`\`\`\n\n` +
      `Rules: return COMPLETE updated file only, no outside explanations. Wrap final code in a markdown code block.`

    try {
      const res = await fetch("/api/dev/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-email": userEmail || "" },
        body: JSON.stringify({ messages: [{ role: "system", content: system }, { role: "user", content: aiPrompt }] }),
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
            try { const j = JSON.parse(t.slice(6)); const d = j?.choices?.[0]?.delta?.content; if (d) { full += d; setAiResponse(full) } } catch {}
          }
        }
      }
      const m = full.match(/```(?:[a-zA-Z0-9]*)?\n?([\s\S]*?)```$/)
      setPendingCode(m ? m[1].trim() : full.trim())
    } catch (err: any) {
      toaster.create({ title: "AI Error", description: err.message, type: "error" })
    } finally { setAiLoading(false) }
  }

  const applyChanges = () => {
    if (!pendingCode || !activeFile) return
    setFileContent(pendingCode)
    setIsDirty(true)
    setPendingCode(null)
    toaster.create({ title: "Changes applied", type: "info" })
  }

  const saveFile = async () => {
    if (!activeFile || !isDirty) return
    try {
      const res = await fetch("/api/dev/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-email": userEmail || "" },
        body: JSON.stringify({ path: activeFile, content: fileContent }),
      })
      const data = await res.json()
      if (data.success) { setOriginalContent(fileContent); setIsDirty(false); toaster.create({ title: "Saved", type: "success" }) }
      else throw new Error(data.error || "Save failed")
    } catch (err: any) { toaster.create({ title: "Save failed", description: err.message, type: "error" }) }
  }

  // ── Vision: pick & compress image ────────────────────────────────────────────
  const handlePickImage = async (file: File) => {
    setVisionError(null)
    setExtractedIds([])
    setNewlyAdded([])
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setOriginalSize(file.size)
    setVisionStep("compressing")
    try {
      const compressed = await compressImage(file, 1200, 0.82)
      setImageCompressed(compressed)
      const byteLen = Math.round((compressed.length * 3) / 4)
      setCompressedSize(byteLen)
      setVisionStep("ready")
    } catch (err: any) {
      setVisionError(err.message)
      setVisionStep("idle")
    }
  }

  // ── Vision: send to NVIDIA and update registry ────────────────────────────────
  const processImage = async () => {
    if (!imageCompressed) return
    setVisionLoading(true)
    setVisionStep("analysing")
    setVisionError(null)
    setExtractedIds([])
    setNewlyAdded([])

    try {
      const res = await fetch("/api/dev/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-email": userEmail || "" },
        body: JSON.stringify({ imageBase64: imageCompressed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)

      const ids: string[] = data.modelIds || []
      if (!ids.length) {
        setVisionError("لم يتم العثور على أسماء موديلات في الصورة.")
        setVisionStep("ready")
        return
      }

      setExtractedIds(ids)
      const added = await updateModelRegistry(ids)
      setNewlyAdded(added)
      setVisionStep("done")

      toaster.create({
        title: `تم بنجاح ✓`,
        description: added.length
          ? `أُضيف ${added.length} موديل جديد: ${added.slice(0, 3).join(", ")}${added.length > 3 ? "..." : ""}`
          : `${ids.length} موديل موجود مسبقًا — لا يوجد جديد`,
        type: "success",
      })
    } catch (err: any) {
      setVisionError(err.message)
      setVisionStep("ready")
    } finally {
      setVisionLoading(false)
    }
  }

  // ── Update model registry in index.ts ────────────────────────────────────────
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

    const updated = current.slice(0, idx + marker.length) + entries.join("") + current.slice(idx + marker.length)

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

  const fileTree: Record<string, string[]> = {}
  files.forEach((f) => {
    const parts = f.split("/")
    const folder = parts.length > 1 ? parts[0] : "(root)"
    if (!fileTree[folder]) fileTree[folder] = []
    fileTree[folder].push(f)
  })

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Flex h="100%" bg="#0a0a0f" color="white" overflow="hidden" direction={{ base: "column", md: "row" }}>
      {/* ── Hidden file input ── */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => e.target.files?.[0] && handlePickImage(e.target.files[0])}
      />

      {/* ══ SIDEBAR (desktop) ══════════════════════════════════════════════════ */}
      <Box
        w="220px"
        flexShrink={0}
        borderRight="1px solid"
        borderColor="rgba(99,102,241,0.15)"
        overflowY="auto"
        display={{ base: "none", md: "flex" }}
        flexDirection="column"
        bg="rgba(10,10,15,0.98)"
      >
        {/* Header */}
        <HStack px="3" py="3" gap="2" borderBottom="1px solid" borderColor="rgba(99,102,241,0.1)">
          <Icon as={LuTerminal} color="brand.400" boxSize="14px" />
          <Text fontSize="xs" fontWeight="700" color="brand.300" textTransform="uppercase" letterSpacing="0.08em">Dev Studio</Text>
        </HStack>

        {/* Nav */}
        {(["vision", "explorer", "editor"] as PanelId[]).map((id) => {
          const label = id === "vision" ? "Image Context" : id === "explorer" ? "Files" : "AI Edit"
          const ico = id === "vision" ? LuScanLine : id === "explorer" ? LuFolder : LuCode
          return (
            <Box
              key={id}
              px="3" py="2.5" cursor="pointer" transition="all 0.15s"
              bg={activePanel === id ? "rgba(99,102,241,0.15)" : "transparent"}
              borderLeft="2px solid"
              borderColor={activePanel === id ? "brand.400" : "transparent"}
              onClick={() => setActivePanel(id)}
            >
              <HStack gap="2">
                <Icon as={ico} boxSize="13px" color={activePanel === id ? "brand.300" : "gray.500"} />
                <Text fontSize="xs" fontWeight={activePanel === id ? "600" : "400"} color={activePanel === id ? "gray.200" : "gray.500"}>{label}</Text>
                {id === "vision" && visionStep === "done" && <Badge size="sm" colorPalette="green" variant="subtle" fontSize="2xs">✓</Badge>}
              </HStack>
            </Box>
          )
        })}

        <Separator borderColor="rgba(99,102,241,0.1)" my="2" />

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
                  onClick={() => { openFile(f); setActivePanel("editor") }}
                >
                  <Text fontSize="2xs" color={activeFile === f ? "brand.300" : "gray.500"} isTruncated>{f.split("/").pop()}</Text>
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>

      {/* ══ MAIN CONTENT ═══════════════════════════════════════════════════════ */}
      <Flex flex="1" direction="column" overflow="hidden">

        {/* Mobile panel tabs */}
        <HStack display={{ base: "flex", md: "none" }} gap="0" borderBottom="1px solid" borderColor="rgba(99,102,241,0.15)">
          {(["vision", "explorer", "editor"] as PanelId[]).map((id) => {
            const label = id === "vision" ? "Vision" : id === "explorer" ? "Files" : "Edit"
            return (
              <Button key={id} flex="1" size="sm" borderRadius="0" variant="ghost"
                bg={activePanel === id ? "rgba(99,102,241,0.15)" : "transparent"}
                color={activePanel === id ? "brand.300" : "gray.500"}
                onClick={() => setActivePanel(id)}
              >{label}</Button>
            )
          })}
        </HStack>

        {/* ── VISION PANEL ─────────────────────────────────────────────────── */}
        {activePanel === "vision" && (
          <Box flex="1" overflowY="auto" p={{ base: "4", md: "6" }}>
            {/* Title */}
            <HStack gap="3" mb="5">
              <Icon as={LuScanLine} color="brand.400" boxSize="20px" />
              <VStack align="start" gap="0">
                <Text fontWeight="700" fontSize="md">Image Context</Text>
                <Text fontSize="xs" color="gray.500">ارفع صورة من NVIDIA وسيتم استخراج أسماء الموديلات تلقائيًا</Text>
              </VStack>
            </HStack>

            {/* Step 1 — Upload */}
            <Box
              border="2px dashed"
              borderColor={imagePreview ? "brand.600" : "rgba(99,102,241,0.3)"}
              borderRadius="xl"
              p="6"
              textAlign="center"
              cursor="pointer"
              _hover={{ borderColor: "brand.400", bg: "rgba(99,102,241,0.05)" }}
              transition="all 0.2s"
              onClick={() => fileInputRef.current?.click()}
              mb="4"
            >
              {visionStep === "compressing" ? (
                <VStack gap="3">
                  <Spinner color="brand.400" size="md" />
                  <Text fontSize="sm" color="gray.400">جارٍ ضغط الصورة...</Text>
                </VStack>
              ) : imagePreview ? (
                <VStack gap="3">
                  <Box as="img" src={imagePreview} alt="preview" maxH="200px" borderRadius="lg" mx="auto" />
                  <HStack gap="4" justify="center" flexWrap="wrap">
                    <Badge colorPalette="gray" variant="subtle" fontSize="xs">{imageFile?.name}</Badge>
                    <Badge colorPalette="orange" variant="subtle" fontSize="xs">الأصل: {formatBytes(originalSize)}</Badge>
                    {compressedSize > 0 && (
                      <Badge colorPalette="green" variant="subtle" fontSize="xs">
                        بعد الضغط: {formatBytes(compressedSize)} ({Math.round((1 - compressedSize / originalSize) * 100)}% أقل)
                      </Badge>
                    )}
                  </HStack>
                  <Text fontSize="xs" color="gray.600">اضغط لتغيير الصورة</Text>
                </VStack>
              ) : (
                <VStack gap="3">
                  <Icon as={LuUpload} boxSize="32px" color="gray.600" />
                  <Text color="gray.400" fontWeight="500">اضغط لرفع صورة من NVIDIA</Text>
                  <Text fontSize="xs" color="gray.600">PNG / JPG / WebP — سيتم ضغطها تلقائيًا</Text>
                </VStack>
              )}
            </Box>

            {/* Step 2 — Process */}
            {(visionStep === "ready" || visionStep === "analysing" || visionStep === "done") && (
              <Button
                w="full"
                bg="linear-gradient(135deg, #6366f1, #8b5cf6)"
                color="white"
                size="lg"
                mb="4"
                _hover={{ opacity: 0.9, transform: "translateY(-1px)" }}
                transition="all 0.2s"
                onClick={processImage}
                disabled={visionLoading}
              >
                {visionLoading ? (
                  <HStack gap="3">
                    <Spinner size="sm" />
                    <Text>جارٍ التحليل بموديل الرؤية... (قد يستغرق حتى 120 ثانية)</Text>
                  </HStack>
                ) : (
                  <HStack gap="2">
                    <Icon as={LuScanLine} />
                    <Text>{visionStep === "done" ? "إعادة التحليل" : "تحليل الصورة باستخدام NVIDIA Vision"}</Text>
                  </HStack>
                )}
              </Button>
            )}

            {/* Error */}
            {visionError && (
              <Box bg="rgba(239,68,68,0.1)" border="1px solid" borderColor="rgba(239,68,68,0.3)" borderRadius="lg" p="4" mb="4">
                <HStack gap="2">
                  <Icon as={LuCircleAlert} color="red.400" />
                  <Text fontSize="sm" color="red.300">{visionError}</Text>
                </HStack>
              </Box>
            )}

            {/* Results */}
            {visionStep === "done" && extractedIds.length > 0 && (
              <Box bg="rgba(99,102,241,0.07)" border="1px solid" borderColor="rgba(99,102,241,0.2)" borderRadius="xl" p="5">
                <HStack gap="2" mb="3">
                  <Icon as={LuCheck} color="green.400" boxSize="16px" />
                  <Text fontWeight="600" fontSize="sm">النتيجة</Text>
                </HStack>

                <Text fontSize="xs" color="gray.500" mb="2">الموديلات المستخرجة من الصورة ({extractedIds.length}):</Text>
                <VStack align="start" gap="1.5" mb="4">
                  {extractedIds.map((id) => {
                    const isNew = newlyAdded.includes(id)
                    return (
                      <HStack key={id} gap="2">
                        <Badge
                          colorPalette={isNew ? "green" : "gray"}
                          variant="subtle"
                          fontSize="xs"
                          fontFamily="mono"
                        >
                          {id}
                        </Badge>
                        {isNew && <Badge colorPalette="green" variant="subtle" fontSize="2xs">جديد</Badge>}
                      </HStack>
                    )
                  })}
                </VStack>

                {newlyAdded.length > 0 ? (
                  <Box bg="rgba(34,197,94,0.08)" border="1px solid" borderColor="rgba(34,197,94,0.2)" borderRadius="lg" p="3">
                    <Text fontSize="xs" color="green.400" fontWeight="600">
                      ✓ تم إضافة {newlyAdded.length} موديل جديد إلى النظام في `index.ts`
                    </Text>
                  </Box>
                ) : (
                  <Box bg="rgba(99,102,241,0.08)" borderRadius="lg" p="3">
                    <Text fontSize="xs" color="gray.400">جميع الموديلات موجودة مسبقًا — لا يوجد جديد للإضافة</Text>
                  </Box>
                )}
              </Box>
            )}

            {/* Info bar */}
            <Box mt="5" p="3" bg="rgba(99,102,241,0.06)" borderRadius="lg" border="1px solid" borderColor="rgba(99,102,241,0.12)">
              <Text fontSize="xs" color="gray.600" lineHeight="1.6">
                <Text as="span" color="brand.400" fontWeight="600">Vision model: </Text>
                meta/llama-3.2-90b-vision-instruct
                <Text as="span" mx="2">·</Text>
                <Text as="span" color="brand.400" fontWeight="600">Timeout: </Text>
                120 ثانية
                <Text as="span" mx="2">·</Text>
                <Text as="span" color="brand.400" fontWeight="600">ضغط تلقائي: </Text>
                حتى 1200px JPEG
              </Text>
            </Box>
          </Box>
        )}

        {/* ── FILE EXPLORER (mobile / panel) ───────────────────────────────── */}
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
                    onClick={() => { openFile(f); setActivePanel("editor") }}
                  >
                    <Text fontSize="xs" color={activeFile === f ? "brand.300" : "gray.400"} isTruncated>{f.split("/").pop()}</Text>
                  </Box>
                ))}
              </Box>
            ))}
          </Box>
        )}

        {/* ── AI EDITOR PANEL ──────────────────────────────────────────────── */}
        {activePanel === "editor" && (
          <Flex flex="1" direction="column" overflow="hidden">
            {/* Open file tabs */}
            {openFiles.length > 0 && (
              <HStack gap="0" borderBottom="1px solid" borderColor="rgba(99,102,241,0.1)" overflowX="auto" flexShrink={0}>
                {openFiles.map((f) => (
                  <HStack
                    key={f} gap="2" px="3" py="2" cursor="pointer" flexShrink={0}
                    borderBottom="2px solid"
                    borderColor={activeFile === f ? "brand.400" : "transparent"}
                    bg={activeFile === f ? "rgba(99,102,241,0.08)" : "transparent"}
                    onClick={() => openFile(f)}
                  >
                    <Text fontSize="xs" color={activeFile === f ? "gray.200" : "gray.500"}>{f.split("/").pop()}</Text>
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
                {/* Monaco Editor */}
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
                      options={{ fontSize: 13, minimap: { enabled: false }, wordWrap: "on" }}
                    />
                  )}
                </Box>

                {/* AI prompt bar */}
                <Box borderTop="1px solid" borderColor="rgba(99,102,241,0.15)" bg="rgba(10,10,15,0.98)" p="3" flexShrink={0}>
                  <HStack gap="2" mb="2">
                    <Icon as={LuSparkles} color="brand.400" boxSize="13px" />
                    <Text fontSize="2xs" color="gray.600" fontFamily="mono">{CODER_MODEL}</Text>
                  </HStack>
                  <HStack gap="2">
                    <Textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="اطلب تعديلًا على الكود..."
                      fontSize="sm"
                      resize="none"
                      rows={2}
                      bg="rgba(255,255,255,0.03)"
                      border="1px solid"
                      borderColor="rgba(99,102,241,0.2)"
                      _focus={{ borderColor: "brand.400", outline: "none" }}
                      flex="1"
                    />
                    <VStack gap="1.5">
                      <Button
                        size="sm"
                        bg="linear-gradient(135deg, #6366f1, #8b5cf6)"
                        color="white"
                        onClick={runAI}
                        disabled={aiLoading || !aiPrompt.trim()}
                        title="توليد"
                      >
                        {aiLoading ? <Spinner size="xs" /> : <Icon as={LuSend} boxSize="13px" />}
                      </Button>
                      <Button size="sm" variant="ghost" colorScheme="green" onClick={applyChanges} disabled={!pendingCode} title="تطبيق">
                        <Icon as={LuCheck} boxSize="13px" />
                      </Button>
                      <Button size="sm" variant="ghost" colorScheme="blue" onClick={saveFile} disabled={!isDirty} title="حفظ">
                        <Icon as={LuSave} boxSize="13px" />
                      </Button>
                    </VStack>
                  </HStack>
                  {aiResponse && (
                    <Box mt="2" maxH="120px" overflowY="auto" bg="rgba(0,0,0,0.4)" borderRadius="md" p="2">
                      <Text fontSize="xs" color="gray.400" fontFamily="mono" whiteSpace="pre-wrap">{aiResponse.slice(0, 400)}{aiResponse.length > 400 ? "..." : ""}</Text>
                    </Box>
                  )}
                </Box>
              </>
            ) : (
              <Flex flex="1" align="center" justify="center" direction="column" gap="3">
                <Icon as={LuCode} boxSize="32px" color="gray.700" />
                <Text color="gray.600" fontSize="sm">اختر ملفًا من القائمة</Text>
              </Flex>
            )}
          </Flex>
        )}
      </Flex>
    </Flex>
  )
}
