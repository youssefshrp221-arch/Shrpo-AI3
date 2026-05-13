import { useState, useEffect } from "react"
import {
  Box,
  VStack,
  HStack,
  Text,
  Icon,
  IconButton,
  Button,
  Input,
  Textarea,
  Badge,
  Heading,
  SimpleGrid,
  Flex,
} from "@chakra-ui/react"
import {
  LuPlus,
  LuTrash2,
  LuSave,
  LuBookOpen,
  LuUsers,
  LuPencil,
  LuArrowLeft,
  LuSparkles,
  LuTarget,
  LuMic,
  LuEye,
  LuFileText,
  LuX,
  LuChevronDown,
  LuChevronUp,
  LuCopy,
  LuCheck,
  LuSettings,
} from "react-icons/lu"
import { useAppStore } from "@/store/appStore"
import { supabase, getSessionId, initializeSessionId } from "@/lib/supabase"
import { streamChatWithFallback } from "@/lib/modelOrchestrator"
import { toaster } from "@/components/ui/toaster"
import { Switch } from "@/components/ui/switch"
import ModelSelector from "@/components/ModelSelector/ModelSelector"
import type { WritingProject, Character } from "@/types"
import { v4 as uuidv4 } from "uuid"

interface WritingSettings {
  pov: string
  tone: string
  writingStyle: string
  additionalContext: string
  targetLength: number
  dialogueBalance: number
}

interface StoryEvent {
  id: string
  title: string
  description: string
  order: number
}

