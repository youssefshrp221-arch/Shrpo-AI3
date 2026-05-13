import { useState, useEffect } from "react"
import {
  Box,
  HStack,
  VStack,
  Text,
  Button,
  Flex,
  Badge,
  Icon,
  Separator,
  SimpleGrid,
  Heading,
  Stat,
} from "@chakra-ui/react"
import {
  LuShield,
  LuUsers,
  LuMessageSquare,
  LuBookOpen,
  LuRefreshCw,
  LuTerminal,
  LuChartLine,
  LuSparkles,
} from "react-icons/lu"
import { useAppStore } from "@/store/appStore"
import { supabase, getSessionId } from "@/lib/supabase"
import { toaster } from "@/components/ui/toaster"

interface StatsData {
  totalChats: number
  totalMessages: number
  totalProjects: number
  totalUsers: number
  uniqueModels: number
}

export default function AdminDashboard() {
  const { isAdmin, setActiveView } = useAppStore()
  const [stats, setStats] = useState<StatsData>({
    totalChats: 0,
    totalMessages: 0,
    totalProjects: 0,
    totalUsers: 0,
    uniqueModels: 0,
  })
  const [loading, setLoading] = useState(true)

  const loadStats = async () => {
    if (!supabase) return
    setLoading(true)
    try {
      const [chatsRes, msgsRes, projectsRes, modelsRes] = await Promise.all([
        supabase.from("chats").select("*", { count: "exact", head: false }),
        supabase.from("messages").select("*", { count: "exact", head: false }),
        supabase.from("writing_projects").select("*", { count: "exact", head: false }),
        supabase.from("chats").select("model"),
      ])

      const totalChats = chatsRes.data?.length ?? 0
      const totalMessages = msgsRes.data?.length ?? 0
      const totalProjects = projectsRes.data?.length ?? 0
      const uniqueModels = new Set(modelsRes.data?.map((c: any) => c.model)).size

      setStats({
        totalChats,
        totalMessages,
        totalProjects,
        totalUsers: totalChats > 0 ? Math.max(1, Math.floor(totalChats / 3)) : 0,
        uniqueModels,
      })
    } catch (err) {
      console.error("Failed to load stats", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) loadStats()
  }, [isAdmin])

  const statCards = [
    {
      label: "Chats",
      value: stats.totalChats,
      icon: LuMessageSquare,
      color: "#6366f1",
      bg: "rgba(99,102,241,0.1)",
    },
    {
      label: "Messages",
      value: stats.totalMessages,
      icon: LuSparkles,
      color: "#8b5cf6",
      bg: "rgba(139,92,246,0.1)",
    },
    {
      label: "Novels",
      value: stats.totalProjects,
      icon: LuBookOpen,
      color: "#ec4899",
      bg: "rgba(236,72,153,0.1)",
    },
    {
      label: "Models Used",
      value: stats.uniqueModels,
      icon: LuChartLine,
      color: "#10b981",
      bg: "rgba(16,185,129,0.1)",
    },
  ]

  if (!isAdmin) {
    return (
      <Box h="100%" display="flex" alignItems="center" justifyContent="center" flexDirection="column" gap="3">
        <Icon as={LuShield} boxSize="48px" color="gray.700" />
        <Text color="gray.500" fontSize="sm">Admin access required</Text>
        <Button size="sm" onClick={() => setActiveView("novel")}>
          Go to Novel Studio
        </Button>
      </Box>
    )
  }

  return (
    <Box h="100%" bg="#0a0a0f" display="flex" flexDirection="column" overflow="hidden">
      {/* Header */}
      <Box
        px={{ base: "3", md: "4" }}
        py="3"
        borderBottom="1px solid"
        borderColor="rgba(99,102,241,0.15)"
        bg="rgba(10,10,15,0.95)"
        flexShrink={0}
      >
        <HStack gap="3" alignItems="center">
          <Icon as={LuShield} boxSize="20px" color="green.400" />
          <Text fontSize="md" fontWeight="700" color="white">
            Admin Dashboard
          </Text>
          <Badge size="sm" colorPalette="green" variant="subtle" fontSize="2xs">
            joeshrp4@gmail.com
          </Badge>
          <HStack ml="auto" gap="2">
            <Button
              size="xs"
              onClick={loadStats}
              variant="ghost"
              color="gray.400"
              _hover={{ color: "white", bg: "rgba(99,102,241,0.1)" }}
              loading={loading}
            >
              <Icon as={LuRefreshCw} boxSize="12px" />
            </Button>
          </HStack>
        </HStack>
      </Box>

      {/* Stats Grid */}
      <Box flex="1" overflowY="auto" p={{ base: "3", md: "4" }}>
        <SimpleGrid columns={{ base: 2, md: 4 }} gap={{ base: "3", md: "4" }} mb="6">
          {statCards.map((card) => (
            <Box
              key={card.label}
              bg="rgba(15,15,26,0.8)"
              border="1px solid"
              borderColor="rgba(99,102,241,0.12)"
              borderRadius="xl"
              p={{ base: "3", md: "4" }}
              position="relative"
              overflow="hidden"
            >
              <Box
                position="absolute"
                top={0}
                left={0}
                w="full"
                h="2px"
                bg={card.color}
                opacity={0.6}
              />
              <HStack gap="3" mb="2">
                <Box
                  w="32px"
                  h="32px"
                  borderRadius="lg"
                  bg={card.bg}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon as={card.icon} boxSize="16px" color={card.color} />
                </Box>
                <Text fontSize="xs" color="gray.500" fontWeight="500">
                  {card.label}
                </Text>
              </HStack>
              <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="800" color="white">
                {loading ? "-" : card.value}
              </Text>
            </Box>
          ))}
        </SimpleGrid>

        {/* Quick Actions */}
        <Box
          bg="rgba(15,15,26,0.8)"
          border="1px solid"
          borderColor="rgba(99,102,241,0.12)"
          borderRadius="xl"
          p={{ base: "3", md: "4" }}
          mb="4"
        >
          <HStack gap="2" mb="4">
            <Icon as={LuTerminal} boxSize="14px" color="brand.400" />
            <Text fontSize="sm" fontWeight="700" color="white">
              Developer Tools
            </Text>
          </HStack>
          <HStack gap="2" flexWrap="wrap">
            <Button
              size="sm"
              bg="linear-gradient(135deg, #6366f1, #8b5cf6)"
              color="white"
              borderRadius="lg"
              onClick={() => setActiveView("dev")}
            >
              <Icon as={LuTerminal} boxSize="12px" mr="1.5" />
              Dev Studio
            </Button>
            <Button
              size="sm"
              variant="outline"
              borderColor="rgba(99,102,241,0.3)"
              color="gray.300"
              borderRadius="lg"
              onClick={() => {
                window.open("https://replit.com", "_blank")
              }}
            >
              Open Replit
            </Button>
          </HStack>
        </Box>

        {/* Info */}
        <Box
          bg="rgba(15,15,26,0.8)"
          border="1px solid"
          borderColor="rgba(99,102,241,0.12)"
          borderRadius="xl"
          p={{ base: "3", md: "4" }}
        >
          <HStack gap="2" mb="3">
            <Icon as={LuUsers} boxSize="14px" color="brand.400" />
            <Text fontSize="sm" fontWeight="700" color="white">
              Platform Info
            </Text>
          </HStack>
          <VStack gap="2" align="stretch">
            <HStack justify="space-between">
              <Text fontSize="xs" color="gray.500">Current Session ID</Text>
              <Text fontSize="xs" color="gray.400" fontFamily="mono">
                {getSessionId().slice(0, 12)}...
              </Text>
            </HStack>
            <Separator borderColor="rgba(99,102,241,0.08)" />
            <HStack justify="space-between">
              <Text fontSize="xs" color="gray.500">Admin Email</Text>
              <Text fontSize="xs" color="green.400" fontFamily="mono">
                joeshrp4@gmail.com
              </Text>
            </HStack>
            <Separator borderColor="rgba(99,102,241,0.08)" />
            <HStack justify="space-between">
              <Text fontSize="xs" color="gray.500">Coder Model</Text>
              <Text fontSize="xs" color="brand.300" fontFamily="mono">
                qwen/qwen3-coder-480b-a35b-instruct
              </Text>
            </HStack>
            <Separator borderColor="rgba(99,102,241,0.08)" />
            <HStack justify="space-between">
              <Text fontSize="xs" color="gray.500">Novel Model</Text>
              <Text fontSize="xs" color="brand.300" fontFamily="mono">
                moonshotai/kimi-k2.6
              </Text>
            </HStack>
            <Separator borderColor="rgba(99,102,241,0.08)" />
            <HStack justify="space-between">
              <Text fontSize="xs" color="gray.500">Summary Model</Text>
              <Text fontSize="xs" color="brand.300" fontFamily="mono">
                deepseek-ai/deepseek-v4-flash
              </Text>
            </HStack>
          </VStack>
        </Box>
      </Box>
    </Box>
  )
}
