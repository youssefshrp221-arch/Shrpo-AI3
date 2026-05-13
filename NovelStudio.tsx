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
  Flex,
  Spinner,
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
} from "react-icons/lu"
import { ProgressRoot, ProgressBar, ProgressValueText } from "@/components/ui/progress"
import { useAppStore } from "@/store/appStore"
import { streamChatWithFallback } from "@/lib/modelOrchestrator"
import { toaster } from "@/components/ui/toaster"

type NovelStage = "idea" | "stage1" | "stage2" | "stage3" | "complete"

interface NovelData {
  idea: string
  plot: string
  draft: string
  refined: string
}

const STAGE_CONFIG: Record<string, { title: string; subtitle: string; model: string; icon: any; color: string }> = {
  stage1: {
    title: "التخطيط وبناء العالم",
    subtitle: "استقبال الفكرة وتحويلها إلى خطة شاملة",
    model: "meta/llama-4-maverick-17b-128e-instruct",
    icon: LuFocus,
    color: "blue",
  },
  stage2: {
    title: "الكتابة الإبداعية",
    subtitle: "تحويل الخطة إلى فصول روائية أدبية",
    model: "deepseek-ai/deepseek-v3",
    icon: LuPencilLine,
    color: "purple",
  },
  stage3: {
    title: "الصقل والمراجعة",
    subtitle: "تحسين النص وإضافة التفاصيل الدقيقة",
    model: "nvidia/llama-3.1-nemotron-70b-instruct",
    icon: LuWandSparkles,
    color: "cyan",
  },
}