export default function WritingStudio() {
  const { selectedModel, settings, apiKey } = useAppStore()

  const [projects, setProjects] = useState<WritingProject[]>([])
  const [activeProject, setActiveProject] = useState<WritingProject | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [events, setEvents] = useState<StoryEvent[]>([])
  const [panel, setPanel] = useState<"projects" | "setup">("projects")
  const [aiLoading, setAiLoading] = useState(false)
  const [generatedContent, setGeneratedContent] = useState("")
  const [streamingText, setStreamingText] = useState("")
  const [copied, setCopied] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [writingSettings, setWritingSettings] = useState<WritingSettings>({
    pov: "",
    tone: "",
    writingStyle: "",
    additionalContext: "",
    targetLength: 1000,
    dialogueBalance: 50,
  })

  // Character form state
  const [showCharacterForm, setShowCharacterForm] = useState(false)
  const [newCharacter, setNewCharacter] = useState({
    name: "",
    description: "",
    traits: "",
    role: "",
  })

  // Event form state
  const [showEventForm, setShowEventForm] = useState(false)
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
  })

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    initializeSessionId()
    const userId = getSessionId()
    const { data } = await supabase
      .from("writing_projects")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
    if (data) setProjects(data as WritingProject[])
  }

  const openProject = async (project: WritingProject) => {
    setActiveProject(project)
    setPanel("setup")
    const { data: chars } = await supabase.from("characters").select("*").eq("project_id", project.id)
    if (chars) setCharacters(chars as Character[])
    setEvents([])
    setGeneratedContent("")
    setStreamingText("")
  }

  const createProject = async () => {
    const userId = getSessionId()
    const project: WritingProject = {
      id: uuidv4(),
      title: "مشروع جديد",
      genre: "عام",
      summary: "",
      word_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    await supabase.from("writing_projects").insert({ ...project, user_id: userId })
    setProjects((prev) => [project, ...prev])
    openProject(project)
  }

  const deleteProject = async (id: string) => {
    await supabase.from("writing_projects").delete().eq("id", id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
    if (activeProject?.id === id) {
      setActiveProject(null)
      setPanel("projects")
    }
  }

  const addCharacter = async () => {
    if (!activeProject || !newCharacter.name.trim()) return
    const character: Character = {
      id: uuidv4(),
      project_id: activeProject.id,
      name: newCharacter.name,
      description: newCharacter.description,
      traits: newCharacter.traits.split(",").map((t) => t.trim()).filter(Boolean),
      backstory: "",
      role: newCharacter.role,
      created_at: new Date().toISOString(),
    }
    await supabase.from("characters").insert(character)
    setCharacters((prev) => [...prev, character])
    setNewCharacter({ name: "", description: "", traits: "", role: "" })
    setShowCharacterForm(false)
    toaster.create({ title: "تم إضافة الشخصية", type: "success" })
  }

  const removeCharacter = async (id: string) => {
    await supabase.from("characters").delete().eq("id", id)
    setCharacters((prev) => prev.filter((c) => c.id !== id))
  }

  const addEvent = () => {
    if (!newEvent.title.trim()) return
    const event: StoryEvent = {
      id: uuidv4(),
      title: newEvent.title,
      description: newEvent.description,
      order: events.length,
    }
    setEvents((prev) => [...prev, event])
    setNewEvent({ title: "", description: "" })
    setShowEventForm(false)
  }

  const removeEvent = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }

  const generateChapter = async () => {
    if (!activeProject) return
    if (characters.length === 0 && events.length === 0 && !writingSettings.additionalContext) {
      toaster.create({ title: "أضف شخصيات أو أحداث أولاً", type: "warning" })
      return
    }

    setAiLoading(true)
    setStreamingText("")
    setGeneratedContent("")

    const prompt = buildGenerationPrompt()

    try {
      const result = await streamChatWithFallback(
        [{ role: "user", content: prompt }],
        selectedModel,
        {
          onChunk: (chunk) => setStreamingText((prev) => prev + chunk),
          signal: new AbortController().signal,
          temperature: settings.temperature,
          apiKey: apiKey!,
        }
      )

      setGeneratedContent(result.fullContent)
      
      if (result.fallbackCount > 0) {
        const model = result.modelUsed.split("/").pop() || result.modelUsed
        toaster.create({ 
          title: `تم استخدام ${model}`, 
          description: "النموذج الأساسي غير متاح", 
          type: "info" 
        })
      } else {
        toaster.create({ title: "تم توليد الفصل بنجاح!", type: "success" })
      }
    } catch (err: any) {
      toaster.create({ title: "حدث خطأ", description: err.message, type: "error" })
    } finally {
      setAiLoading(false)
    }
  }

  const buildGenerationPrompt = (): string => {
    const { pov, tone, writingStyle, additionalContext, targetLength, dialogueBalance } = writingSettings

    let prompt = `أنت كاتب روائي محترف. اكتب فصلاً روائياً بناءً على المعلومات التالية:\n\n`

    if (characters.length > 0) {
      prompt += `## الشخصيات:\n`
      characters.forEach((c) => {
        prompt += `- ${c.name}: ${c.description || "لا يوجد وصف"}`
        if (c.traits.length > 0) prompt += ` (سمات: ${c.traits.join("، ")})`
        if (c.role) prompt += ` - الدور: ${c.role}`
        prompt += `\n`
      })
      prompt += `\n`
    }

    if (events.length > 0) {
      prompt += `## الأحداث الرئيسية:\n`
      events.forEach((e, i) => {
        prompt += `${i + 1}. ${e.title}`
        if (e.description) prompt += `: ${e.description}`
        prompt += `\n`
      })
      prompt += `\n`
    }

    prompt += `## إعدادات الكتابة:\n`
    if (pov) prompt += `- وجهة النظر: ${pov}\n`
    if (tone) prompt += `- النبرة: ${tone}\n`
    if (writingStyle) prompt += `- أسلوب الكتابة: ${writingStyle}\n`
    prompt += `- الطول المستهدف: ${targetLength} كلمة تقريباً\n`
    prompt += `- توازن الحوار: ${dialogueBalance}% حوار\n`

    if (additionalContext) {
      prompt += `\n## سياق إضافي:\n${additionalContext}\n`
    }

    prompt += `\n## التعليمات:\n`
    prompt += `- اكتب فصلاً روائياً متكاملاً بأسلوب أدبي رفيع\n`
    prompt += `- استخدم وصفاً حسياً غنياً وأجواء مشوقة\n`
    prompt += `- اجعل الحوار طبيعياً وممتعاً\n`
    prompt += `- حافظ على تماسك السرد وتدفق الأحداث\n`
    prompt += `- اكتب باللغة العربية الفصحى مع لمسات أدبية`

    return prompt
  }

  const copyToClipboard = () => {
    const text = generatedContent || streamingText
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toaster.create({ title: "تم النسخ", type: "success" })
  }

  if (panel === "projects") {
    return <ProjectsPanel projects={projects} onCreate={createProject} onOpen={openProject} onDelete={deleteProject} />
  }

  return (
    <Box h="100%" display="flex" flexDirection="column" bg="#0a0a0f">
      {/* Model Selector */}
      <Box hideBelow="md">
        <ModelSelector mobile={false} />
      </Box>
      <Box hideFrom="md" flexShrink={0}>
        <ModelSelector mobile={true} />
      </Box>

      {/* Header */}
      <Box
        px={{ base: "3", md: "4" }}
        py="2.5"
        borderBottom="1px solid"
        borderColor="rgba(99,102,241,0.12)"
        bg="rgba(10,10,18,0.95)"
        backdropFilter="blur(20px)"
        flexShrink={0}
      >
        <HStack justify="space-between">
          <HStack gap="2">
            <IconButton
              aria-label="رجوع"
              variant="ghost"
              size="sm"
              onClick={() => setPanel("projects")}
              color="gray.500"
              _hover={{ color: "white", bg: "rgba(99,102,241,0.1)" }}
              borderRadius="lg"
            >
              <Icon as={LuArrowLeft} />
            </IconButton>
            <VStack align="start" gap="0">
              <Text fontWeight="700" fontSize="sm" color="white">{activeProject?.title}</Text>
              <Text fontSize="2xs" color="gray.600">Writing Studio</Text>
            </VStack>
          </HStack>
          <Badge colorPalette="purple" variant="subtle" fontSize="2xs">
            {characters.length} شخصية · {events.length} حدث
          </Badge>
        </HStack>
      </Box>

      {/* Main Content - Scrollable */}
      <Box flex="1" overflow="auto" p={{ base: "3", md: "4" }}>
        <VStack gap="4" align="stretch" maxW="800px" mx="auto">
          
          {/* Characters Section */}
          <Box
            p="4"
            rounded="xl"
            bg="rgba(99,102,241,0.04)"
            border="1px solid"
            borderColor="rgba(99,102,241,0.12)"
          >
            <HStack justify="space-between" mb="3">
              <HStack gap="2">
                <Icon as={LuUsers} color="purple.400" />
                <Text fontWeight="600" color="white" fontSize="sm">الشخصيات</Text>
              </HStack>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setShowCharacterForm(!showCharacterForm)}
                color="purple.400"
                _hover={{ bg: "rgba(99,102,241,0.1)" }}
              >
                <Icon as={showCharacterForm ? LuX : LuPlus} mr="1" />
                {showCharacterForm ? "إلغاء" : "إضافة"}
              </Button>
            </HStack>

            {showCharacterForm && (
              <Box mb="3" p="3" rounded="lg" bg="rgba(0,0,0,0.2)" border="1px solid" borderColor="rgba(99,102,241,0.1)">
                <VStack gap="2">
                  <Input
                    placeholder="اسم الشخصية"
                    value={newCharacter.name}
                    onChange={(e) => setNewCharacter({ ...newCharacter, name: e.target.value })}
                    size="sm"
                    bg="rgba(10,10,18,0.6)"
                    borderColor="rgba(99,102,241,0.15)"
                    color="gray.200"
                    _placeholder={{ color: "gray.600" }}
                  />
                  <Input
                    placeholder="وصف مختصر"
                    value={newCharacter.description}
                    onChange={(e) => setNewCharacter({ ...newCharacter, description: e.target.value })}
                    size="sm"
                    bg="rgba(10,10,18,0.6)"
                    borderColor="rgba(99,102,241,0.15)"
                    color="gray.200"
                    _placeholder={{ color: "gray.600" }}
                  />
                  <HStack w="full" gap="2">
                    <Input
                      placeholder="السمات (مفصولة بفاصلة)"
                      value={newCharacter.traits}
                      onChange={(e) => setNewCharacter({ ...newCharacter, traits: e.target.value })}
                      size="sm"
                      flex="1"
                      bg="rgba(10,10,18,0.6)"
                      borderColor="rgba(99,102,241,0.15)"
                      color="gray.200"
                      _placeholder={{ color: "gray.600" }}
                    />
                    <Input
                      placeholder="الدور"
                      value={newCharacter.role}
                      onChange={(e) => setNewCharacter({ ...newCharacter, role: e.target.value })}
                      size="sm"
                      w="120px"
                      bg="rgba(10,10,18,0.6)"
                      borderColor="rgba(99,102,241,0.15)"
                      color="gray.200"
                      _placeholder={{ color: "gray.600" }}
                    />
                  </HStack>
                  <Button size="sm" colorPalette="purple" w="full" onClick={addCharacter} borderRadius="lg">
                    <Icon as={LuPlus} mr="1" />
                    إضافة الشخصية
                  </Button>
                </VStack>
              </Box>
            )}

            {characters.length === 0 ? (
              <Text fontSize="xs" color="gray.600" textAlign="center" py="4">
                لا توجد شخصيات بعد. أضف شخصياتك لبدء الكتابة.
              </Text>
            ) : (
              <VStack gap="2" align="stretch">
                {characters.map((c) => (
                  <HStack
                    key={c.id}
                    p="2.5"
                    rounded="lg"
                    bg="rgba(0,0,0,0.2)"
                    justify="space-between"
                  >
                    <VStack align="start" gap="0.5" flex="1">
                      <HStack gap="2">
                        <Text fontSize="sm" fontWeight="600" color="white">{c.name}</Text>
                        {c.role && <Badge size="sm" colorPalette="blue" variant="subtle">{c.role}</Badge>}
                      </HStack>
                      {c.description && <Text fontSize="2xs" color="gray.500" noOfLines={1}>{c.description}</Text>}
                    </VStack>
                    <IconButton
                      aria-label="حذف"
                      variant="ghost"
                      size="xs"
                      onClick={() => removeCharacter(c.id)}
                      color="gray.600"
                      _hover={{ color: "red.400", bg: "rgba(239,68,68,0.1)" }}
                    >
                      <Icon as={LuTrash2} boxSize="3.5" />
                    </IconButton>
                  </HStack>
                ))}
              </VStack>
            )}
          </Box>

          {/* Events Section */}
          <Box
            p="4"
            rounded="xl"
            bg="rgba(59,130,246,0.04)"
            border="1px solid"
            borderColor="rgba(59,130,246,0.12)"
          >
            <HStack justify="space-between" mb="3">
              <HStack gap="2">
                <Icon as={LuTarget} color="blue.400" />
                <Text fontWeight="600" color="white" fontSize="sm">الأحداث</Text>
              </HStack>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setShowEventForm(!showEventForm)}
                color="blue.400"
                _hover={{ bg: "rgba(59,130,246,0.1)" }}
              >
                <Icon as={showEventForm ? LuX : LuPlus} mr="1" />
                {showEventForm ? "إلغاء" : "إضافة"}
              </Button>
            </HStack>

            {showEventForm && (
              <Box mb="3" p="3" rounded="lg" bg="rgba(0,0,0,0.2)" border="1px solid" borderColor="rgba(59,130,246,0.1)">
                <VStack gap="2">
                  <Input
                    placeholder="عنوان الحدث"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    size="sm"
                    bg="rgba(10,10,18,0.6)"
                    borderColor="rgba(59,130,246,0.15)"
                    color="gray.200"
                    _placeholder={{ color: "gray.600" }}
                  />
                  <Textarea
                    placeholder="وصف الحدث (اختياري)"
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    size="sm"
                    minH="60px"
                    bg="rgba(10,10,18,0.6)"
                    borderColor="rgba(59,130,246,0.15)"
                    color="gray.200"
                    _placeholder={{ color: "gray.600" }}
                  />
                  <Button size="sm" colorPalette="blue" w="full" onClick={addEvent} borderRadius="lg">
                    <Icon as={LuPlus} mr="1" />
                    إضافة الحدث
                  </Button>
                </VStack>
              </Box>
            )}

            {events.length === 0 ? (
              <Text fontSize="xs" color="gray.600" textAlign="center" py="4">
                لا توجد أحداث بعد. أضف الأحداث الرئيسية لقصتك.
              </Text>
            ) : (
              <VStack gap="2" align="stretch">
                {events.map((e, i) => (
                  <HStack
                    key={e.id}
                    p="2.5"
                    rounded="lg"
                    bg="rgba(0,0,0,0.2)"
                    justify="space-between"
                  >
                    <HStack gap="2" flex="1">
                      <Badge size="sm" colorPalette="blue" variant="solid" borderRadius="full" minW="20px" textAlign="center">
                        {i + 1}
                      </Badge>
                      <VStack align="start" gap="0" flex="1">
                        <Text fontSize="sm" fontWeight="500" color="white">{e.title}</Text>
                        {e.description && <Text fontSize="2xs" color="gray.500" noOfLines={1}>{e.description}</Text>}
                      </VStack>
                    </HStack>
                    <IconButton
                      aria-label="حذف"
                      variant="ghost"
                      size="xs"
                      onClick={() => removeEvent(e.id)}
                      color="gray.600"
                      _hover={{ color: "red.400", bg: "rgba(239,68,68,0.1)" }}
                    >
                      <Icon as={LuTrash2} boxSize="3.5" />
                    </IconButton>
                  </HStack>
                ))}
              </VStack>
            )}
          </Box>

          {/* Writing Settings */}
          <Box
            p="4"
            rounded="xl"
            bg="rgba(16,185,129,0.04)"
            border="1px solid"
            borderColor="rgba(16,185,129,0.12)"
          >
            <HStack justify="space-between" mb="3">
              <HStack gap="2">
                <Icon as={LuSettings} color="emerald.400" />
                <Text fontWeight="600" color="white" fontSize="sm">إعدادات الكتابة</Text>
              </HStack>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setShowAdvanced(!showAdvanced)}
                color="emerald.400"
                _hover={{ bg: "rgba(16,185,129,0.1)" }}
              >
                <Icon as={showAdvanced ? LuChevronUp : LuChevronDown} mr="1" />
                {showAdvanced ? "إخفاء" : "المزيد"}
              </Button>
            </HStack>

            <VStack gap="3" align="stretch">
              <HStack gap="3">
                <Box flex="1">
                  <Text fontSize="2xs" color="gray.500" mb="1">وجهة النظر (POV)</Text>
                  <Input
                    placeholder="مثال: الراوي العليم، ضمير المتكلم"
                    value={writingSettings.pov}
                    onChange={(e) => setWritingSettings({ ...writingSettings, pov: e.target.value })}
                    size="sm"
                    bg="rgba(10,10,18,0.6)"
                    borderColor="rgba(16,185,129,0.15)"
                    color="gray.200"
                    _placeholder={{ color: "gray.600" }}
                  />
                </Box>
                <Box flex="1">
                  <Text fontSize="2xs" color="gray.500" mb="1">النبرة (Tone)</Text>
                  <Input
                    placeholder="مثال: درامي، رومانسي، مشوق"
                    value={writingSettings.tone}
                    onChange={(e) => setWritingSettings({ ...writingSettings, tone: e.target.value })}
                    size="sm"
                    bg="rgba(10,10,18,0.6)"
                    borderColor="rgba(16,185,129,0.15)"
                    color="gray.200"
                    _placeholder={{ color: "gray.600" }}
                  />
                </Box>
              </HStack>

              <Box>
                <Text fontSize="2xs" color="gray.500" mb="1">أسلوب الكتابة</Text>
                <Textarea
                  placeholder="مثال: جمل قصيرة؛ تركيز على الحوار؛ أظهر لا تخبر"
                  value={writingSettings.writingStyle}
                  onChange={(e) => setWritingSettings({ ...writingSettings, writingStyle: e.target.value })}
                  size="sm"
                  minH="60px"
                  bg="rgba(10,10,18,0.6)"
                  borderColor="rgba(16,185,129,0.15)"
                  color="gray.200"
                  _placeholder={{ color: "gray.600" }}
                />
              </Box>

              {showAdvanced && (
                <>
                  <Box>
                    <Text fontSize="2xs" color="gray.500" mb="1">سياق إضافي</Text>
                    <Textarea
                      placeholder="أي معلومات إضافية تريد أن يعرفها الذكاء الاصطناعي..."
                      value={writingSettings.additionalContext}
                      onChange={(e) => setWritingSettings({ ...writingSettings, additionalContext: e.target.value })}
                      size="sm"
                      minH="80px"
                      bg="rgba(10,10,18,0.6)"
                      borderColor="rgba(16,185,129,0.15)"
                      color="gray.200"
                      _placeholder={{ color: "gray.600" }}
                    />
                  </Box>

                  <HStack gap="4">
                    <Box flex="1">
                      <HStack justify="space-between" mb="1">
                        <Text fontSize="2xs" color="gray.500">الطول المستهدف</Text>
                        <Text fontSize="2xs" color="emerald.400" fontWeight="600">{writingSettings.targetLength}</Text>
                      </HStack>
                      <input
                        type="range"
                        min="500"
                        max="5000"
                        step="100"
                        value={writingSettings.targetLength}
                        onChange={(e) => setWritingSettings({ ...writingSettings, targetLength: parseInt(e.target.value) })}
                        style={{
                          width: "100%",
                          accentColor: "#10b981",
                          background: "rgba(16,185,129,0.2)",
                          borderRadius: "9999px",
                          height: "6px",
                        }}
                      />
                    </Box>
                    <Box flex="1">
                      <HStack justify="space-between" mb="1">
                        <Text fontSize="2xs" color="gray.500">نسبة الحوار</Text>
                        <Text fontSize="2xs" color="emerald.400" fontWeight="600">{writingSettings.dialogueBalance}%</Text>
                      </HStack>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="10"
                        value={writingSettings.dialogueBalance}
                        onChange={(e) => setWritingSettings({ ...writingSettings, dialogueBalance: parseInt(e.target.value) })}
                        style={{
                          width: "100%",
                          accentColor: "#10b981",
                          background: "rgba(16,185,129,0.2)",
                          borderRadius: "9999px",
                          height: "6px",
                        }}
                      />
                    </Box>
                  </HStack>
                </>
              )}
            </VStack>
          </Box>

          {/* Generate Button */}
          <Button
            size="lg"
            w="full"
            bg="linear-gradient(135deg, #6366f1, #8b5cf6)"
            color="white"
            borderRadius="xl"
            onClick={generateChapter}
            loading={aiLoading}
            loadingText="جارٍ التوليد..."
            _hover={{ shadow: "0 0 30px rgba(99,102,241,0.4)", transform: "translateY(-1px)" }}
            _active={{ transform: "scale(0.98)" }}
          >
            <Icon as={LuSparkles} mr="2" />
            توليد الفصل
          </Button>

          {/* Generated Content */}
          {(streamingText || generatedContent) && (
            <Box
              p="4"
              rounded="xl"
              bg="rgba(10,10,18,0.6)"
              border="1px solid"
              borderColor="rgba(99,102,241,0.15)"
            >
              <HStack justify="space-between" mb="3">
                <HStack gap="2">
                  <Icon as={LuFileText} color="purple.400" />
                  <Text fontWeight="600" color="white" fontSize="sm">المحتوى المُولَّد</Text>
                </HStack>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={copyToClipboard}
                  color="gray.400"
                  _hover={{ color: "white", bg: "rgba(99,102,241,0.1)" }}
                >
                  <Icon as={copied ? LuCheck : LuCopy} mr="1" />
                  {copied ? "تم النسخ" : "نسخ"}
                </Button>
              </HStack>
              <Box
                maxH="400px"
                overflow="auto"
                p="3"
                rounded="lg"
                bg="rgba(0,0,0,0.2)"
              >
                <Text
                  fontSize="sm"
                  color="gray.200"
                  lineHeight="2"
                  whiteSpace="pre-wrap"
                  dir="rtl"
                >
                  {generatedContent || streamingText}
                  {aiLoading && !generatedContent && (
                    <Box
                      as="span"
                      display="inline-block"
                      w="2px"
                      h="16px"
                      bg="purple.400"
                      ml="1"
                      verticalAlign="middle"
                      css={{ animation: "blink 1s step-end infinite" }}
                    />
                  )}
                </Text>
              </Box>
            </Box>
          )}
        </VStack>
      </Box>
    </Box>
  )
}

