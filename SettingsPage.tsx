import { useState } from "react"
import {
  Box,
  VStack,
  HStack,
  Text,
  Icon,
  Heading,
  Input,
  Textarea,
  Button,
  Badge,
  Separator,
  SimpleGrid,
  Flex,
} from "@chakra-ui/react"
import {
  LuSave,
  LuCheck,
  LuBrain,
  LuThermometer,
  LuDatabase,
  LuVolume2,
  LuMic,
  LuPalette,
  LuType,
} from "react-icons/lu"
import { useAppStore } from "@/store/appStore"
import { toaster } from "@/components/ui/toaster"

export default function SettingsPage() {
  const { settings, updateSettings } = useAppStore()
  const [saved, setSaved] = useState(false)

  const handleSaveSettings = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    toaster.create({ title: "Settings saved", type: "success" })
  }

  const fontOptions = ["sm", "md", "lg"]
  const fontLabels: Record<string, string> = { sm: "Small", md: "Medium", lg: "Large" }

  return (
    <Box h="100%" bg="#0a0a0f" overflow="auto">
      <Box maxW="720px" mx="auto" px={{ base: "4", md: "6" }} py={{ base: "5", md: "8" }}>
        <VStack align="start" gap="1" mb={{ base: "5", md: "8" }}>
          <Heading fontSize={{ base: "xl", md: "2xl" }} fontWeight="800" color="white">Settings</Heading>
          <Text fontSize={{ base: "2xs", md: "sm" }} color="gray.500">Configure your Shrpo AI experience</Text>
        </VStack>

        <VStack gap={{ base: "3", md: "4" }} align="stretch">
          {/* AI Settings */}
          <SettingsCard
            icon={LuBrain}
            title="AI Behavior"
            description="Configure how the AI responds"
            accentColor="cyan"
          >
            <VStack gap="4" align="stretch">
              {/* Temperature */}
              <Box>
                <HStack justify="space-between" mb="2">
                  <HStack gap="2">
                    <Icon as={LuThermometer} boxSize="13px" color="orange.400" />
                    <Text fontSize="sm" fontWeight="500" color="gray.300">Temperature</Text>
                  </HStack>
                  <Badge colorPalette="orange" variant="subtle" size="sm">
                    {settings.temperature.toFixed(1)}
                  </Badge>
                </HStack>
                <Text fontSize="2xs" color="gray.600" mb="2">
                  Lower = more focused · Higher = more creative
                </Text>
                <Box
                  as="input"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.temperature}
                  onChange={(e: any) => updateSettings({ temperature: parseFloat(e.target.value) })}
                  w="full"
                  accentColor="#6366f1"
                  cursor="pointer"
                />
                <HStack justify="space-between" mt="1">
                  <Text fontSize="2xs" color="gray.700">Precise (0.0)</Text>
                  <Text fontSize="2xs" color="gray.700">Creative (1.0)</Text>
                </HStack>
              </Box>

              <Separator borderColor="rgba(99,102,241,0.1)" />

              {/* System Prompt */}
              <Box>
                <HStack gap="2" mb="2">
                  <Text fontSize="sm" fontWeight="500" color="gray.300">System Prompt</Text>
                  <Badge colorPalette="brand" variant="subtle" size="xs">Custom</Badge>
                </HStack>
                <Textarea
                  value={settings.systemPrompt}
                  onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
                  bg="rgba(10,10,15,0.8)"
                  border="1px solid"
                  borderColor="rgba(99,102,241,0.2)"
                  color="white"
                  fontSize="xs"
                  borderRadius="xl"
                  rows={4}
                  _focus={{ borderColor: "brand.500", outline: "none" }}
                  lineHeight="1.6"
                  fontFamily="mono"
                />
              </Box>

              {/* Memory toggle */}
              <HStack justify="space-between">
                <HStack gap="2">
                  <Icon as={LuDatabase} boxSize="13px" color="brand.400" />
                  <VStack align="start" gap="0">
                    <Text fontSize="sm" fontWeight="500" color="gray.300">Chat Memory</Text>
                    <Text fontSize="2xs" color="gray.600">Include conversation history in context</Text>
                  </VStack>
                </HStack>
                <Box
                  as="button"
                  w="36px"
                  h="20px"
                  borderRadius="full"
                  bg={settings.memoryEnabled ? "brand.600" : "rgba(99,102,241,0.15)"}
                  position="relative"
                  onClick={() => updateSettings({ memoryEnabled: !settings.memoryEnabled })}
                  transition="all 0.2s"
                  cursor="pointer"
                  border="1px solid"
                  borderColor={settings.memoryEnabled ? "brand.500" : "rgba(99,102,241,0.2)"}
                >
                  <Box
                    position="absolute"
                    top="2px"
                    left={settings.memoryEnabled ? "18px" : "2px"}
                    w="14px"
                    h="14px"
                    borderRadius="full"
                    bg="white"
                    transition="left 0.2s"
                    shadow="sm"
                  />
                </Box>
              </HStack>
            </VStack>
          </SettingsCard>

          {/* Display */}
          <SettingsCard
            icon={LuPalette}
            title="Display"
            description="Customize the interface appearance"
            accentColor="pink"
          >
            <VStack gap="4" align="stretch">
              <Box>
                <HStack gap="2" mb="3">
                  <Icon as={LuType} boxSize="13px" color="gray.400" />
                  <Text fontSize="sm" fontWeight="500" color="gray.300">Font Size</Text>
                </HStack>
                <HStack gap="2">
                  {fontOptions.map((s) => (
                    <Box
                      key={s}
                      as="button"
                      flex="1"
                      py="2"
                      borderRadius="xl"
                      fontSize="xs"
                      fontWeight="500"
                      color={settings.fontSize === s ? "brand.300" : "gray.500"}
                      bg={settings.fontSize === s ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.03)"}
                      border="1px solid"
                      borderColor={settings.fontSize === s ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.06)"}
                      onClick={() => updateSettings({ fontSize: s })}
                      transition="all 0.15s"
                      cursor="pointer"
                    >
                      {fontLabels[s]}
                    </Box>
                  ))}
                </HStack>
              </Box>
            </VStack>
          </SettingsCard>

          {/* Voice */}
          <SettingsCard
            icon={LuMic}
            title="Voice Features"
            description="Speech-to-text and text-to-speech settings"
            accentColor="green"
          >
            <VStack gap="3" align="stretch">
              <ToggleRow
                icon={LuMic}
                label="Speech to Text"
                description="Use microphone for voice input"
                value={settings.sttEnabled}
                onChange={(v) => updateSettings({ sttEnabled: v })}
              />
              <Separator borderColor="rgba(99,102,241,0.08)" />
              <ToggleRow
                icon={LuVolume2}
                label="Text to Speech"
                description="Read AI responses aloud"
                value={settings.ttsEnabled}
                onChange={(v) => updateSettings({ ttsEnabled: v })}
              />
            </VStack>
          </SettingsCard>

          <Button
            onClick={handleSaveSettings}
            bg={saved ? "rgba(16,185,129,0.2)" : "linear-gradient(135deg, #6366f1, #8b5cf6)"}
            color={saved ? "green.400" : "white"}
            borderRadius="xl"
            border={saved ? "1px solid" : "none"}
            borderColor={saved ? "rgba(16,185,129,0.3)" : "transparent"}
            _hover={{ shadow: saved ? "none" : "0 0 20px rgba(99,102,241,0.4)" }}
            transition="all 0.3s"
            h="11"
          >
            <Icon as={saved ? LuCheck : LuSave} mr="2" boxSize="14px" />
            {saved ? "Settings Saved!" : "Save Settings"}
          </Button>
        </VStack>
      </Box>
    </Box>
  )
}