export default function NovelStudio() {
  const { settings } = useAppStore()
  const [currentStage, setCurrentStage] = useState<NovelStage>("idea")
  const [novelData, setNovelData] = useState<NovelData>({
    idea: "",
    plot: "",
    draft: "",
    refined: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [streamingText, setStreamingText] = useState("")
  const [copied, setCopied] = useState(false)
  const [novelTitle, setNovelTitle] = useState("")

  const getProgressValue = () => {
    switch (currentStage) {
      case "idea": return 0
      case "stage1": return 33
      case "stage2": return 66
      case "stage3": return 90
      case "complete": return 100
      default: return 0
    }
  }

  const isStageCompleted = (stage: string) => {
    const order = ["idea", "stage1", "stage2", "stage3", "complete"]
    return order.indexOf(currentStage) > order.indexOf(stage)
  }

  const handleIdeaSubmit = async (idea: string) => {
    if (!idea.trim() || isLoading) return

    const newData = { ...novelData, idea }
    setNovelData(newData)
    setIsLoading(true)
    setStreamingText("")
    setCurrentStage("stage1")

    try {
      const result = await streamChatWithFallback(
        [{ role: "user", content: buildStage1Prompt(idea) }],
        "meta/llama-4-maverick-17b-128e-instruct",
        {
          onChunk: (chunk) => setStreamingText((prev) => prev + chunk),
          signal: new AbortController().signal,
          temperature: settings.temperature,
        }
      )

      const updatedData = { ...newData, plot: result.fullContent }
      setNovelData(updatedData)
      setCurrentStage("stage2")
      setStreamingText("")

      // Stage 2
      const result2 = await streamChatWithFallback(
        [{ role: "user", content: buildStage2Prompt(idea, result.fullContent) }],
        "deepseek-ai/deepseek-v3",
        {
          onChunk: (chunk) => setStreamingText((prev) => prev + chunk),
          signal: new AbortController().signal,
          temperature: 0.7,
        }
      )

      const updatedData2 = { ...updatedData, draft: result2.fullContent }
      setNovelData(updatedData2)
      setCurrentStage("stage3")
      setStreamingText("")

      // Stage 3
      const result3 = await streamChatWithFallback(
        [{ role: "user", content: buildStage3Prompt(result2.fullContent) }],
        "nvidia/llama-3.1-nemotron-70b-instruct",
        {
          onChunk: (chunk) => setStreamingText((prev) => prev + chunk),
          signal: new AbortController().signal,
          temperature: 0.6,
        }
      )

      setNovelData({ ...updatedData2, refined: result3.fullContent })
      setCurrentStage("complete")
      toaster.create({ title: "تم إنجاز الرواية بنجاح!", type: "success" })
    } catch (err: any) {
      toaster.create({ title: "حدث خطأ", description: err.message, type: "error" })
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = () => {
    const text = streamingText || novelData.refined
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExport = (format: "txt" | "pdf") => {
    const text = novelData.refined || streamingText
    if (!text) {
      toaster.create({ title: "لا يوجد نص لتصديره", type: "error" })
      return
    }
    const fileName = novelTitle || "novel"
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${fileName}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toaster.create({ title: `تم تنزيل ${fileName}.txt`, type: "success" })
  }

  const handleReset = () => {
    setCurrentStage("idea")
    setNovelData({ idea: "", plot: "", draft: "", refined: "" })
    setStreamingText("")
    setNovelTitle("")
    setIsLoading(false)
  }

  return (
    <Box h="100%" display="flex" flexDirection="column" bg="#0a0a0f" w="full">
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
          <HStack gap="2">
            <Icon as={LuBookOpen} boxSize="5" color="blue.400" />
            <Heading size="md" color="white">Novel Studio</Heading>
            <Badge colorPalette="blue" variant="subtle" fontSize="2xs">3 مراحل</Badge>
          </HStack>

          {/* Progress Bar */}
          <Box w="full">
            <ProgressRoot value={getProgressValue()} size="xs" colorPalette="blue">
              <HStack justify="space-between" mb="1">
                <Text fontSize="2xs" color="gray.500">التقدم</Text>
                <ProgressValueText fontSize="2xs" color="gray.400" />
              </HStack>
              <ProgressBar borderRadius="full" />
            </ProgressRoot>
          </Box>

          {/* Stage Indicators */}
          <HStack w="full" gap="2">
            {Object.entries(STAGE_CONFIG).map(([stage, config]) => {
              const isActive = currentStage === stage
              const isDone = isStageCompleted(stage)
              return (
                <Box
                  key={stage}
                  flex="1"
                  py="2"
                  px="1"
                  rounded="md"
                  bg={isActive ? "rgba(59,130,246,0.12)" : isDone ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.02)"}
                  border="1px solid"
                  borderColor={isActive ? "rgba(59,130,246,0.3)" : isDone ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.05)"}
                  textAlign="center"
                  transition="all 0.2s"
                >
                  <HStack justify="center" gap="1" mb="0.5">
                    <Icon
                      as={isDone ? LuCheckCheck : config.icon}
                      boxSize="3.5"
                      color={isDone ? "green.400" : isActive ? `${config.color}.400` : "gray.600"}
                    />
                  </HStack>
                  <Text fontSize="2xs" fontWeight="600" color={isActive ? "gray.200" : isDone ? "green.300" : "gray.600"} noOfLines={1}>
                    {config.title}
                  </Text>
                </Box>
              )
            })}
          </HStack>
        </VStack>
      </Box>

      {/* Main Content */}
      <Box flex="1" overflow="auto" p={{ base: "3", md: "5" }}>
        {currentStage === "idea" && !isLoading && (
          <IdeaInputPanel onSubmit={handleIdeaSubmit} />
        )}

        {(currentStage === "stage1" || currentStage === "stage2" || currentStage === "stage3") && (
          <ProcessingPanel
            stage={currentStage}
            text={streamingText}
            isLoading={isLoading}
            onCopy={copyToClipboard}
            copied={copied}
          />
        )}

        {currentStage === "complete" && (
          <CompletePanel
            novelData={novelData}
            novelTitle={novelTitle}
            setNovelTitle={setNovelTitle}
            onExport={handleExport}
            onReset={handleReset}
          />
        )}
      </Box>
    </Box>
  )
}

function IdeaInputPanel({ onSubmit }: { onSubmit: (idea: string) => void }) {
  const [idea, setIdea] = useState("")

  return (
    <VStack gap="6" align="center" justify="center" h="full" maxW="2xl" mx="auto">
      <VStack gap="2" align="center">
        <Icon as={LuSparkles} boxSize="10" color="blue.400" />
        <Heading size="lg" color="white" textAlign="center">
          أطلق خيالك الآن
        </Heading>
        <Text color="gray.400" textAlign="center" fontSize="sm" maxW="md">
          اكتب فكرتك للرواية، وستقوم Novel Studio بتحويلها إلى رواية احترافية عبر 3 مراحل متسلسلة
        </Text>
      </VStack>

      <Box
        w="full"
        p="5"
        rounded="xl"
        bg="rgba(99,102,241,0.04)"
        border="1px solid"
        borderColor="rgba(99,102,241,0.15)"
      >
        <VStack gap="4">
          <Textarea
            placeholder="مثال: قصة عن رجل يستيقظ في عالم خيالي بدون ذاكرة، ويحاول اكتشاف هويته..."
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            minH="120px"
            fontSize="sm"
            bg="rgba(10,10,15,0.6)"
            borderColor="rgba(99,102,241,0.15)"
            color="gray.200"
            _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px rgba(59,130,246,0.3)" }}
            _placeholder={{ color: "gray.600" }}
          />

          <Button
            w="full"
            size="lg"
            colorPalette="blue"
            onClick={() => onSubmit(idea)}
            disabled={!idea.trim()}
            borderRadius="xl"
          >
            ابدأ رحلة الكتابة
          </Button>
        </VStack>
      </Box>
    </VStack>
  )
}

function ProcessingPanel({
  stage,
  text,
  isLoading,
  onCopy,
  copied,
}: {
  stage: string
  text: string
  isLoading: boolean
  onCopy: () => void
  copied: boolean
}) {
  const config = STAGE_CONFIG[stage]
  if (!config) return null

  return (
    <VStack gap="4" align="stretch" h="full">
      {/* Stage Header */}
      <Box
        p="3"
        rounded="lg"
        bg="rgba(99,102,241,0.06)"
        border="1px solid"
        borderColor="rgba(99,102,241,0.15)"
      >
        <HStack justify="space-between" align="center">
          <HStack gap="2">
            <Box
              p="1.5"
              rounded="md"
              bg={`${config.color}.500/10`}
            >
              <Icon as={config.icon} boxSize="4" color={`${config.color}.400`} />
            </Box>
            <VStack gap="0" align="start">
              <Text fontSize="sm" fontWeight="700" color="white">{config.title}</Text>
              <Text fontSize="2xs" color="gray.500">{config.subtitle}</Text>
            </VStack>
          </HStack>
          {isLoading && (
            <HStack gap="2">
              <Spinner size="sm" color="blue.400" />
              <Text fontSize="2xs" color="gray.500">جارٍ المعالجة...</Text>
            </HStack>
          )}
        </HStack>
      </Box>

      {/* Streaming Text Display */}
      <Box
        flex="1"
        p="4"
        rounded="lg"
        bg="rgba(10,10,18,0.6)"
        border="1px solid"
        borderColor="rgba(99,102,241,0.08)"
        overflow="auto"
        minH="200px"
      >
        {text ? (
          <Box position="relative">
            <Text
              fontSize="sm"
              color="gray.200"
              lineHeight="1.9"
              whiteSpace="pre-wrap"
              wordBreak="break-word"
              dir="rtl"
            >
              {text}
            </Text>
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
          </Box>
        ) : (
          <VStack gap="3" justify="center" align="center" h="full" minH="150px">
            <Spinner size="lg" color="blue.400" />
            <Text fontSize="sm" color="gray.500">جارٍ توليد المحتوى...</Text>
          </VStack>
        )}
      </Box>

      {/* Actions */}
      {text && !isLoading && (
        <HStack gap="2" justify="flex-end">
          <Button
            size="sm"
            variant="outline"
            onClick={onCopy}
            borderRadius="lg"
          >
            <Icon as={copied ? LuCheck : LuCopy} boxSize="3.5" mr="1" />
            {copied ? "تم النسخ" : "نسخ"}
          </Button>
        </HStack>
      )}
    </VStack>
  )
}

function CompletePanel({
  novelData,
  novelTitle,
  setNovelTitle,
  onExport,
  onReset,
}: {
  novelData: NovelData
  novelTitle: string
  setNovelTitle: (title: string) => void
  onExport: (format: "txt" | "pdf") => void
  onReset: () => void
}) {
  return (
    <VStack gap="4" align="stretch" h="full">
      {/* Success Banner */}
      <Box
        p="3"
        rounded="lg"
        bg="rgba(34,197,94,0.06)"
        border="1px solid"
        borderColor="rgba(34,197,94,0.15)"
      >
        <HStack gap="2">
          <Icon as={LuCheckCheck} boxSize="5" color="green.400" />
          <VStack gap="0" align="start" flex="1">
            <Text fontSize="sm" fontWeight="700" color="white">تم إنجاز الرواية بنجاح!</Text>
            <Text fontSize="2xs" color="gray.500">تم الانتهاء من جميع المراحل الثلاث</Text>
          </VStack>
        </HStack>
      </Box>

      {/* Novel Title */}
      <Box>
        <Text fontSize="2xs" fontWeight="600" color="gray.500" mb="1.5" textTransform="uppercase" letterSpacing="0.05em">
          اسم الرواية
        </Text>
        <Input
          placeholder="أدخل عنوان روايتك..."
          value={novelTitle}
          onChange={(e) => setNovelTitle(e.target.value)}
          size="sm"
          bg="rgba(10,10,18,0.6)"
          borderColor="rgba(99,102,241,0.15)"
          color="gray.200"
          _focus={{ borderColor: "blue.500" }}
          _placeholder={{ color: "gray.600" }}
          borderRadius="lg"
        />
      </Box>

      {/* Novel Preview */}
      <Box
        flex="1"
        p="4"
        rounded="lg"
        bg="rgba(10,10,18,0.6)"
        border="1px solid"
        borderColor="rgba(99,102,241,0.08)"
        overflow="auto"
        minH="200px"
      >
        <Text fontSize="2xs" fontWeight="600" color="gray.500" mb="2" textTransform="uppercase" letterSpacing="0.05em">
          النسخة النهائية المحررة
        </Text>
        <Text fontSize="sm" color="gray.200" lineHeight="1.9" whiteSpace="pre-wrap" dir="rtl">
          {novelData.refined}
        </Text>
      </Box>

      {/* Export & Actions */}
      <HStack gap="2" justify="space-between">
        <HStack gap="2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onExport("txt")}
            borderRadius="lg"
          >
            <Icon as={LuDownload} boxSize="3.5" mr="1" />
            تنزيل TXT
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onExport("pdf")}
            borderRadius="lg"
          >
            <Icon as={LuDownload} boxSize="3.5" mr="1" />
            تنزيل PDF
          </Button>
        </HStack>
        <Button
          size="sm"
          colorPalette="blue"
          onClick={onReset}
          borderRadius="lg"
        >
          <Icon as={LuRotateCcw} boxSize="3.5" mr="1" />
          رواية جديدة
        </Button>
      </HStack>
    </VStack>
  )
}

// Prompt builders
function buildStage1Prompt(idea: string): string {
  return `أنت خبير تخطيط روايات. بناءً على الفكرة التالية، قم بإنشاء خطة شاملة للرواية:

الفكرة: ${idea}

اكتب بالتفصيل:
1. ملخص أحداث الرواية (3-5 نقاط رئيسية)
2. قائمة الشخصيات الرئيسية مع وصف سريع لكل شخصية
3. وصف العالم والإعدادات الزمكانية

اجعل الرد منظماً وواضحاً ومفصلاً.`
}

function buildStage2Prompt(idea: string, plot: string): string {
  return `أنت كاتب روائي محترف. بناءً على الخطة التالية، اكتب الفصل الأول من الرواية:

الفكرة الأصلية: ${idea}

الخطة:
${plot}

اكتب فصلاً روائياً طويلاً (1000+ كلمة) بأسلوب أدبي رفيع:
- استخدم وصفاً حسياً غنياً
- أنشئ أجواءً مشوقة
- اجعل الحوار طبيعياً وممتعاً
- استخدم LaTeX للمعادلات إن لزم ($E=mc^2$, $\\sqrt{x}$)
- اكتب بأسلوب أدبي احترافي`
}

function buildStage3Prompt(draft: string): string {
  return `أنت محرر نصوص متخصص في الأدب العربي. قم بمراجعة وتحسين النص التالي:

${draft}

قم بـ:
1. إصلاح الأخطاء اللغوية والنحوية
2. تحسين التدفق والسلاسة بين الفقرات
3. إضافة تفاصيل دقيقة لزيادة الدراما والتشويق
4. تحسين الحوار ليبدو أكثر طبيعية
5. الحفاظ على الأسلوب الأدبي الرفيع

Rewrite the previous text to be more dramatic and fix any linguistic errors`
}
