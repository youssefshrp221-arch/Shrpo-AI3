import { useState, useEffect } from "react"
import { Box, Button, VStack, HStack, Text, Badge, Spinner, Input, Textarea } from "@chakra-ui/react"
import { MODEL_REGISTRY } from "@/types"
import { streamChatWithFallback } from "@/lib/modelOrchestrator"

interface ModelTestResult {
  modelId: string
  modelName: string
  status: "pending" | "testing" | "success" | "failed"
  response?: string
  error?: string
  responseTime?: number
}

export default function ModelTester() {
  const [results, setResults] = useState<ModelTestResult[]>([])
  const [isTesting, setIsTesting] = useState(false)
  const [testMessage, setTestMessage] = useState("مرحبا، كيف حالك؟")
  const [selectedModel, setSelectedModel] = useState<string>("")

  useEffect(() => {
    // Initialize results for all models
    const initialResults = MODEL_REGISTRY.map((model) => ({
      modelId: model.id,
      modelName: model.name,
      status: "pending" as const,
    }))
    setResults(initialResults)
  }, [])

  const testSingleModel = async (modelId: string, modelName: string) => {
    const startTime = Date.now()
    
    try {
      setResults((prev) =>
        prev.map((r) =>
          r.modelId === modelId ? { ...r, status: "testing" as const } : r
        )
      )

      console.log(`[v0] Testing model: ${modelId}`)

      const result = await streamChatWithFallback(
        [{ role: "user" as const, content: testMessage }],
        {
          signal: new AbortController().signal,
        }
      )

      const responseTime = Date.now() - startTime

      console.log(`[v0] Model ${modelId} success in ${responseTime}ms`)

      setResults((prev) =>
        prev.map((r) =>
          r.modelId === modelId
            ? {
                ...r,
                status: "success" as const,
                response: result.fullContent?.substring(0, 150) + "...",
                responseTime,
              }
            : r
        )
      )
    } catch (error: any) {
      const responseTime = Date.now() - startTime
      console.error(`[v0] Model ${modelId} failed:`, error.message)

      setResults((prev) =>
        prev.map((r) =>
          r.modelId === modelId
            ? {
                ...r,
                status: "failed" as const,
                error: error.message,
                responseTime,
              }
            : r
        )
      )
    }
  }

  const testAllModels = async () => {
    setIsTesting(true)
    setResults((prev) => prev.map((r) => ({ ...r, status: "pending" as const })))

    for (const model of MODEL_REGISTRY) {
      await testSingleModel(model.id, model.name)
    }

    setIsTesting(false)
  }

  const testSelected = async () => {
    if (!selectedModel) return
    const model = MODEL_REGISTRY.find((m) => m.id === selectedModel)
    if (model) {
      await testSingleModel(model.id, model.name)
    }
  }

  const successCount = results.filter((r) => r.status === "success").length
  const failedCount = results.filter((r) => r.status === "failed").length

  return (
    <Box w="full" maxW="4xl" mx="auto" p={6} bg="gray.900" borderRadius="lg">
      <VStack align="stretch" gap={4}>
        <Box>
          <Text fontSize="2xl" fontWeight="bold" color="white" mb={2}>
            نموذج اختبار الذكاء الاصطناعي
          </Text>
          <Text color="gray.400" fontSize="sm">
            اختبر جميع النماذج المتاحة للتحقق من أنها تعمل بشكل صحيح
          </Text>
        </Box>

        {/* Test Message Input */}
        <VStack align="stretch" gap={2}>
          <Text fontWeight="semibold" color="white">
            رسالة الاختبار:
          </Text>
          <Textarea
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="أدخل رسالة اختبار..."
            bg="gray.800"
            color="white"
            borderColor="gray.700"
            _placeholder={{ color: "gray.500" }}
            rows={3}
          />
        </VStack>

        {/* Control Buttons */}
        <HStack gap={3}>
          <Button
            onClick={testAllModels}
            isDisabled={isTesting}
            colorScheme="blue"
            w="full"
          >
            {isTesting ? (
              <>
                <Spinner size="sm" mr={2} />
                جاري الاختبار...
              </>
            ) : (
              "اختبار جميع النماذج"
            )}
          </Button>
        </HStack>

        {/* Model Selection & Single Test */}
        <VStack align="stretch" gap={2}>
          <Text fontWeight="semibold" color="white">
            اختبار نموذج واحد:
          </Text>
          <HStack gap={2}>
            <Input
              as="select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              bg="gray.800"
              color="white"
              borderColor="gray.700"
              flex={1}
            >
              <option value="">اختر نموذج...</option>
              {MODEL_REGISTRY.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.provider})
                </option>
              ))}
            </Input>
            <Button
              onClick={testSelected}
              isDisabled={!selectedModel || isTesting}
              colorScheme="green"
            >
              اختبار
            </Button>
          </HStack>
        </VStack>

        {/* Results Summary */}
        <HStack gap={4} w="full" justify="space-around">
          <Box textAlign="center">
            <Text fontSize="2xl" fontWeight="bold" color="green.400">
              {successCount}
            </Text>
            <Text fontSize="sm" color="gray.400">
              نجاح
            </Text>
          </Box>
          <Box textAlign="center">
            <Text fontSize="2xl" fontWeight="bold" color="red.400">
              {failedCount}
            </Text>
            <Text fontSize="sm" color="gray.400">
              فشل
            </Text>
          </Box>
          <Box textAlign="center">
            <Text fontSize="2xl" fontWeight="bold" color="yellow.400">
              {results.filter((r) => r.status === "testing").length}
            </Text>
            <Text fontSize="sm" color="gray.400">
              قيد الاختبار
            </Text>
          </Box>
        </HStack>

        {/* Results List */}
        <VStack align="stretch" gap={2} maxH="500px" overflowY="auto">
          {results.map((result) => (
            <Box
              key={result.modelId}
              p={3}
              bg="gray.800"
              borderRadius="md"
              borderLeft="4px"
              borderLeftColor={
                result.status === "success"
                  ? "green.500"
                  : result.status === "failed"
                    ? "red.500"
                    : result.status === "testing"
                      ? "blue.500"
                      : "gray.600"
              }
            >
              <HStack justify="space-between" align="start" mb={2}>
                <VStack align="start" gap={0}>
                  <Text fontWeight="bold" color="white" fontSize="sm">
                    {result.modelName}
                  </Text>
                  <Text color="gray.500" fontSize="xs">
                    {result.modelId}
                  </Text>
                </VStack>
                <Badge
                  colorScheme={
                    result.status === "success"
                      ? "green"
                      : result.status === "failed"
                        ? "red"
                        : result.status === "testing"
                          ? "blue"
                          : "gray"
                  }
                >
                  {result.status === "success"
                    ? "✓ نجاح"
                    : result.status === "failed"
                      ? "✕ فشل"
                      : result.status === "testing"
                        ? "⟳ قيد الاختبار"
                        : "قيد الانتظار"}
                </Badge>
              </HStack>

              {result.responseTime && (
                <Text color="gray.400" fontSize="xs" mb={1}>
                  الوقت: {result.responseTime}ms
                </Text>
              )}

              {result.response && (
                <Text color="green.300" fontSize="xs" mb={1} noOfLines={2}>
                  {result.response}
                </Text>
              )}

              {result.error && (
                <Text color="red.300" fontSize="xs">
                  الخطأ: {result.error}
                </Text>
              )}
            </Box>
          ))}
        </VStack>

        {/* Export Results */}
        <Button
          onClick={() => {
            const resultsText = results
              .map(
                (r) =>
                  `${r.modelName}: ${r.status} ${r.responseTime ? `(${r.responseTime}ms)` : ""}`
              )
              .join("\n")
            navigator.clipboard.writeText(resultsText)
          }}
          colorScheme="purple"
          w="full"
        >
          نسخ النتائج
        </Button>
      </VStack>
    </Box>
  )
}