function SettingsCard({ icon, title, description, accentColor, children }: any) {
  return (
    <Box
      bg="rgba(15,15,26,0.8)"
      border="1px solid"
      borderColor="rgba(99,102,241,0.12)"
      borderRadius="2xl"
      p={{ base: "4", md: "5" }}
      position="relative"
      overflow="hidden"
    >
      <Box
        position="absolute"
        top={0}
        left={0}
        w="3px"
        h="full"
        bg="linear-gradient(180deg, #6366f1, #8b5cf6)"
        borderRadius="2xl 0 0 2xl"
      />
      <HStack gap="3" mb="4" pl="1">
        <Box
          w={{ base: "32px", md: "36px" }}
          h={{ base: "32px", md: "36px" }}
          borderRadius="xl"
          bg="rgba(99,102,241,0.12)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          <Icon as={icon} color="brand.400" boxSize={{ base: "14px", md: "16px" }} />
        </Box>
        <VStack align="start" gap="0" minW="0">
          <Text fontWeight="700" fontSize={{ base: "xs", md: "sm" }} color="white">{title}</Text>
          <Text fontSize="2xs" color="gray.600">{description}</Text>
        </VStack>
      </HStack>
      {children}
    </Box>
  )
}

function ToggleRow({ icon, label, description, value, onChange }: any) {
  return (
    <HStack justify="space-between">
      <HStack gap="2">
        <Icon as={icon} boxSize="13px" color="gray.400" />
        <VStack align="start" gap="0">
          <Text fontSize="sm" fontWeight="500" color="gray.300">{label}</Text>
          <Text fontSize="2xs" color="gray.600">{description}</Text>
        </VStack>
      </HStack>
      <Box
        as="button"
        w="36px"
        h="20px"
        borderRadius="full"
        bg={value ? "brand.600" : "rgba(99,102,241,0.15)"}
        position="relative"
        onClick={() => onChange(!value)}
        transition="all 0.2s"
        cursor="pointer"
        border="1px solid"
        borderColor={value ? "brand.500" : "rgba(99,102,241,0.2)"}
      >
        <Box
          position="absolute"
          top="2px"
          left={value ? "18px" : "2px"}
          w="14px"
          h="14px"
          borderRadius="full"
          bg="white"
          transition="left 0.2s"
          shadow="sm"
        />
      </Box>
    </HStack>
  )
}
