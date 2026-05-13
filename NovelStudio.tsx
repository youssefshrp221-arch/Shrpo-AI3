import { useState } from "react"
import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Button,
  Input,
  Textarea,
  Badge,
  Icon,
  IconButton,
  Spinner,
  SimpleGrid,
} from "@chakra-ui/react"
import {
  LuBookOpen,
  LuWandSparkles,
  LuPencilLine,
  LuCheckCheck,
  LuDownload,
  LuRotateCcw,
  LuCopy,
  LuCheck,
  LuFocus,
  LuSparkles,
  LuPlus,
  LuX,
  LuTrash2,
  LuChevronRight,
  LuExpand,
  LuPlay,
} from "react-icons/lu"
import { useAppStore } from "@/store/appStore"
import { streamChatWithFallback } from "@/lib/modelOrchestrator"

type NovelStage = "setup" | "outline" | "beats" | "writing" | "complete"

interface Act {
  id: string
  title: string
  chapters: Chapter[]
}

interface Chapter {
  id: string
  title: string
  scenes: Scene[]
}

interface Scene {
  id: string
  title: string
  synopsis: string
  content?: string
}

interface NovelSettings {
  plotSummary: string
  sceneBeats: string
  length: number
  dialogueBalance: number
  pov: string
  tone: string
  writingStyle: string
  additionalContext: string
}

// Use verified working models
const STAGE_MODELS = {
  outline: "meta/llama-3.1-8b-instruct",      // Fast for planning
  beats: "meta/llama-3.1-70b-instruct",       // Better for detailed beats
  writing: "nvidia/llama-3.1-nemotron-70b-instruct", // Best for creative writing
}

