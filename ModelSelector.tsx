import { useState, useRef, useEffect } from "react"
import {
  Box,
  HStack,
  VStack,
  Text,
  Icon,
  Badge,
  Input,
  Flex,
  SimpleGrid,
} from "@chakra-ui/react"
import {
  LuChevronDown,
  LuBrain,
  LuEye,
  LuSearch,
  LuZap,
  LuFlame,
  LuSparkles,
} from "react-icons/lu"
import { useAppStore } from "@/store/appStore"
import { NVIDIA_MODELS, getModelsByProvider, ModelConfig } from "@/types"

// Provider icons and colors
const PROVIDER_CONFIG: Record<string, { icon: any; color: string; bgColor: string }> = {
  Meta: { icon: LuBrain, color: "blue.400", bgColor: "rgba(59, 130, 246, 0.1)" },
  NVIDIA: { icon: LuFlame, color: "orange.400", bgColor: "rgba(249, 115, 22, 0.1)" },
  Google: { icon: LuSearch, color: "cyan.400", bgColor: "rgba(6, 182, 212, 0.1)" },
  Microsoft: { icon: LuZap, color: "purple.400", bgColor: "rgba(168, 85, 247, 0.1)" },
  Mistral: { icon: LuSparkles, color: "yellow.400", bgColor: "rgba(234, 179, 8, 0.1)" },
  DeepSeek: { icon: LuBrain, color: "green.400", bgColor: "rgba(34, 197, 94, 0.1)" },
}

// Badge colors based on type
const TYPE_BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  reasoning: { bg: "rgba(99, 102, 241, 0.15)", color: "indigo.300" },
  general: { bg: "rgba(6, 182, 212, 0.15)", color: "cyan.300" },
  premium: { bg: "rgba(168, 85, 247, 0.15)", color: "purple.300" },
  chat: { bg: "rgba(34, 197, 94, 0.15)", color: "green.300" },
  fast: { bg: "rgba(234, 179, 8, 0.15)", color: "yellow.300" },
  ultra: { bg: "rgba(239, 68, 68, 0.15)", color: "red.300" },
  creative: { bg: "rgba(236, 72, 153, 0.15)", color: "pink.300" },
  precision: { bg: "rgba(14, 165, 233, 0.15)", color: "sky.300" },
  thinking: { bg: "rgba(249, 115, 22, 0.15)", color: "orange.300" },
}

interface ModelSelectorProps {
  mobile?: boolean
}

