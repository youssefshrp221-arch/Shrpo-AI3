import { useState } from "react"
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Input,
  Button,
  Icon,
  Badge,
  Flex,
  Code,
  Link,
} from "@chakra-ui/react"
import { LuKey, LuShield, LuZap, LuBrain, LuEye, LuEyeOff, LuExternalLink, LuSparkle } from "react-icons/lu"
import { useAppStore } from "@/store/appStore"
import { toaster } from "@/components/ui/toaster"

export default function ApiKeyScreen() {
  const { setApiKey } = useAppStore()
  const [key, setKey] = useState("")
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!key.trim()) {
      toaster.create({ title: "API key required", type: "error" })
      return
    }
    setLoading(true)
    // Small delay for UX
    await new Promise((r) => setTimeout(r, 600))
    setApiKey(key.trim())
    toaster.create({ title: "Welcome to Shrpo AI!", type: "success" })
    setLoading(false)
  }

  const features = [
    { icon: LuBrain, label: "Multi-model AI", desc: "Llama, Mistral, Phi & more" },
    { icon: LuZap, label: "Real-time streaming", desc: "Instant responses" },
    { icon: LuShield, label: "Vision & Multimodal", desc: "Images, PDFs, audio" },
    { icon: LuSparkle, label: "Writing Studio", desc: "AI-powered novel writing" },
  ]

  return (
    <Box
      minH="100vh"
      bg="#0a0a0f"
      display="flex"
      alignItems="center"
      justifyContent="center"
      position="relative"
      overflow="hidden"
    >
      {/* Animated background grid */}
      <Box
        position="absolute"
        inset={0}
        opacity={0.04}
        style={{
          backgroundImage: `
            linear-gradient(rgba(99,102,241,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.5) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />
      {/* Glowing orbs */}
      <Box
        position="absolute"
        top="-20%"
        left="-10%"
        w="600px"
        h="600px"
        borderRadius="full"
        bg="radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)"
        pointerEvents="none"
      />
      <Box
        position="absolute"
        bottom="-20%"
        right="-10%"
        w="600px"
        h="600px"
        borderRadius="full"
        bg="radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)"
        pointerEvents="none"
      />

      <Box
        w="full"
        maxW="480px"
        mx="4"
        position="relative"
        zIndex={1}
      >
        {/* Logo / Brand */}
        <VStack gap="2" mb="10" align="center">
          <Box
            w="72px"
            h="72px"
            borderRadius="2xl"
            bg="linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%)"
            display="flex"
            alignItems="center"
            justifyContent="center"
            shadow="0 0 40px rgba(99,102,241,0.5)"
            mb="2"
          >
            <Icon as={LuBrain} boxSize="36px" color="white" />
          </Box>
          <Heading
            fontSize="3xl"
            fontWeight="800"
            letterSpacing="-0.02em"
            textAlign="center"
            style={{
              background: "linear-gradient(135deg, #e2e8f0 0%, #818cf8 50%, #06b6d4 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Shrpo AI
          </Heading>
          <Text color="gray.400" fontSize="sm" textAlign="center">
            Premium All-in-One AI Platform
          </Text>
          <HStack gap="2" flexWrap="wrap" justify="center">
            {["ChatGPT-style", "Claude-style", "Gemini-style", "NovelAI-style"].map((b) => (
              <Badge
                key={b}
                size="sm"
                variant="outline"
                borderColor="brand.800"
                color="brand.400"
                fontSize="2xs"
              >
                {b}
              </Badge>
            ))}
          </HStack>
        </VStack>

        {/* Main card */}
        <Box
          bg="rgba(15, 15, 26, 0.9)"
          borderRadius="2xl"
          border="1px solid"
          borderColor="rgba(99, 102, 241, 0.2)"
          p={{ base: "6", md: "8" }}
          backdropFilter="blur(20px)"
          shadow="0 25px 50px rgba(0,0,0,0.5)"
        >
          <VStack gap="6" align="stretch">
            <VStack gap="1" align="start">
              <Text fontWeight="600" fontSize="lg" color="white">
                Enter your NVIDIA API Key
              </Text>
              <Text fontSize="sm" color="gray.400">
                Your key is stored locally and never sent to our servers.
              </Text>
            </VStack>

            <Box position="relative">
              <Input
                type={show ? "text" : "password"}
                placeholder="nvapi-..."
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                pr="12"
                bg="rgba(10, 10, 15, 0.8)"
                border="1px solid"
                borderColor="rgba(99, 102, 241, 0.3)"
                color="white"
                fontSize="sm"
                h="12"
                borderRadius="xl"
                fontFamily="mono"
                _placeholder={{ color: "gray.600" }}
                _focus={{
                  borderColor: "brand.500",
                  shadow: "0 0 0 1px rgba(99,102,241,0.4)",
                  outline: "none",
                }}
              />
              <Box
                position="absolute"
                right="3"
                top="50%"
                transform="translateY(-50%)"
                cursor="pointer"
                color="gray.500"
                _hover={{ color: "gray.300" }}
                onClick={() => setShow(!show)}
                zIndex={1}
              >
                <Icon as={show ? LuEyeOff : LuEye} boxSize="18px" />
              </Box>
            </Box>

            <Button
              onClick={handleSubmit}
              loading={loading}
              loadingText="Connecting..."
              size="lg"
              h="12"
              borderRadius="xl"
              bg="linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
              color="white"
              fontWeight="600"
              _hover={{
                bg: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                shadow: "0 0 20px rgba(99,102,241,0.4)",
                transform: "translateY(-1px)",
              }}
              _active={{ transform: "translateY(0)" }}
              transition="all 0.2s"
              w="full"
            >
              <Icon as={LuKey} mr="2" />
              Launch Shrpo AI
            </Button>

            <Flex align="center" gap="2">
              <Box flex="1" h="px" bg="rgba(99,102,241,0.2)" />
              <Text fontSize="xs" color="gray.600">get your key</Text>
              <Box flex="1" h="px" bg="rgba(99,102,241,0.2)" />
            </Flex>

            <Link
              href="https://build.nvidia.com/explore/discover"
              target="_blank"
              display="flex"
              alignItems="center"
              gap="2"
              p="3"
              bg="rgba(99,102,241,0.08)"
              borderRadius="xl"
              border="1px solid"
              borderColor="rgba(99,102,241,0.15)"
              color="brand.400"
              fontSize="sm"
              fontWeight="500"
              _hover={{ bg: "rgba(99,102,241,0.15)", textDecoration: "none" }}
              transition="all 0.2s"
            >
              <Icon as={LuExternalLink} boxSize="14px" />
              <Text flex="1">Get free NVIDIA API key at build.nvidia.com</Text>
            </Link>
          </VStack>
        </Box>

        {/* Feature grid */}
        <Box
          display="grid"
          gridTemplateColumns="1fr 1fr"
          gap="3"
          mt="4"
        >
          {features.map((f) => (
            <Box
              key={f.label}
              bg="rgba(15, 15, 26, 0.6)"
              borderRadius="xl"
              border="1px solid"
              borderColor="rgba(99,102,241,0.12)"
              p="4"
              backdropFilter="blur(10px)"
            >
              <HStack gap="2" mb="1">
                <Icon as={f.icon} color="brand.400" boxSize="14px" />
                <Text fontSize="xs" fontWeight="600" color="gray.300">{f.label}</Text>
              </HStack>
              <Text fontSize="2xs" color="gray.500">{f.desc}</Text>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