function ProjectsPanel({ projects, onCreate, onOpen, onDelete }: any) {
  return (
    <Box h="100%" bg="#0a0a0f" overflow="auto">
      <Box maxW="900px" mx="auto" px={{ base: "4", md: "6" }} py={{ base: "5", md: "8" }}>
        <HStack justify="space-between" mb={{ base: "5", md: "8" }}>
          <VStack align="start" gap="1">
            <Heading fontSize={{ base: "xl", md: "2xl" }} fontWeight="800" color="white">
              Writing Studio
            </Heading>
            <Text fontSize={{ base: "2xs", md: "sm" }} color="gray.500">
              أنشئ شخصياتك وأحداثك واكتب قصتك
            </Text>
          </VStack>
          <Button
            onClick={onCreate}
            size="sm"
            bg="linear-gradient(135deg, #6366f1, #8b5cf6)"
            color="white"
            borderRadius="xl"
            _hover={{ shadow: "0 0 20px rgba(99,102,241,0.4)" }}
          >
            <Icon as={LuPlus} mr="1.5" boxSize="14px" />
            <Box as="span" hideBelow="sm">مشروع جديد</Box>
            <Box as="span" hideFrom="sm">جديد</Box>
          </Button>
        </HStack>

        {projects.length === 0 ? (
          <Box
            textAlign="center"
            py={{ base: "12", md: "20" }}
            bg="rgba(15,15,26,0.6)"
            borderRadius="2xl"
            border="1px dashed"
            borderColor="rgba(99,102,241,0.2)"
          >
            <Icon as={LuPencil} boxSize={{ base: "36px", md: "48px" }} color="gray.700" mb="4" />
            <Text color="gray.500" fontWeight="500">لا توجد مشاريع بعد</Text>
            <Text color="gray.600" fontSize="sm" mb="6">أنشئ مشروعك الأول لبدء الكتابة</Text>
            <Button onClick={onCreate} size="sm" colorPalette="brand" variant="outline" borderRadius="xl">
              <Icon as={LuPlus} mr="1.5" />
              إنشاء مشروع
            </Button>
          </Box>
        ) : (
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={{ base: "3", md: "4" }}>
            {projects.map((p: WritingProject) => (
              <Box
                key={p.id}
                bg="rgba(15,15,26,0.8)"
                border="1px solid"
                borderColor="rgba(99,102,241,0.15)"
                borderRadius="2xl"
                p={{ base: "4", md: "5" }}
                cursor="pointer"
                _hover={{ borderColor: "rgba(99,102,241,0.35)", transform: "translateY(-2px)", shadow: "0 10px 30px rgba(0,0,0,0.3)" }}
                _active={{ transform: "scale(0.98)" }}
                onClick={() => onOpen(p)}
                transition="all 0.2s"
                position="relative"
              >
                <Box
                  position="absolute"
                  top={0}
                  left={0}
                  right={0}
                  h="3px"
                  bg="linear-gradient(90deg, #6366f1, #8b5cf6)"
                  borderTopRadius="2xl"
                />
                <VStack align="start" gap="2">
                  <HStack justify="space-between" w="full">
                    <Text fontWeight="700" color="white" fontSize="sm" noOfLines={1}>{p.title}</Text>
                    <IconButton
                      aria-label="حذف"
                      variant="ghost"
                      size="xs"
                      onClick={(e) => { e.stopPropagation(); onDelete(p.id) }}
                      color="gray.600"
                      _hover={{ color: "red.400", bg: "rgba(239,68,68,0.1)" }}
                    >
                      <Icon as={LuTrash2} boxSize="3.5" />
                    </IconButton>
                  </HStack>
                  <Badge size="sm" colorPalette="purple" variant="subtle">{p.genre}</Badge>
                  <Text fontSize="2xs" color="gray.600">
                    {new Date(p.updated_at).toLocaleDateString("ar-EG")}
                  </Text>
                </VStack>
              </Box>
            ))}
          </SimpleGrid>
        )}
      </Box>
    </Box>
  )
}