export default function ModelSelector({ mobile = false }: ModelSelectorProps) {
  const { selectedModel, setSelectedModel } = useAppStore()
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredModels, setFilteredModels] = useState<ModelConfig[]>(NVIDIA_MODELS)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentModel = NVIDIA_MODELS.find(m => m.id === selectedModel) || NVIDIA_MODELS[0]

  // Filter models based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredModels(NVIDIA_MODELS)
      return
    }

    const query = searchQuery.toLowerCase()
    setFilteredModels(
      NVIDIA_MODELS.filter(
        m =>
          m.name.toLowerCase().includes(query) ||
          m.description.toLowerCase().includes(query) ||
          m.provider.toLowerCase().includes(query) ||
          m.type.toLowerCase().includes(query)
      )
    )
  }, [searchQuery])

  // Close on outside click
  useEffect(() => {
    if (!open) return

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  const providerConfig = PROVIDER_CONFIG[currentModel.provider]

  if (mobile) {
    return (
      <Box
        ref={containerRef}
        px="3"
        py="2"
        borderTop="1px solid"
        borderColor="rgba(99,102,241,0.1)"
        bg="rgba(10,10,15,0.95)"
        position="relative"
      >
        <Flex
          alignItems="center"
          gap="2"
          px="3"
          py="2"
          bg="rgba(99,102,241,0.08)"
          border="1px solid"
          borderColor="rgba(99,102,241,0.2)"
          borderRadius="lg"
          cursor="pointer"
          _hover={{ borderColor: "rgba(99,102,241,0.4)" }}
          _active={{ bg: "rgba(99,102,241,0.12)" }}
          onClick={() => setOpen(!open)}
          transition="all 0.15s"
        >
          <Icon as={providerConfig.icon} boxSize="13px" color={providerConfig.color} flexShrink={0} />
          <Text fontSize="2xs" fontWeight="600" color="gray.300" flex="1" isTruncated>
            {currentModel.name}
          </Text>
          <Icon
            as={LuChevronDown}
            boxSize="12px"
            color="gray.500"
            transform={open ? "rotate(180deg)" : "rotate(0deg)"}
            transition="transform 0.2s"
            flexShrink={0}
          />
        </Flex>

        {open && (
          <>
            <Box position="fixed" inset={0} zIndex={40} onClick={() => setOpen(false)} />
            <Box
              position="absolute"
              bottom="100%"
              left="3"
              right="3"
              mb="2"
              zIndex={50}
              bg="rgba(19,19,31,0.99)"
              border="1px solid"
              borderColor="rgba(99,102,241,0.3)"
              borderRadius="xl"
              shadow="0 -10px 40px rgba(0,0,0,0.8)"
              backdropFilter="blur(30px)"
              py="2"
              maxH="300px"
              overflowY="auto"
            >
              <MobileModelList
                models={filteredModels}
                selectedModel={selectedModel}
                onSelect={(id) => {
                  setSelectedModel(id)
                  setOpen(false)
                }}
              />
            </Box>
          </>
        )}
      </Box>
    )
  }

  return (
    <Box
      ref={containerRef}
      w="full"
      borderBottom="1px solid"
      borderColor="rgba(99,102,241,0.2)"
      bg="rgba(10,10,15,0.95)"
      backdropFilter="blur(20px)"
      px={{ base: "4", md: "6" }}
      py="4"
      position="relative"
      zIndex={100}
    >
      <Flex
        maxW="800px"
        mx="auto"
        alignItems="center"
        gap="3"
        px="4"
        py="3"
        bg="linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))"
        border="1px solid"
        borderColor="rgba(99,102,241,0.3)"
        borderRadius="xl"
        cursor="pointer"
        _hover={{
          bg: "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.14))",
          borderColor: "rgba(99,102,241,0.5)",
          transform: "translateY(-1px)",
        }}
        onClick={() => setOpen(!open)}
        transition="all 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
        userSelect="none"
      >
        <Icon as={providerConfig.icon} boxSize="16px" color={providerConfig.color} flexShrink={0} />

        <Flex flex="1" alignItems="center" gap="2" minW="0">
          <Text
            fontSize="sm"
            fontWeight="600"
            color="gray.200"
            whiteSpace="nowrap"
            overflow="hidden"
            textOverflow="ellipsis"
          >
            {currentModel.name}
          </Text>
          <Badge
            size="sm"
            colorPalette={currentModel.type === "reasoning" ? "indigo" : "brand"}
            variant="subtle"
            fontSize="xs"
            fontWeight="600"
            flexShrink={0}
            textTransform="capitalize"
          >
            {currentModel.type}
          </Badge>
        </Flex>

        <Icon
          as={LuChevronDown}
          boxSize="16px"
          color="gray.400"
          transform={open ? "rotate(180deg)" : "rotate(0deg)"}
          transition="transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
          flexShrink={0}
        />
      </Flex>

      {open && (
        <>
          <Box
            position="fixed"
            inset={0}
            zIndex={40}
            onClick={() => setOpen(false)}
          />
          <Box
            position="absolute"
            top="100%"
            left={{ base: "4", sm: "6" }}
            right={{ base: "4", sm: "6" }}
            mt="3"
            zIndex={50}
            bg="rgba(19,19,31,0.99)"
            border="1px solid"
            borderColor="rgba(99,102,241,0.3)"
            borderRadius="xl"
            shadow="0 25px 50px rgba(0,0,0,0.8)"
            backdropFilter="blur(30px)"
            maxH="550px"
            overflowY="auto"
            py="3"
            onClick={(e) => e.stopPropagation()}
            css={{
              "&::-webkit-scrollbar": {
                width: "6px",
              },
              "&::-webkit-scrollbar-track": {
                bg: "rgba(99,102,241,0.05)",
              },
              "&::-webkit-scrollbar-thumb": {
                bg: "rgba(99,102,241,0.2)",
                borderRadius: "3px",
                "&:hover": {
                  bg: "rgba(99,102,241,0.3)",
                },
              },
            }}
          >
            {/* Search Input */}
            <Box px="4" pb="3" borderBottom="1px solid" borderColor="rgba(99,102,241,0.1)">
              <HStack gap="2" bg="rgba(10,10,15,0.8)" px="3" py="2" borderRadius="lg" border="1px solid" borderColor="rgba(99,102,241,0.2)">
                <Icon as={LuSearch} boxSize="14px" color="gray.600" flexShrink={0} />
                <Input
                  placeholder="Search models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  bg="transparent"
                  border="none"
                  outline="none"
                  fontSize="sm"
                  color="gray.300"
                  _focus={{ outline: "none" }}
                  _placeholder={{ color: "gray.600" }}
                />
              </HStack>
            </Box>

            {/* Model Groups by Provider */}
            {["Meta", "NVIDIA", "Google", "Microsoft", "Mistral", "DeepSeek"].map((provider) => {
              const providerModels = filteredModels.filter((m) => m.provider === provider)
              if (providerModels.length === 0) return null

              return (
                <Box key={provider}>
                  <Flex px="4" py="2.5" gap="2.5" alignItems="center" mt="2">
                    <Icon
                      as={PROVIDER_CONFIG[provider].icon}
                      boxSize="12px"
                      color="gray.600"
                      flexShrink={0}
                    />
                    <Text
                      fontSize="2xs"
                      color="gray.600"
                      fontWeight="700"
                      letterSpacing="0.08em"
                      textTransform="uppercase"
                    >
                      {provider}
                    </Text>
                  </Flex>

                  {providerModels.map((model) => (
                    <ModelOptionItem
                      key={model.id}
                      model={model}
                      selected={selectedModel === model.id}
                      onClick={() => {
                        setSelectedModel(model.id)
                        setOpen(false)
                      }}
                    />
                  ))}
                </Box>
              )
            })}

            {filteredModels.length === 0 && (
              <Box textAlign="center" py="8" color="gray.500">
                <Text fontSize="sm">No models found matching "{searchQuery}"</Text>
              </Box>
            )}
          </Box>
        </>
      )}
    </Box>
  )
}

function ModelOptionItem({
  model,
  selected,
  onClick,
}: {
  model: ModelConfig
  selected: boolean
  onClick: () => void
}) {
  const providerConfig = PROVIDER_CONFIG[model.provider]
  const typeBadgeConfig = TYPE_BADGE_COLORS[model.type] || TYPE_BADGE_COLORS.general

  return (
    <Flex
      px="4"
      py="3"
      alignItems="center"
      gap="3"
      cursor="pointer"
      bg={selected ? "rgba(99,102,241,0.15)" : "transparent"}
      _hover={{ bg: "rgba(99,102,241,0.1)" }}
      _active={{ bg: "rgba(99,102,241,0.15)" }}
      onClick={onClick}
      transition="all 0.15s"
      borderRadius="lg"
      mx="2"
    >
      {/* Selection indicator */}
      <Box
        w="2.5"
        h="2.5"
        borderRadius="full"
        bg={selected ? "brand.500" : "gray.700"}
        flexShrink={0}
        boxShadow={selected ? "0 0 12px rgba(99,102,241,0.6)" : "none"}
        transition="all 0.2s"
      />

      {/* Provider icon */}
      <Box
        w="6"
        h="6"
        borderRadius="md"
        bg={providerConfig.bgColor}
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
      >
        <Icon as={providerConfig.icon} boxSize="12px" color={providerConfig.color} />
      </Box>

      {/* Model info */}
      <VStack align="start" gap="0.5" flex="1" minW="0">
        <HStack gap="2">
          <Text
            fontSize="sm"
            fontWeight={selected ? "700" : "500"}
            color={selected ? "brand.300" : "gray.300"}
          >
            {model.name}
          </Text>
          {model.size && (
            <Text fontSize="2xs" color="gray.600">
              {model.size}
            </Text>
          )}
        </HStack>

        <Text fontSize="xs" color="gray.600" lineHeight="1.3" noOfLines={2}>
          {model.description}
        </Text>

        {/* Badges */}
        {(model.badges || [model.type]).length > 0 && (
          <HStack gap="1" mt="0.5" flexWrap="wrap">
            {(model.badges || [model.type]).map((badge) => (
              <Badge
                key={badge}
                size="xs"
                fontSize="2xs"
                fontWeight="600"
                textTransform="capitalize"
                bg={TYPE_BADGE_COLORS[badge]?.bg || "rgba(99,102,241,0.15)"}
                color={TYPE_BADGE_COLORS[badge]?.color || "indigo.300"}
              >
                {badge}
              </Badge>
            ))}
          </HStack>
        )}
      </VStack>

      {selected && (
        <Icon
          as={LuBrain}
          boxSize="14px"
          color="brand.400"
          flexShrink={0}
          animation="pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
        />
      )}
    </Flex>
  )
}

function MobileModelList({
  models,
  selectedModel,
  onSelect,
}: {
  models: ModelConfig[]
  selectedModel: string
  onSelect: (id: string) => void
}) {
  return (
    <VStack gap="0" align="stretch">
      {models.map((model) => (
        <Flex
          key={model.id}
          px="4"
          py="2.5"
          alignItems="center"
          gap="2.5"
          cursor="pointer"
          bg={selectedModel === model.id ? "rgba(99,102,241,0.15)" : "transparent"}
          _hover={{ bg: "rgba(99,102,241,0.1)" }}
          _active={{ bg: "rgba(99,102,241,0.15)" }}
          onClick={() => onSelect(model.id)}
          transition="all 0.15s"
        >
          <Box
            w="2"
            h="2"
            borderRadius="full"
            bg={selectedModel === model.id ? "brand.500" : "gray.700"}
            flexShrink={0}
          />
          <VStack align="start" gap="0" flex="1" minW="0">
            <Text fontSize="xs" fontWeight={selectedModel === model.id ? "700" : "500"} color={selectedModel === model.id ? "brand.300" : "gray.300"}>
              {model.name}
            </Text>
            <Text fontSize="2xs" color="gray.600" lineHeight="1.2">
              {model.description}
            </Text>
          </VStack>
        </Flex>
      ))}
    </VStack>
  )
}