export default function NovelStudio() {
  const { settings, apiKey, selectedModel } = useAppStore()
  const [currentStage, setCurrentStage] = useState<NovelStage>("setup")
  const [isLoading, setIsLoading] = useState(false)
  const [streamingText, setStreamingText] = useState("")
  const [copied, setCopied] = useState(false)
  const [novelTitle, setNovelTitle] = useState("")
  const [activeTab, setActiveTab] = useState<"template" | "custom">("template")
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  // Novel structure
  const [acts, setActs] = useState<Act[]>([
    {
      id: "1",
      title: "Untitled",
      chapters: [
        {
          id: "1-1",
          title: "Chapter 1",
          scenes: [{ id: "1-1-1", title: "Scene 1", synopsis: "" }],
        },
      ],
    },
  ])

  // Writing settings
  const [novelSettings, setNovelSettings] = useState<NovelSettings>({
    plotSummary: "",
    sceneBeats: "",
    length: 1000,
    dialogueBalance: 60,
    pov: "",
    tone: "",
    writingStyle: "",
    additionalContext: "",
  })

  // Generated content
  const [generatedOutline, setGeneratedOutline] = useState("")
  const [generatedBeats, setGeneratedBeats] = useState("")
  const [generatedChapter, setGeneratedChapter] = useState("")

  const getProgressValue = () => {
    switch (currentStage) {
      case "setup": return 0
      case "outline": return 25
      case "beats": return 50
      case "writing": return 75
      case "complete": return 100
      default: return 0
    }
  }

  // Act/Chapter/Scene management
  const addScene = (actId: string, chapterId: string) => {
    setActs((prev) =>
      prev.map((act) =>
        act.id === actId
          ? {
              ...act,
              chapters: act.chapters.map((ch) =>
                ch.id === chapterId
                  ? {
                      ...ch,
                      scenes: [
                        ...ch.scenes,
                        {
                          id: `${chapterId}-${ch.scenes.length + 1}`,
                          title: `Scene ${ch.scenes.length + 1}`,
                          synopsis: "",
                        },
                      ],
                    }
                  : ch
              ),
            }
          : act
      )
    )
  }

  const addChapter = (actId: string) => {
    setActs((prev) =>
      prev.map((act) =>
        act.id === actId
          ? {
              ...act,
              chapters: [
                ...act.chapters,
                {
                  id: `${actId}-${act.chapters.length + 1}`,
                  title: `Chapter ${act.chapters.length + 1}`,
                  scenes: [{ id: `${actId}-${act.chapters.length + 1}-1`, title: "Scene 1", synopsis: "" }],
                },
              ],
            }
          : act
      )
    )
  }

  const addAct = () => {
    const newActId = `${acts.length + 1}`
    setActs((prev) => [
      ...prev,
      {
        id: newActId,
        title: "Untitled",
        chapters: [
          {
            id: `${newActId}-1`,
            title: "Chapter 1",
            scenes: [{ id: `${newActId}-1-1`, title: "Scene 1", synopsis: "" }],
          },
        ],
      },
    ])
  }

  const updateSceneSynopsis = (actId: string, chapterId: string, sceneId: string, synopsis: string) => {
    setActs((prev) =>
      prev.map((act) =>
        act.id === actId
          ? {
              ...act,
              chapters: act.chapters.map((ch) =>
                ch.id === chapterId
                  ? {
                      ...ch,
                      scenes: ch.scenes.map((sc) => (sc.id === sceneId ? { ...sc, synopsis } : sc)),
                    }
                  : ch
              ),
            }
          : act
      )
    )
  }

  // Step 1: Generate Outline
  const generateOutline = async () => {
    if (!storySetup.summary.trim()) {
      return
    }

    setIsLoading(true)
    setCurrentStage("outline")
    setStreamingText("")

    const prompt = `أنت خبير تخطيط روايات. بناءً على الملخص التالي، أنشئ مخطط تفصيلي للرواية:

ملخص القصة:
${novelSettings.plotSummary}

${novelSettings.additionalContext ? `سياق إضافي:\n${novelSettings.additionalContext}\n` : ""}

أنشئ مخططاً يتضمن:
1. الفصول الرئيسية (3-5 فصول)
2. لكل فصل: العنوان والملخص والأحداث الرئيسية
3. قوس الشخصيات الرئيسية
4. نقاط التحول الدرامية

اكتب بشكل منظم وواضح.`

    try {
      const result = await streamChatWithFallback(
        [{ role: "user", content: prompt }],
        STAGE_MODELS.outline,
        {
          onChunk: (chunk) => setStreamingText((prev) => prev + chunk),
          signal: new AbortController().signal,
          temperature: 0.7,
          apiKey: apiKey!,
        }
      )

      setGeneratedOutline(result.fullContent)
    } catch (err: any) {
      console.error("[v0] Error generating outline:", err)
    } finally {
      setIsLoading(false)
    }
  }

  // Step 2: Generate Scene Beats
  const generateBeats = async () => {
    if (!generatedOutline && !novelSettings.sceneBeats) {
      return
    }

    setIsLoading(true)
    setCurrentStage("beats")
    setStreamingText("")

    const prompt = `أنت كاتب سيناريو محترف. بناءً على المخطط التالي، أنشئ Scene Beats تفصيلية:

المخطط:
${generatedOutline || novelSettings.sceneBeats}

${novelSettings.tone ? `النبرة المطلوبة: ${novelSettings.tone}` : ""}
${novelSettings.pov ? `وجهة النظر: ${novelSettings.pov}` : ""}

لكل مشهد، اكتب:
- رقم المشهد وعنوانه
- الموقع والزمان
- الشخصيات المشاركة
- الهدف الدرامي
- الأحداث الرئيسية (3-5 نقاط)
- الحوار المهم (إن وجد)
- الانتقال للمشهد التالي

اجعل الـ Beats مفصلة وقابلة للتحويل إلى نص روائي.`

    try {
      const result = await streamChatWithFallback(
        [{ role: "user", content: prompt }],
        STAGE_MODELS.beats,
        {
          onChunk: (chunk) => setStreamingText((prev) => prev + chunk),
          signal: new AbortController().signal,
          temperature: 0.6,
          apiKey: apiKey!,
        }
      )

      setGeneratedBeats(result.fullContent)
    } catch (err: any) {
      console.error("[v0] Error generating beats:", err)
    } finally {
      setIsLoading(false)
    }
  }

  // Step 3: Generate Chapter
  const generateChapterContent = async () => {
    if (!generatedBeats && !novelSettings.sceneBeats) {
      return
    }

    setIsLoading(true)
    setCurrentStage("writing")
    setStreamingText("")

    const prompt = `أنت كاتب روائي محترف. اكتب فصلاً روائياً كاملاً بناءً على الـ Scene Beats التالية:

Scene Beats:
${generatedBeats || novelSettings.sceneBeats}

إعدادات الكتابة:
- الطول المستهدف: ${novelSettings.length} كلمة
- نسبة الحوار: ${novelSettings.dialogueBalance}%
${novelSettings.pov ? `- وجهة النظر: ${novelSettings.pov}` : ""}
${novelSettings.tone ? `- النبرة: ${novelSettings.tone}` : ""}
${novelSettings.writingStyle ? `- أسلوب الكتابة: ${novelSettings.writingStyle}` : ""}

التعليمات:
- اكتب بأسلوب أدبي رفيع المستوى
- استخدم وصفاً حسياً غنياً (البصر، السمع، اللمس، الرائحة)
- اجعل الحوار طبيعياً ومعبراً عن الشخصيات
- حافظ على إيقاع السرد وتشويق القارئ
- أضف تفاصيل دقيقة تثري المشاهد
- اكتب باللغة العربية الفصحى مع لمسات أدبية

ابدأ الكتابة الآن:`

    try {
      const result = await streamChatWithFallback(
        [{ role: "user", content: prompt }],
        selectedModel || STAGE_MODELS.writing,
        {
          onChunk: (chunk) => setStreamingText((prev) => prev + chunk),
          signal: new AbortController().signal,
          temperature: settings.temperature,
          apiKey: apiKey!,
        }
      )

      setGeneratedChapter(result.fullContent)
      setCurrentStage("complete")
    } catch (err: any) {
      console.error("[v0] Error generating chapter:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = () => {
    const text = generatedChapter || streamingText
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExport = () => {
    const text = generatedChapter || streamingText
    if (!text) {
      return
    }
    const fileName = novelTitle || "chapter"
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${fileName}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleReset = () => {
    setCurrentStage("setup")
    setStreamingText("")
    setGeneratedOutline("")
    setGeneratedBeats("")
    setGeneratedChapter("")
    setNovelTitle("")
    setNovelSettings({
      plotSummary: "",
      sceneBeats: "",
      length: 1000,
      dialogueBalance: 60,
      pov: "",
      tone: "",
      writingStyle: "",
      additionalContext: "",
    })
  }

  const getCurrentContent = () => {
    if (currentStage === "outline") return streamingText || generatedOutline
    if (currentStage === "beats") return streamingText || generatedBeats
    if (currentStage === "writing" || currentStage === "complete") return streamingText || generatedChapter
    return ""
  }

  return (
    <Box h="100%" display="flex" flexDirection="column" bg="#0a0a0f" w="full">
      {/* Model Selector - Hidden */}
      <Box hideBelow="md">
        {/* Hidden for now */}
      </Box>
      <Box hideFrom="md" flexShrink={0}>
        {/* Hidden for now */}
      </Box>

      {/* Header */}
      <Box
        px={{ base: "3", md: "5" }}
        py="3"
        borderBottom="1px solid"
        borderColor="rgba(99,102,241,0.12)"
        bg="rgba(10,10,18,0.95)"
        backdropFilter="blur(20px)"
        flexShrink={0}
      >
        <VStack align="start" gap="3">
          <HStack justify="space-between" w="full">
            <HStack gap="2">
              <Icon as={LuBookOpen} boxSize="5" color="blue.400" />
              <Heading size="md" color="white">Novel Studio</Heading>
              <Badge colorPalette="blue" variant="subtle" fontSize="2xs">3 خطوات</Badge>
            </HStack>
            {currentStage !== "setup" && (
              <Button
                size="xs"
                variant="ghost"
                onClick={handleReset}
                color="gray.500"
                _hover={{ color: "white", bg: "rgba(99,102,241,0.1)" }}
              >
                <Icon as={LuRotateCcw} mr="1" />
                إعادة
              </Button>
            )}
          </HStack>

          {/* Progress Bar - Placeholder */}
          <Box w="full" h="2" bg="gray.700" borderRadius="full" />

          {/* Stage Steps */}
          <HStack w="full" gap="1">
            {[
              { id: "outline", title: "المخطط", icon: LuFocus, color: "blue" },
              { id: "beats", title: "Scene Beats", icon: LuPencilLine, color: "purple" },
              { id: "writing", title: "الكتابة", icon: LuWandSparkles, color: "cyan" },
            ].map((step, i) => {
              const isActive = currentStage === step.id
              const isDone = ["outline", "beats", "writing", "complete"].indexOf(currentStage) > i
              return (
                <Box
                  key={step.id}
                  flex="1"
                  py="2"
                  px="2"
                  rounded="lg"
                  bg={isActive ? `${step.color}.500/10` : isDone ? "green.500/5" : "whiteAlpha.50"}
                  border="1px solid"
                  borderColor={isActive ? `${step.color}.500/30` : isDone ? "green.500/20" : "whiteAlpha.100"}
                  textAlign="center"
                  transition="all 0.2s"
                >
                  <HStack justify="center" gap="1.5">
                    <Icon
                      as={isDone && !isActive ? LuCheckCheck : step.icon}
                      boxSize="3.5"
                      color={isDone && !isActive ? "green.400" : isActive ? `${step.color}.400` : "gray.600"}
                    />
                    <Text
                      fontSize="2xs"
                      fontWeight="600"
                      color={isDone && !isActive ? "green.300" : isActive ? "white" : "gray.600"}
                      hideBelow="sm"
                    >
                      {step.title}
                    </Text>
                  </HStack>
                </Box>
              )
            })}
          </HStack>
        </VStack>
      </Box>

      {/* Main Content */}
      <Box flex="1" overflow="auto" p={{ base: "3", md: "5" }}>
        <Box maxW="900px" mx="auto">
          {currentStage === "setup" && (
            <VStack gap="4" align="stretch">
              {/* Tabs */}
              <HStack
                p="1"
                bg="rgba(99,102,241,0.05)"
                rounded="xl"
                border="1px solid"
                borderColor="rgba(99,102,241,0.1)"
                w="fit-content"
              >
                {[
                  { id: "template", label: "Template" },
                  { id: "custom", label: "Custom" },
                ].map((tab) => (
                  <Button
                    key={tab.id}
                    size="sm"
                    variant={activeTab === tab.id ? "solid" : "ghost"}
                    bg={activeTab === tab.id ? "rgba(99,102,241,0.15)" : "transparent"}
                    color={activeTab === tab.id ? "white" : "gray.500"}
                    _hover={{ bg: "rgba(99,102,241,0.1)" }}
                    onClick={() => setActiveTab(tab.id as "template" | "custom")}
                    borderRadius="lg"
                    px="4"
                  >
                    {tab.label}
                  </Button>
                ))}
              </HStack>

              {activeTab === "template" ? (
                <VStack gap="4" align="stretch">
                  {/* Plot Summary */}
                  <Box
                    p="4"
                    rounded="xl"
                    bg="rgba(99,102,241,0.04)"
                    border="1px solid"
                    borderColor="rgba(99,102,241,0.12)"
                  >
                    <HStack justify="space-between" mb="2">
                      <Text fontWeight="600" color="white" fontSize="sm">Plot Summary</Text>
                      <IconButton
                        aria-label="توسيع"
                        variant="ghost"
                        size="xs"
                        onClick={() => setExpandedSection(expandedSection === "plot" ? null : "plot")}
                        color="gray.500"
                        _hover={{ color: "white" }}
                      >
                        <Icon as={LuExpand} boxSize="3.5" />
                      </IconButton>
                    </HStack>
                    <Textarea
                      placeholder="اكتب ملخص قصتك هنا... ما هي الفكرة الرئيسية؟ من هم الشخصيات؟ ما هو الصراع؟"
                      value={novelSettings.plotSummary}
                      onChange={(e) => setNovelSettings({ ...novelSettings, plotSummary: e.target.value })}
                      minH={expandedSection === "plot" ? "200px" : "100px"}
                      fontSize="sm"
                      bg="rgba(10,10,18,0.6)"
                      borderColor="rgba(99,102,241,0.15)"
                      color="gray.200"
                      _placeholder={{ color: "gray.600" }}
                      _focus={{ borderColor: "blue.500" }}
                    />
                  </Box>

                  {/* Scene Beats */}
                  <Box
                    p="4"
                    rounded="xl"
                    bg="rgba(139,92,246,0.04)"
                    border="1px solid"
                    borderColor="rgba(139,92,246,0.12)"
                  >
                    <HStack justify="space-between" mb="2">
                      <HStack gap="2">
                        <Text fontWeight="600" color="white" fontSize="sm">Scene Beats</Text>
                        <Text fontSize="2xs" color="gray.600">{novelSettings.sceneBeats.length}/15000</Text>
                      </HStack>
                      <Button
                        size="xs"
                        colorPalette="purple"
                        variant="ghost"
                        onClick={generateBeats}
                        disabled={!novelSettings.plotSummary && !generatedOutline}
                      >
                        <Icon as={LuSparkles} mr="1" />
                        Generate Beats
                      </Button>
                    </HStack>
                    <Textarea
                      placeholder="1. INT. DALMAA'S APARTMENT - DAY&#10;Dalmaa sits on her couch, surrounded by journals and..."
                      value={novelSettings.sceneBeats}
                      onChange={(e) => setNovelSettings({ ...novelSettings, sceneBeats: e.target.value })}
                      minH={expandedSection === "beats" ? "200px" : "100px"}
                      fontSize="sm"
                      bg="rgba(10,10,18,0.6)"
                      borderColor="rgba(139,92,246,0.15)"
                      color="gray.200"
                      _placeholder={{ color: "gray.600" }}
                      _focus={{ borderColor: "purple.500" }}
                    />
                  </Box>

                  {/* Writing Settings */}
                  <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
                    <Box>
                      <HStack justify="space-between" mb="1">
                        <Text fontSize="2xs" color="gray.500">Length</Text>
                        <Text fontSize="2xs" color="blue.400" fontWeight="600">{novelSettings.length}</Text>
                      </HStack>
                      <input
                        type="range"
                        min="500"
                        max="5000"
                        step="100"
                        value={novelSettings.length}
                        onChange={(e) => setNovelSettings({ ...novelSettings, length: parseInt(e.target.value) })}
                        style={{
                          width: "100%",
                          accentColor: "#6366f1",
                          background: "rgba(99,102,241,0.2)",
                          borderRadius: "9999px",
                          height: "6px",
                        }}
                      />
                    </Box>
                    <Box>
                      <HStack justify="space-between" mb="1">
                        <Text fontSize="2xs" color="gray.500">Dialogue Balance</Text>
                        <Text fontSize="2xs" color="blue.400" fontWeight="600">{novelSettings.dialogueBalance}</Text>
                      </HStack>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="10"
                        value={novelSettings.dialogueBalance}
                        onChange={(e) => setNovelSettings({ ...novelSettings, dialogueBalance: parseInt(e.target.value) })}
                        style={{
                          width: "100%",
                          accentColor: "#6366f1",
                          background: "rgba(99,102,241,0.2)",
                          borderRadius: "9999px",
                          height: "6px",
                        }}
                      />
                    </Box>
                  </SimpleGrid>

                  <Box>
                    <Text fontSize="2xs" color="gray.500" mb="1">Point of view</Text>
                    <Input
                      placeholder="First-person, Second-person, Third-person..."
                      value={novelSettings.pov}
                      onChange={(e) => setNovelSettings({ ...novelSettings, pov: e.target.value })}
                      size="sm"
                      bg="rgba(10,10,18,0.6)"
                      borderColor="rgba(99,102,241,0.15)"
                      color="gray.200"
                      _placeholder={{ color: "gray.600" }}
                    />
                  </Box>

                  {/* Generate Chapter Button */}
                  <Button
                    size="lg"
                    w="full"
                    bg="linear-gradient(135deg, #6366f1, #8b5cf6)"
                    color="white"
                    borderRadius="xl"
                    onClick={generateChapterContent}
                    loading={isLoading}
                    loadingText="جارٍ الكتابة..."
                    _hover={{ shadow: "0 0 30px rgba(99,102,241,0.4)", transform: "translateY(-1px)" }}
                  >
                    <Icon as={LuSparkles} mr="2" />
                    Generate Chapter
                  </Button>
                </VStack>
              ) : (
                /* Custom Tab - Outline Structure */
                <VStack gap="4" align="stretch">
                  <HStack justify="space-between">
                    <Text fontWeight="600" color="white" fontSize="sm">هيكل الرواية</Text>
                    <Button size="xs" variant="ghost" onClick={addAct} color="blue.400">
                      <Icon as={LuPlus} mr="1" />
                      Act
                    </Button>
                  </HStack>

                  {acts.map((act) => (
                    <Box
                      key={act.id}
                      p="4"
                      rounded="xl"
                      bg="rgba(99,102,241,0.04)"
                      border="1px solid"
                      borderColor="rgba(99,102,241,0.12)"
                    >
                      <HStack justify="space-between" mb="3">
                        <HStack gap="2">
                          <Text fontWeight="700" color="blue.400" fontSize="sm">Act {act.id}:</Text>
                          <Input
                            value={act.title}
                            onChange={(e) =>
                              setActs((prev) =>
                                prev.map((a) => (a.id === act.id ? { ...a, title: e.target.value } : a))
                              )
                            }
                            size="xs"
                            w="150px"
                            bg="transparent"
                            border="none"
                            color="gray.400"
                            _focus={{ border: "none" }}
                            placeholder="Untitled"
                          />
                        </HStack>
                        <Button size="xs" variant="ghost" onClick={() => addChapter(act.id)} color="purple.400">
                          <Icon as={LuPlus} mr="1" />
                          Chapter
                        </Button>
                      </HStack>

                      {act.chapters.map((chapter) => (
                        <Box
                          key={chapter.id}
                          ml="4"
                          p="3"
                          mb="2"
                          rounded="lg"
                          bg="rgba(0,0,0,0.2)"
                          border="1px solid"
                          borderColor="rgba(99,102,241,0.08)"
                        >
                          <HStack justify="space-between" mb="2">
                            <HStack gap="2">
                              <Badge size="sm" colorPalette="purple" variant="subtle">{chapter.title}</Badge>
                              <IconButton
                                aria-label="تعديل"
                                variant="ghost"
                                size="2xs"
                                color="gray.600"
                                _hover={{ color: "white" }}
                              >
                                <Icon as={LuPencilLine} boxSize="3" />
                              </IconButton>
                            </HStack>
                            <Button size="2xs" variant="ghost" onClick={() => addScene(act.id, chapter.id)} color="cyan.400">
                              <Icon as={LuPlus} mr="0.5" boxSize="3" />
                              Scene
                            </Button>
                          </HStack>

                          {chapter.scenes.map((scene) => (
                            <Box key={scene.id} mb="2">
                              <HStack mb="1">
                                <Badge size="xs" colorPalette="cyan" variant="outline">{scene.title}</Badge>
                              </HStack>
                              <Textarea
                                placeholder="Synopsis..."
                                value={scene.synopsis}
                                onChange={(e) => updateSceneSynopsis(act.id, chapter.id, scene.id, e.target.value)}
                                size="xs"
                                minH="60px"
                                bg="rgba(10,10,18,0.6)"
                                borderColor="rgba(99,102,241,0.1)"
                                color="gray.300"
                                fontSize="xs"
                                _placeholder={{ color: "gray.700" }}
                              />
                            </Box>
                          ))}
                        </Box>
                      ))}
                    </Box>
                  ))}

                  {/* Quick Setup Button */}
                  <Button
                    size="lg"
                    w="full"
                    bg="linear-gradient(135deg, #6366f1, #8b5cf6)"
                    color="white"
                    borderRadius="xl"
                    onClick={generateOutline}
                    loading={isLoading}
                    _hover={{ shadow: "0 0 30px rgba(99,102,241,0.4)" }}
                  >
                    <Icon as={LuSparkles} mr="2" />
                    Quick Setup
                  </Button>
                </VStack>
              )}
            </VStack>
          )}

          {/* Processing/Results View */}
          {(currentStage === "outline" || currentStage === "beats" || currentStage === "writing" || currentStage === "complete") && (
            <VStack gap="4" align="stretch">
              {/* Stage Header */}
              <Box
                p="3"
                rounded="lg"
                bg={currentStage === "complete" ? "rgba(34,197,94,0.06)" : "rgba(99,102,241,0.06)"}
                border="1px solid"
                borderColor={currentStage === "complete" ? "rgba(34,197,94,0.15)" : "rgba(99,102,241,0.15)"}
              >
                <HStack justify="space-between" align="center">
                  <HStack gap="2">
                    <Icon
                      as={currentStage === "complete" ? LuCheckCheck : currentStage === "outline" ? LuFocus : currentStage === "beats" ? LuPencilLine : LuWandSparkles}
                      boxSize="5"
                      color={currentStage === "complete" ? "green.400" : "blue.400"}
                    />
                    <VStack gap="0" align="start">
                      <Text fontSize="sm" fontWeight="700" color="white">
                        {currentStage === "outline" && "جارٍ إنشاء المخطط..."}
                        {currentStage === "beats" && "جارٍ إنشاء Scene Beats..."}
                        {currentStage === "writing" && "جارٍ كتاب�� الفصل..."}
                        {currentStage === "complete" && "تم إنجاز الفصل بنجاح!"}
                      </Text>
                      <Text fontSize="2xs" color="gray.500">
                        {currentStage === "complete" ? "يمكنك الآن تصدير أو نسخ النص" : "يرجى الانتظار..."}
                      </Text>
                    </VStack>
                  </HStack>
                  {isLoading && <Spinner size="sm" color="blue.400" />}
                </HStack>
              </Box>

              {/* Content Display */}
              <Box
                flex="1"
                p="4"
                rounded="xl"
                bg="rgba(10,10,18,0.6)"
                border="1px solid"
                borderColor="rgba(99,102,241,0.08)"
                minH="300px"
                maxH="500px"
                overflow="auto"
              >
                {getCurrentContent() ? (
                  <Text
                    fontSize="sm"
                    color="gray.200"
                    lineHeight="2"
                    whiteSpace="pre-wrap"
                    wordBreak="break-word"
                    dir="rtl"
                  >
                    {getCurrentContent()}
                    {isLoading && (
                      <Box
                        as="span"
                        display="inline-block"
                        w="2px"
                        h="18px"
                        bg="blue.400"
                        ml="1"
                        verticalAlign="middle"
                        css={{ animation: "blink 1s step-end infinite" }}
                      />
                    )}
                  </Text>
                ) : (
                  <VStack gap="3" justify="center" align="center" h="full" minH="200px">
                    <Spinner size="lg" color="blue.400" />
                    <Text fontSize="sm" color="gray.500">جارٍ المعالجة...</Text>
                  </VStack>
                )}
              </Box>

              {/* Actions */}
              {!isLoading && (
                <HStack gap="2" justify="space-between">
                  <HStack gap="2">
                    {currentStage === "outline" && (
                      <Button size="sm" colorPalette="purple" onClick={generateBeats} borderRadius="lg">
                        <Icon as={LuChevronRight} mr="1" />
                        التالي: Scene Beats
                      </Button>
                    )}
                    {currentStage === "beats" && (
                      <Button size="sm" colorPalette="cyan" onClick={generateChapterContent} borderRadius="lg">
                        <Icon as={LuChevronRight} mr="1" />
                        التالي: كتابة الفصل
                      </Button>
                    )}
                    {currentStage === "complete" && (
                      <>
                        <Button size="sm" variant="outline" onClick={handleExport} borderRadius="lg">
                          <Icon as={LuDownload} mr="1" />
                          تنزيل
                        </Button>
                        <Button size="sm" variant="outline" onClick={copyToClipboard} borderRadius="lg">
                          <Icon as={copied ? LuCheck : LuCopy} mr="1" />
                          {copied ? "تم النسخ" : "نسخ"}
                        </Button>
                      </>
                    )}
                  </HStack>
                  {currentStage === "complete" && (
                    <Button size="sm" colorPalette="blue" onClick={handleReset} borderRadius="lg">
                      <Icon as={LuRotateCcw} mr="1" />
                      فصل جديد
                    </Button>
                  )}
                </HStack>
              )}
            </VStack>
          )}
        </Box>
      </Box>
    </Box>
  )
}
