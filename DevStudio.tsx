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
  Input,
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
  LuUpload,
  LuImage,
} from "react-icons/lu"
import { useAppStore } from "@/store/appStore"
import { toaster } from "@/components/ui/toaster"

const CODER_MODEL = "qwen/qwen3-coder-480b-a35b-instruct"
const VISION_MODEL = "meta/llama-3.2-90b-vision-instruct"
const MODEL_CONFIG_PATH = "index.ts"

type PanelId = "explorer" | "editor" | "ai"

export default function DevStudio() {
  const isMobile = useBreakpointValue({ base: true, md: false })
  const [activePanel, setActivePanel] = useState<PanelId>("explorer")
  const userEmail = useAppStore((s) => s.userEmail)

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
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageContextLoading, setImageContextLoading] = useState(false)

  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/dev/files", {
        headers: { "x-user-email": userEmail || "" },
      })
      const data = await res.json()
      if (data.files) setFiles(data.files.sort())
      else if (data.error) toaster.create({ title: data.error, type: "error" })
    } catch (err) {
      console.error("Failed to load files", err)
    }
  }, [userEmail])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

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
        if (!openFiles.includes(filePath)) setOpenFiles((prev) => [...prev, filePath])
        if (isMobile) setActivePanel("editor")
      }
    } catch {
      toaster.create({ title: "Error loading file", type: "error" })
    } finally {
      setLoadingFile(false)
    }
  }

  const runAI = async () => {
    if (!aiPrompt.trim() || !activeFile) return
    setAiLoading(true)
    setAiResponse("")
    setPendingCode(null)

    const system = `You are Shrpo Dev AI. You are editing the file: ${activeFile}.\n\nCurrent file content:\n\n\`\`\`${getLanguage(activeFile)}\n${fileContent}\n\`\`\`\n\nRules:\n- Only return the COMPLETE updated file code (no explanations outside the code unless necessary).\n- Include ALL unchanged parts as they are.\n- If the user's request is a bug fix, carefully identify and fix the issue.\n- If the user's request is a feature, add it without breaking existing code.\n- Wrap ONLY the final code output in a markdown code block with the language tag.`

    try {
      const response = await fetch("/api/dev/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": userEmail || "",
        },
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

      const codeBlockMatch = fullText.match(/```(?:[a-zA-Z0-9]*)?\n?([\s\S]*?)```$/)
      setPendingCode(codeBlockMatch ? codeBlockMatch[1].trim() : fullText.trim())
    } catch (err: any) {
      toaster.create({ title: "AI Error", description: err.message, type: "error" })
    } finally {
      setAiLoading(false)
    }
  }

  const handleImageUpload = async (file: File) => {
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setImageContextLoading(true)
    try {
      const base64 = await fileToDataUrl(file)
      const response = await fetch("/api/dev/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": userEmail || "",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `You are a vision assistant helping extract NVIDIA model IDs from screenshots. Read the image carefully and return ONLY model IDs exactly as written, case-sensitive, matching NVIDIA model names. Do not invent or normalize names. Then return a short JSON object with keys: modelIds (array of strings), notes (string).`,
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Extract all NVIDIA model IDs visible in this image." },
                { type: "image_url", image_url: { url: base64 } },
              ],
            },
          ],
          model: VISION_MODEL,
        }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const text = await response.text()
      const extracted = extractModelIds(text)
      if (!extracted.length) {
        toaster.create({ title: "No model IDs found", type: "info" })
        return
      }
      await updateModelRegistry(extracted)
      toaster.create({
        title: "Image context updated",
        description: `Detected and updated: ${extracted.join(", ")}`,
        type: "success",
      })
    } catch (err: any) {
      toaster.create({ title: "Image Context Error", description: err.message, type: "error" })
    } finally {
      setImageContextLoading(false)
    }
  }

  const updateModelRegistry = async (modelIds: string[]) => {
    const res = await fetch(`/api/dev/file?path=${encodeURIComponent(MODEL_CONFIG_PATH)}`, {
      headers: { "x-user-email": userEmail || "" },
    })
    const data = await res.json()
    if (!data.content) throw new Error("Could not load model registry")

    const current = data.content as string
    const additions = modelIds
      .filter((id) => !current.includes(`id: "${id}"`))
      .map((id) => {
        const modelName = id.split("/").pop() || id
        return `  {
    id: "${id}",
    name: "${modelName}",
    provider: "NVIDIA",
    type: "general",
    size: "-",
    description: "Auto-discovered from image context",
    badges: ["new"],
  },
`
      })

    if (!additions.length) return

    const marker = "const ALL_MODELS: ModelConfig[] = [\n"
    const idx = current.indexOf(marker)
    if (idx === -1) throw new Error("Model registry marker not found")
    const insertAt = idx + marker.length
    const updated = current.slice(0, insertAt) + additions.join("") + current.slice(insertAt)

    const saveRes = await fetch("/api/dev/apply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-email": userEmail || "",
      },
      body: JSON.stringify({ path: MODEL_CONFIG_PATH, content: updated }),
    })
    const saveData = await saveRes.json()
    if (!saveData.success) throw new Error(saveData.error || "Failed to update registry")
  }

  const applyChanges = async () => {
    if (!pendingCode || !activeFile) return
    setFileContent(pendingCode)
    setIsDirty(true)
    setPendingCode(null)
    toaster.create({ title: "Changes applied to editor", type: "info" })
  }

  const saveFile = async () => {
    if (!activeFile || !isDirty) return
    try {
      const res = await fetch("/api/dev/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-email": userEmail || "",
        },
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
      if (remaining.length > 0) openFile(remaining[remaining.length - 1])
      else {
        setActiveFile(null)
        setFileContent("")
        setOriginalContent("")
      }
    }
  }

  const fileTree: Record<string, string[]> = {}
  files.forEach((f) => {
    const parts = f.split("/")
    const folder = parts.length > 1 ? parts[0] : "(root)"
    if (!fileTree[folder]) fileTree[folder] = []
    fileTree[folder].push(f)
  })

  const panelBtn = (id: PanelId, label: string, icon: any, count?: number | string) => (
    <Button key={id} size="sm" flex="1" variant={activePanel === id ? "solid" : "ghost"} colorScheme={activePanel === id ? "brand" : undefined} bg={activePanel === id ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "transparent"} color={activePanel === id ? "white" : "gray.500"} borderRadius="0" borderTop={activePanel === id ? "2px solid" : "none"} borderColor="brand.400" py="3" onClick={() => setActivePanel(id)}>
      <Icon as={icon} mr="1.5" boxSize="12px" />
      {label}
      {count !== undefined && <Badge ml="1.5" colorPalette="gray" variant="subtle">{count}</Badge>}
    </Button>
  )

  return (
    <Flex h="100%" bg="#0a0a0f" color="white" overflow="hidden" direction="column">
      <Box p="3" borderBottom="1px solid" borderColor="rgba(99,102,241,0.15)">
        <HStack justify="space-between" mb="3">
          <HStack gap="2">
            <Icon as={LuTerminal} color="brand.400" boxSize="18px" />
            <Text fontWeight="700">Dev Studio</Text>
          </HStack>
          <HStack gap="2">
            <Button leftIcon={<LuUpload />} size="sm" onClick={() => document.getElementById("dev-image-upload")?.click()}>
              Upload Image
            </Button>
            <Input id="dev-image-upload" type="file" accept="image/*" display="none" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
            {imageContextLoading && <Spinner size="sm" />}
          </HStack>
        </HStack>
        {imagePreview && (
          <HStack gap="3" mb="2">
            <Box as="img" src={imagePreview} alt="uploaded" maxH="80px" borderRadius="md" />
            <Text fontSize="xs" color="gray.400">Image Context enabled for {imageFile?.name}</Text>
          </HStack>
        )}
      </Box>
      <Box p="3" flex="1" overflow="auto">
        <Text fontSize="sm" color="gray.400" mb="2">{CODER_MODEL}</Text>
        <Textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Describe the code change or use Image Context..." mb="3" />
        <HStack gap="2" mb="4">
          <Button onClick={runAI} isLoading={aiLoading} leftIcon={<LuSend />}>Generate</Button>
          <Button onClick={applyChanges} isDisabled={!pendingCode} leftIcon={<LuCheck />}>Apply</Button>
          <Button onClick={saveFile} isDisabled={!isDirty} leftIcon={<LuSave />}>Update Site</Button>
        </HStack>
        {aiResponse && <Box whiteSpace="pre-wrap" fontSize="sm" color="gray.300" mb="4">{aiResponse}</Box>}
        <Editor height="520px" language={getLanguage(activeFile || "index.ts")} value={fileContent} onChange={(v) => { setFileContent(v || ""); setIsDirty(v !== originalContent) }} theme="vs-dark" />
      </Box>
    </Flex>
  )
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Failed to read image"))
    reader.readAsDataURL(file)
  })
}

function extractModelIds(text: string) {
  const ids = new Set<string>()
  const regex = /(?:meta|nvidia|mistralai|deepseek-ai|moonshotai|openai|google|stepfun-ai|minimaxai|bytedance|stockmark|abacusai|sarvamai|z-ai)\/[a-z0-9._-]+/gi
  for (const match of text.match(regex) || []) ids.add(match)
  return [...ids]
}
