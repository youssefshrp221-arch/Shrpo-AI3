import { useState, useEffect } from "react"
import {
  Box,
  VStack,
  HStack,
  Text,
  Icon,
  Input,
  IconButton,
  Badge,
  Separator,
  Flex,
  Button,
} from "@chakra-ui/react"
import {
  LuPlus,
  LuSearch,
  LuPin,
  LuTrash2,
  LuSettings,
  LuSquarePen,
  LuMessageSquare,
  LuChevronLeft,
  LuBrain,
  LuWrench,
  LuBookOpen,
  LuEllipsis,
  LuPinOff,
  LuStar,
  LuChevronDown,
  LuMenu,
  LuX,
} from "react-icons/lu"
import { useAppStore } from "@/store/appStore"
import { supabase, getSessionId, initializeSessionId } from "@/lib/supabase"
import { NVIDIA_MODELS } from "@/types"
import type { Chat } from "@/types"
import { toaster } from "@/components/ui/toaster"

interface SidebarProps {
  onNewChat: () => void
}

const navItems = [
  { icon: LuMessageSquare, label: "Chat", view: "chat" as const },
  { icon: LuBookOpen, label: "Writing Studio", view: "writing" as const },
  { icon: LuSquarePen, label: "Novel Studio", view: "novel" as const },
  { icon: LuWrench, label: "AI Tools", view: "tools" as const },
  { icon: LuSettings, label: "Settings", view: "settings" as const },
]

export default function Sidebar({ onNewChat }: SidebarProps) {
  const {
    activeChatId, setActiveChatId,
    activeView, setActiveView,
    sidebarOpen, setSidebarOpen,
    searchQuery, setSearchQuery,
    selectedModel, setSelectedModel,
    localChats, setLocalChats, updateLocalChat, removeLocalChat,
  } = useAppStore()

  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)

  const currentModel = NVIDIA_MODELS.find(m => m.id === selectedModel) || NVIDIA_MODELS[0]

  useEffect(() => {
    loadChats()
  }, [])

  const loadChats = async () => {
    const userId = getSessionId()
    const { data } = await supabase
      .from("chats")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
    if (data) setLocalChats(data as Chat[])
  }

  const filteredChats = localChats.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const pinnedChats = filteredChats.filter((c) => c.pinned)
  const unpinnedChats = filteredChats.filter((c) => !c.pinned)

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await supabase.from("chats").delete().eq("id", chatId)
    removeLocalChat(chatId)
    if (activeChatId === chatId) setActiveChatId(null)
    setMenuOpenId(null)
  }

  const handlePinChat = async (chat: Chat, e: React.MouseEvent) => {
    e.stopPropagation()
    await supabase.from("chats").update({ pinned: !chat.pinned }).eq("id", chat.id)
    updateLocalChat(chat.id, { pinned: !chat.pinned })
    setMenuOpenId(null)
  }

  // Mobile header with hamburger
  const mobileHeader = (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      h="16"
      bg="rgba(13,13,22,0.97)"
      borderBottom="1px solid"
      borderColor="rgba(99,102,241,0.15)"
      backdropFilter="blur(20px)"
      display={{ base: "flex", md: "none" }}
      alignItems="center"
      justifyContent="space-between"
      px="4"
      zIndex={35}
    >
      <HStack gap="2">
        <Box w="32px" h="32px" borderRadius="lg" bg="linear-gradient(135deg, #6366f1, #8b5cf6)" display="flex" alignItems="center" justifyContent="center">
          <Icon as={LuBrain} color="white" boxSize="16px" />
        </Box>
        <Text fontWeight="700" fontSize="sm" color="gray.300">
          Shrpo
        </Text>
      </HStack>
      <IconButton
        aria-label="Toggle menu"
        variant="ghost"
        size="sm"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        color="gray.400"
        _hover={{ color: "white" }}
      >
        <Icon as={sidebarOpen ? LuX : LuMenu} boxSize="20px" />
      </IconButton>
    </Box>
  )

  // Mobile overlay sidebar
  const mobileSidebar = sidebarOpen && (
    <>
      <Box
        position="fixed"
        inset={0}
        zIndex={34}
        bg="rgba(0,0,0,0.6)"
        onClick={() => setSidebarOpen(false)}
        hideFrom="md"
        top="64px"
      />
      <Box
        position="fixed"
        top="64px"
        left={0}
        bottom={0}
        w="full"
        maxW="280px"
        zIndex={36}
        bg="rgba(13,13,22,0.99)"
        backdropFilter="blur(20px)"
        overflowY="auto"
        hideFrom="md"
        display="flex"
        flexDirection="column"
      >
        <VStack align="stretch" spacing="0" flex="1" overflowY="auto" p="4">
          {/* New chat button */}
          <Button
            onClick={() => {
              onNewChat()
              setSidebarOpen(false)
            }}
            size="sm"
            w="full"
            bg="linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))"
            border="1px solid"
            borderColor="rgba(99,102,241,0.3)"
            color="brand.300"
            fontWeight="500"
            borderRadius="xl"
            mb="4"
          >
            <Icon as={LuPlus} mr="1.5" boxSize="14px" />
            New Chat
          </Button>

          {/* Search */}
          <Box position="relative" mb="4" w="full">
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              bg="rgba(99,102,241,0.08)"
              border="1px solid"
              borderColor="rgba(99,102,241,0.2)"
              color="white"
              fontSize="sm"
              borderRadius="lg"
              pl="10"
              _focus={{ borderColor: "brand.500" }}
            />
            <Icon as={LuSearch} position="absolute" left="3" top="50%" transform="translateY(-50%)" boxSize="14px" color="gray.600" />
          </Box>

          {/* Pinned chats */}
          {pinnedChats.length > 0 && (
            <Box w="full" mb="3">
              <Text fontSize="2xs" color="gray.600" fontWeight="600" letterSpacing="0.05em" textTransform="uppercase" mb="2">
                Pinned
              </Text>
              <VStack gap="1" align="stretch" w="full">
                {pinnedChats.map((c) => (
                  <MobileChatItem key={c.id} chat={c} isActive={activeChatId === c.id} onSelect={() => { setActiveChatId(c.id); setActiveView("chat"); setSidebarOpen(false) }} />
                ))}
              </VStack>
            </Box>
          )}

          {/* Recent chats */}
          {unpinnedChats.length > 0 && (
            <Box w="full">
              <Text fontSize="2xs" color="gray.600" fontWeight="600" letterSpacing="0.05em" textTransform="uppercase" mb="2">
                Recent
              </Text>
              <VStack gap="1" align="stretch" w="full">
                {unpinnedChats.map((c) => (
                  <MobileChatItem key={c.id} chat={c} isActive={activeChatId === c.id} onSelect={() => { setActiveChatId(c.id); setActiveView("chat"); setSidebarOpen(false) }} />
                ))}
              </VStack>
            </Box>
          )}

          {localChats.length === 0 && (
            <Box textAlign="center" py="8" w="full">
              <Icon as={LuMessageSquare} boxSize="24px" color="gray.700" mb="2" />
              <Text fontSize="xs" color="gray.600">No chats</Text>
            </Box>
          )}
        </VStack>

        {/* Navigation at bottom */}
        <Box borderTop="1px solid" borderColor="rgba(99,102,241,0.1)" p="4" w="full">
          <VStack gap="1" align="stretch">
            {navItems.map((item) => (
              <Box
                key={item.view}
                display="flex"
                alignItems="center"
                gap="3"
                px="3"
                py="2.5"
                borderRadius="lg"
                cursor="pointer"
                color={activeView === item.view ? "brand.300" : "gray.400"}
                bg={activeView === item.view ? "rgba(99,102,241,0.12)" : "transparent"}
                _hover={{ bg: "rgba(99,102,241,0.08)" }}
                onClick={() => {
                  setActiveView(item.view)
                  setSidebarOpen(false)
                }}
              >
                <Icon as={item.icon} boxSize="16px" />
                <Text fontSize="sm" fontWeight={activeView === item.view ? "600" : "500"}>
                  {item.label}
                </Text>
              </Box>
            ))}
          </VStack>
        </Box>
      </Box>
    </>
  )

  // Desktop sidebar (hidden on mobile)
  const desktopSidebar = (
    <Box
      w="280px"
      h="100vh"
      bg="rgba(13,13,22,0.97)"
      borderRight="1px solid"
      borderColor="rgba(99,102,241,0.15)"
      display={{ base: "none", md: "flex" }}
      flexDirection="column"
      backdropFilter="blur(20px)"
      position="relative"
      flexShrink={0}
    >
      {/* Header */}
      <Box px="4" pt="4" pb="3">
        <HStack justify="space-between" mb="4">
          <HStack gap="2">
            <Box w="32px" h="32px" borderRadius="lg" bg="linear-gradient(135deg, #6366f1, #8b5cf6)" display="flex" alignItems="center" justifyContent="center" shadow="0 0 15px rgba(99,102,241,0.35)">
              <Icon as={LuBrain} color="white" boxSize="16px" />
            </Box>
            <Text fontWeight="800" fontSize="md" letterSpacing="-0.02em" style={{ background: "linear-gradient(135deg, #e2e8f0, #818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Shrpo AI
            </Text>
          </HStack>
        </HStack>

        <Button
          onClick={onNewChat}
          size="sm"
          w="full"
          bg="linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))"
          border="1px solid"
          borderColor="rgba(99,102,241,0.3)"
          color="brand.300"
          fontWeight="500"
          borderRadius="xl"
        >
          <Icon as={LuPlus} mr="1.5" boxSize="14px" />
          New Chat
        </Button>
      </Box>

      {/* Navigation */}
      <Box px="3" mb="2">
        {navItems.map((item) => (
          <Box
            key={item.view}
            display="flex"
            alignItems="center"
            gap="2.5"
            px="3"
            py="2"
            borderRadius="xl"
            cursor="pointer"
            color={activeView === item.view ? "brand.300" : "gray.500"}
            bg={activeView === item.view ? "rgba(99,102,241,0.12)" : "transparent"}
            _hover={{ bg: "rgba(99,102,241,0.1)" }}
            onClick={() => setActiveView(item.view)}
            transition="all 0.15s"
            mb="0.5"
          >
            <Icon as={item.icon} boxSize="15px" />
            <Text fontSize="sm" fontWeight={activeView === item.view ? "600" : "400"}>
              {item.label}
            </Text>
            {item.view === "writing" && (
              <Badge ml="auto" size="sm" colorPalette="brand" variant="subtle" fontSize="2xs">
                Studio
              </Badge>
            )}
          </Box>
        ))}
      </Box>

      <Separator borderColor="rgba(99,102,241,0.1)" mx="3" />

      {/* Model Selector */}
      <Box px="3" py="3" position="relative">
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          gap="2"
          px="3"
          py="2"
          bg="rgba(99,102,241,0.08)"
          border="1px solid"
          borderColor="rgba(99,102,241,0.2)"
          borderRadius="lg"
          cursor="pointer"
          _hover={{ bg: "rgba(99,102,241,0.15)" }}
          onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
          transition="all 0.2s"
        >
          <VStack align="start" gap="0" flex="1">
            <Text fontSize="2xs" color="gray.600" fontWeight="600" letterSpacing="0.05em" textTransform="uppercase">
              Model
            </Text>
            <Text fontSize="xs" color="gray.300" fontWeight="500" noOfLines={1}>
              {currentModel.name}
            </Text>
          </VStack>
          <Icon as={LuChevronDown} boxSize="14px" color="gray.500" transform={modelDropdownOpen ? "rotate(180deg)" : "none"} transition="transform 0.2s" />
        </Box>

        {modelDropdownOpen && (
          <>
            <Box position="fixed" inset={0} zIndex={40} onClick={() => setModelDropdownOpen(false)} />
            <Box position="absolute" top="100%" left={0} right={0} mt="2" zIndex={50} bg="rgba(19,19,31,0.98)" border="1px solid" borderColor="rgba(99,102,241,0.2)" borderRadius="lg" shadow="0 10px 30px rgba(0,0,0,0.5)" backdropFilter="blur(20px)" maxH="280px" overflowY="auto" py="1">
              {NVIDIA_MODELS.map((model) => (
                <Box key={model.id} px="3" py="2.5" cursor="pointer" bg={selectedModel === model.id ? "rgba(99,102,241,0.12)" : "transparent"} _hover={{ bg: "rgba(99,102,241,0.08)" }} onClick={() => { setSelectedModel(model.id); setModelDropdownOpen(false) }} transition="all 0.15s" display="flex" alignItems="center" gap="2">
                  <Box w="2" h="2" borderRadius="full" bg={selectedModel === model.id ? "brand.500" : "gray.700"} flexShrink={0} />
                  <VStack align="start" gap="0" flex="1">
                    <Text fontSize="xs" fontWeight={selectedModel === model.id ? "600" : "400"} color={selectedModel === model.id ? "brand.300" : "gray.300"}>
                      {model.name}
                    </Text>
                    <Text fontSize="2xs" color="gray.600">{model.description}</Text>
                  </VStack>
                </Box>
              ))}
            </Box>
          </>
        )}
      </Box>

      {/* Search */}
      <Box px="3" py="3">
        <Box position="relative">
          <Icon as={LuSearch} position="absolute" left="3" top="50%" transform="translateY(-50%)" color="gray.600" boxSize="13px" zIndex={1} />
          <Input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            pl="8"
            h="8"
            bg="rgba(10,10,15,0.8)"
            border="1px solid"
            borderColor="rgba(99,102,241,0.15)"
            color="gray.300"
            fontSize="xs"
            borderRadius="lg"
            _placeholder={{ color: "gray.700" }}
            _focus={{ borderColor: "rgba(99,102,241,0.4)" }}
          />
        </Box>
      </Box>

      {/* Chat list */}
      <Box flex="1" overflowY="auto" px="2">
        {pinnedChats.length > 0 && (
          <Box mb="2">
            <HStack px="2" mb="1.5">
              <Icon as={LuPin} boxSize="10px" color="gray.600" />
              <Text fontSize="2xs" color="gray.600" fontWeight="600" letterSpacing="0.08em" textTransform="uppercase">
                Pinned
              </Text>
            </HStack>
            {pinnedChats.map((chat) => (
              <DesktopChatItem
                key={chat.id}
                chat={chat}
                isActive={activeChatId === chat.id}
                isHovered={hoveredId === chat.id}
                menuOpen={menuOpenId === chat.id}
                onSelect={() => { setActiveChatId(chat.id); setActiveView("chat") }}
                onHover={setHoveredId}
                onMenuToggle={setMenuOpenId}
                onDelete={handleDeleteChat}
                onPin={handlePinChat}
              />
            ))}
          </Box>
        )}

        {unpinnedChats.length > 0 && (
          <Box>
            <HStack px="2" mb="1.5">
              <Text fontSize="2xs" color="gray.600" fontWeight="600" letterSpacing="0.08em" textTransform="uppercase">
                Recent
              </Text>
            </HStack>
            {unpinnedChats.map((chat) => (
              <DesktopChatItem
                key={chat.id}
                chat={chat}
                isActive={activeChatId === chat.id}
                isHovered={hoveredId === chat.id}
                menuOpen={menuOpenId === chat.id}
                onSelect={() => { setActiveChatId(chat.id); setActiveView("chat") }}
                onHover={setHoveredId}
                onMenuToggle={setMenuOpenId}
                onDelete={handleDeleteChat}
                onPin={handlePinChat}
              />
            ))}
          </Box>
        )}

        {localChats.length === 0 && (
          <Box px="3" py="6" textAlign="center">
            <Icon as={LuMessageSquare} boxSize="24px" color="gray.700" mb="2" />
            <Text fontSize="xs" color="gray.600">No chats yet</Text>
          </Box>
        )}
      </Box>
    </Box>
  )

  return (
    <>
      {mobileHeader}
      {mobileSidebar}
      {desktopSidebar}
    </>
  )
}

function MobileChatItem({ chat, isActive, onSelect }: { chat: Chat; isActive: boolean; onSelect: () => void }) {
  return (
    <Box
      px="3"
      py="2"
      borderRadius="lg"
      bg={isActive ? "rgba(99,102,241,0.15)" : "transparent"}
      cursor="pointer"
      _active={{ bg: "rgba(99,102,241,0.2)" }}
      onClick={onSelect}
    >
      <Text fontSize="sm" color={isActive ? "gray.200" : "gray.400"} noOfLines={1} fontWeight={isActive ? "500" : "400"}>
        {chat.title}
      </Text>
    </Box>
  )
}

interface DesktopChatItemProps {
  chat: Chat
  isActive: boolean
  isHovered: boolean
  menuOpen: boolean
  onSelect: () => void
  onHover: (id: string | null) => void
  onMenuToggle: (id: string | null) => void
  onDelete: (id: string, e: React.MouseEvent) => void
  onPin: (chat: Chat, e: React.MouseEvent) => void
}

function DesktopChatItem({ chat, isActive, isHovered, menuOpen, onSelect, onHover, onMenuToggle, onDelete, onPin }: DesktopChatItemProps) {
  return (
    <Box
      position="relative"
      mb="0.5"
      onMouseEnter={() => onHover(chat.id)}
      onMouseLeave={() => { onHover(null); if (menuOpen) onMenuToggle(null) }}
    >
      <Box
        display="flex"
        alignItems="center"
        gap="2"
        px="3"
        py="2"
        borderRadius="xl"
        cursor="pointer"
        bg={isActive ? "rgba(99,102,241,0.15)" : "transparent"}
        borderLeft={isActive ? "2px solid" : "2px solid transparent"}
        borderColor={isActive ? "brand.500" : "transparent"}
        _hover={{ bg: "rgba(99,102,241,0.08)" }}
        onClick={onSelect}
        transition="all 0.15s"
      >
        <Icon as={LuMessageSquare} boxSize="13px" color={isActive ? "brand.400" : "gray.600"} flexShrink={0} />
        <Text fontSize="xs" color={isActive ? "gray.200" : "gray.400"} noOfLines={1} flex="1" fontWeight={isActive ? "500" : "400"} maxW="140px">
          {chat.title}
        </Text>
        {chat.pinned && <Icon as={LuPin} boxSize="10px" color="brand.600" flexShrink={0} />}
        {(isHovered || isActive) && (
          <IconButton
            aria-label="Options"
            variant="ghost"
            size="xs"
            onClick={(e) => { e.stopPropagation(); onMenuToggle(menuOpen ? null : chat.id) }}
            color="gray.600"
            _hover={{ color: "gray.400" }}
          >
            <Icon as={LuEllipsis} boxSize="14px" />
          </IconButton>
        )}
      </Box>

      {menuOpen && (
        <Box position="absolute" top="100%" right="0" mt="1" bg="rgba(19,19,31,0.98)" border="1px solid" borderColor="rgba(99,102,241,0.2)" borderRadius="lg" shadow="0 10px 30px rgba(0,0,0,0.5)" zIndex={50} minW="120px">
          <Box px="3" py="1.5" cursor="pointer" _hover={{ bg: "rgba(99,102,241,0.1)" }} onClick={(e) => onPin(chat, e)} display="flex" alignItems="center" gap="2">
            <Icon as={chat.pinned ? LuPinOff : LuPin} boxSize="14px" />
            <Text fontSize="xs">{chat.pinned ? "Unpin" : "Pin"}</Text>
          </Box>
          <Box px="3" py="1.5" cursor="pointer" _hover={{ bg: "rgba(239,68,68,0.1)" }} onClick={(e) => onDelete(chat.id, e)} display="flex" alignItems="center" gap="2" color="red.400">
            <Icon as={LuTrash2} boxSize="14px" />
            <Text fontSize="xs">Delete</Text>
          </Box>
        </Box>
      )}
    </Box>
  )
}
