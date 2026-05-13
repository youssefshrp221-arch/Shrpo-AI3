import { useState, useEffect, useRef } from "react"
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
  Separator,
} from "@chakra-ui/react"
import {
  LuPlus,
  LuTrash2,
  LuSave,
  LuDownload,
  LuBookOpen,
  LuUsers,
  LuGlobe,
  LuFileText,
  LuStar,
  LuSquarePen,
  LuRefreshCw,
  LuExpand,
  LuShrink,
  LuChevronRight,
  LuArrowLeft,
  LuList,
  LuMessageSquare,
  LuZap,
  LuBrain,
  LuEye,
  LuCpu,
  LuChevronDown,
  LuX,
} from "react-icons/lu"
import { useAppStore } from "@/store/appStore"
import { supabase, getSessionId, initializeSessionId } from "@/lib/supabase"
import { chatOnce } from "@/lib/nvidia"
import { streamChatWithFallback } from "@/lib/modelOrchestrator"
import { SHRPO_NARRATIVE_PROMPT } from "@/types"
import { toaster } from "@/components/ui/toaster"
import ModelSelector from "@/components/ModelSelector/ModelSelector"
import type { WritingProject, Chapter, Character, WorldEntry } from "@/types"
import { v4 as uuidv4 } from "uuid"

type Panel = "projects" | "editor" | "characters" | "world"

export default function WritingStudio() {
  const { selectedModel, settings, activeWritingProjectId, setActiveWritingProjectId, apiKey } = useAppStore()

  const [projects, setProjects] = useState<WritingProject[]>([])
  const [activeProject, setActiveProject] = useState<WritingProject | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [worldEntries, setWorldEntries] = useState<WorldEntry[]>([])
  const [panel, setPanel] = useState<Panel>("projects")
  const [fullscreen, setFullscreen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const [autoSaveTimer, setAutoSaveTimer] = useState<any>(null)

  const activeChapter = chapters.find((c) => c.id === activeChapterId)

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (activeWritingProjectId) {
      const p = projects.find((p) => p.id === activeWritingProjectId)
      if (p) openProject(p)
    }
  }, [activeWritingProjectId, projects])

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
    setActiveWritingProjectId(project.id)
    setPanel("editor")
    const { data: chaps } = await supabase.from("chapters").select("*").eq("project_id", project.id).order("chapter_order")
    const { data: chars } = await supabase.from("characters").select("*").eq("project_id", project.id)
    const { data: world } = await supabase.from("worldbuilding").select("*").eq("project_id", project.id)
    if (chaps) {
      setChapters(chaps as Chapter[])
      if (chaps.length > 0) setActiveChapterId(chaps[0].id)
    }
    if (chars) setCharacters(chars as Character[])
    if (world) setWorldEntries(world as WorldEntry[])
  }

  const createProject = async () => {
    const userId = getSessionId()
    const project: WritingProject = {
      id: uuidv4(),
      title: "Untitled Novel",
      genre: "Fantasy",
      summary: "",
      word_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    await supabase.from("writing_projects").insert({ ...project, user_id: userId })
    // Create first chapter
    const chapter: Chapter = {
      id: uuidv4(),
      project_id: project.id,
      title: "Chapter 1",
      content: "",
      chapter_order: 0,
      summary: "",
      word_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    await supabase.from("chapters").insert({ ...chapter, user_id: userId })
    setProjects((prev) => [project, ...prev])
    setActiveProject(project)
    setChapters([chapter])
    setActiveChapterId(chapter.id)
    setPanel("editor")
  }

  const deleteProject = async (id: string) => {
    await supabase.from("writing_projects").delete().eq("id", id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
    if (activeProject?.id === id) {
      setActiveProject(null)
      setPanel("projects")
    }
  }

  const addChapter = async () => {
    if (!activeProject) return
    const chapter: Chapter = {
      id: uuidv4(),
      project_id: activeProject.id,
      title: `Chapter ${chapters.length + 1}`,
      content: "",
      chapter_order: chapters.length,
      summary: "",
      word_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    await supabase.from("chapters").insert(chapter)
    setChapters((prev) => [...prev, chapter])
    setActiveChapterId(chapter.id)
  }

  const saveChapter = async (content: string) => {
    if (!activeChapterId) return
    const wc = content.trim().split(/\s+/).filter(Boolean).length
    await supabase.from("chapters").update({ content, word_count: wc, updated_at: new Date().toISOString() }).eq("id", activeChapterId)
    setChapters((prev) => prev.map((c) => c.id === activeChapterId ? { ...c, content, word_count: wc } : c))
    setWordCount(wc)
  }

  const handleContentChange = (content: string) => {
    setChapters((prev) => prev.map((c) => c.id === activeChapterId ? { ...c, content } : c))
    setWordCount(content.trim().split(/\s+/).filter(Boolean).length)
    if (autoSaveTimer) clearTimeout(autoSaveTimer)
    setAutoSaveTimer(setTimeout(() => saveChapter(content), 2000))
  }

  const aiAction = async (action: string) => {
    if (!activeChapter) return
    setAiLoading(true)
    const prompt = buildAiPrompt(action, activeChapter.content, characters, worldEntries)
    try {
      const result = await streamChatWithFallback(
        [
          { role: "system", content: SHRPO_NARRATIVE_PROMPT },
          { role: "user", content: prompt },
        ],
        selectedModel,
        {
          onChunk: () => {},
          signal: new AbortController().signal,
          temperature: settings.temperature,
          apiKey: apiKey!,
        }
      )
      if (action === "continue") {
        handleContentChange(activeChapter.content + "\n\n" + result.fullContent)
      } else {
        handleContentChange(result.fullContent)
      }
      if (result.fallbackCount > 0) {
        const model = result.modelUsed.split("/").pop() || result.modelUsed
        toaster.create({ title: `Used ${model}`, description: "Primary model unavailable, used fallback", type: "info" })
      } else {
        toaster.create({ title: "AI writing applied", type: "success" })
      }
    } catch (err: any) {
      toaster.create({ title: "AI error", description: err.message, type: "error" })
    } finally {
      setAiLoading(false)
    }
  }

  const exportChapter = () => {
    if (!activeChapter) return
    const blob = new Blob([activeChapter.content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${activeChapter.title}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const [showChapters, setShowChapters] = useState(false)

  if (panel === "projects") {
    return <ProjectsPanel projects={projects} onCreate={createProject} onOpen={openProject} onDelete={deleteProject} />
  }

  return (
    <Box h="100%" display="flex" flexDirection="column" bg="#0a0a0f" position={fullscreen ? "fixed" : "relative"} inset={fullscreen ? "0" : "auto"} zIndex={fullscreen ? "max" : "auto"}>
      {/* Model Selector - desktop */}
      <Box hideBelow="md">
        <ModelSelector mobile={false} />
      </Box>

      {/* Model Selector - mobile */}
      <Box hideFrom="md" flexShrink={0}>
        <ModelSelector mobile={true} />
      </Box>

      {/* Studio Header */}
      <Box
        px={{ base: "3", md: "4" }}
        py={{ base: "2", md: "2.5" }}
        borderBottom="1px solid"
        borderColor="rgba(99,102,241,0.12)"
        bg="rgba(10,10,18,0.95)"
        backdropFilter="blur(20px)"
        flexShrink={0}
      >
        <HStack justify="space-between" gap={{ base: "1", md: "3" }}>
          <HStack gap={{ base: "1.5", md: "3" }} minW="0">
            <IconButton
              aria-label="Back"
              variant="ghost"
              size="sm"
              onClick={() => setPanel("projects")}
              color="gray.500"
              _hover={{ color: "white", bg: "rgba(99,102,241,0.1)" }}
              borderRadius="lg"
              flexShrink={0}
            >
              <Icon as={LuArrowLeft} />
            </IconButton>
            <VStack align="start" gap="0" minW="0">
              <Text fontWeight="700" fontSize={{ base: "xs", md: "sm" }} color="white" isTruncated>{activeProject?.title}</Text>
              <Text fontSize="2xs" color="gray.600" hideBelow="sm">{activeProject?.genre} · {wordCount} words</Text>
            </VStack>
          </HStack>
          <HStack gap={{ base: "0.5", md: "1" }} flexShrink={0}>
            {/* Mobile: chapter toggle in header */}
            <Box hideFrom="md">
              <IconButton
                aria-label="Chapters"
                variant="ghost"
                size="sm"
                onClick={() => setShowChapters(!showChapters)}
                color={showChapters ? "brand.300" : "gray.500"}
                _hover={{ color: "brand.300", bg: "rgba(99,102,241,0.1)" }}
                borderRadius="lg"
              >
                <Icon as={LuList} boxSize="15px" />
              </IconButton>
            </Box>
            {[
              { icon: LuSquarePen, label: "Editor", value: "editor" },
              { icon: LuUsers, label: "Characters", value: "characters" },
              { icon: LuGlobe, label: "World", value: "world" },
            ].map((item) => (
              <Box
                key={item.value}
                as="button"
                display="flex"
                alignItems="center"
                gap={{ base: "1", md: "1.5" }}
                px={{ base: "1.5", md: "2.5" }}
                py="1.5"
                borderRadius="lg"
                fontSize="xs"
                color={panel === item.value ? "brand.300" : "gray.500"}
                bg={panel === item.value ? "rgba(99,102,241,0.15)" : "transparent"}
                _hover={{ bg: "rgba(99,102,241,0.1)", color: "gray.300" }}
                onClick={() => { setPanel(item.value as Panel); setShowChapters(false) }}
                transition="all 0.15s"
              >
                <Icon as={item.icon} boxSize={{ base: "14px", md: "13px" }} />
                <Box as="span" hideBelow="md">{item.label}</Box>
              </Box>
            ))}
            <IconButton
              aria-label="Save"
              variant="ghost"
              size="sm"
              onClick={() => activeChapter && saveChapter(activeChapter.content)}
              color="gray.500"
              _hover={{ color: "green.400", bg: "rgba(16,185,129,0.1)" }}
              borderRadius="lg"
              hideBelow="sm"
            >
              <Icon as={LuSave} />
            </IconButton>
            <IconButton
              aria-label="Export"
              variant="ghost"
              size="sm"
              onClick={exportChapter}
              color="gray.500"
              _hover={{ color: "brand.400", bg: "rgba(99,102,241,0.1)" }}
              borderRadius="lg"
              hideBelow="sm"
            >
              <Icon as={LuDownload} />
            </IconButton>
            <IconButton
              aria-label="Fullscreen"
              variant="ghost"
              size="sm"
              onClick={() => setFullscreen(!fullscreen)}
              color="gray.500"
              _hover={{ color: "white", bg: "rgba(99,102,241,0.1)" }}
              borderRadius="lg"
              hideBelow="md"
            >
              <Icon as={fullscreen ? LuShrink : LuExpand} />
            </IconButton>
          </HStack>
        </HStack>
        {/* Mobile word count bar */}
        <Box hideFrom="sm" mt="1">
          <Text fontSize="2xs" color="gray.600">{wordCount} words · {activeProject?.genre}</Text>
        </Box>
      </Box>

      {/* Mobile chapter drawer */}
      {showChapters && (
        <Box
          hideFrom="md"
          position="absolute"
          top="0"
          left="0"
          bottom="0"
          w="240px"
          bg="rgba(10,10,18,0.98)"
          borderRight="1px solid"
          borderColor="rgba(99,102,241,0.15)"
          zIndex={200}
          p="3"
          overflow="auto"
          shadow="2xl"
        >
          <HStack justify="space-between" mb="3">
            <Text fontSize="2xs" color="gray.600" fontWeight="600" letterSpacing="0.08em" textTransform="uppercase">Chapters</Text>
            <IconButton
              aria-label="Close chapters"
              variant="ghost"
              size="2xs"
              onClick={() => setShowChapters(false)}
              color="gray.500"
              _hover={{ color: "white" }}
              borderRadius="md"
            >
              <Icon as={LuX} boxSize="12px" />
            </IconButton>
          </HStack>
          <IconButton
            aria-label="Add chapter"
            variant="ghost"
            size="2xs"
            onClick={addChapter}
            color="gray.600"
            _hover={{ color: "brand.400", bg: "rgba(99,102,241,0.1)" }}
            borderRadius="md"
            mb="2"
            w="full"
          >
            <Icon as={LuPlus} boxSize="12px" mr="1" />
            <Text fontSize="2xs">Add Chapter</Text>
          </IconButton>
          {chapters.map((c: Chapter) => (
            <Box
              key={c.id}
              px="2.5"
              py="2"
              borderRadius="lg"
              cursor="pointer"
              bg={activeChapter?.id === c.id ? "rgba(99,102,241,0.15)" : "transparent"}
              borderLeft={activeChapter?.id === c.id ? "2px solid" : "2px solid transparent"}
              borderColor={activeChapter?.id === c.id ? "brand.500" : "transparent"}
              _hover={{ bg: "rgba(99,102,241,0.08)" }}
              onClick={() => { setActiveChapterId(c.id); setShowChapters(false) }}
              transition="all 0.15s"
              mb="1"
            >
              <Text fontSize="xs" color={activeChapter?.id === c.id ? "gray.200" : "gray.500"} fontWeight={activeChapter?.id === c.id ? "500" : "400"} noOfLines={1}>
                {c.title}
              </Text>
              <Text fontSize="2xs" color="gray.700">{c.word_count} words</Text>
            </Box>
          ))}
        </Box>
      )}
      {showChapters && (
        <Box
          hideFrom="md"
          position="fixed"
          inset={0}
          bg="rgba(0,0,0,0.5)"
          zIndex={199}
          onClick={() => setShowChapters(false)}
        />
      )}

      {/* Body */}
      <Box flex="1" display="flex" overflow="hidden" position="relative">
        {panel === "editor" && (
          <EditorPanel
            chapters={chapters}
            activeChapter={activeChapter || null}
            onAddChapter={addChapter}
            onSelectChapter={setActiveChapterId}
            onContentChange={handleContentChange}
            onAiAction={aiAction}
            aiLoading={aiLoading}
          />
        )}
        {panel === "characters" && (
          <CharactersPanel
            characters={characters}
            projectId={activeProject?.id || ""}
            onUpdate={setCharacters}
          />
        )}
        {panel === "world" && (
          <WorldPanel
            entries={worldEntries}
            projectId={activeProject?.id || ""}
            onUpdate={setWorldEntries}
          />
        )}
      </Box>
    </Box>
  )
}

function buildAiPrompt(action: string, content: string, characters: Character[], world: WorldEntry[]) {
  const context = [
    characters.length > 0 ? `Characters: ${characters.map(c => c.name).join(", ")}` : "",
    world.length > 0 ? `World: ${world.map(w => w.title).join(", ")}` : "",
  ].filter(Boolean).join("\n")

  const prompts: Record<string, string> = {
    continue: `Continue this story naturally (write 2-4 paragraphs):\n\n${content.slice(-1000)}\n\n${context}`,
    rewrite: `Rewrite this passage with better prose and flow:\n\n${content}\n\n${context}`,
    improve: `Improve the literary quality of this text:\n\n${content}`,
    dialogue: `Improve the dialogue in this passage to sound more natural:\n\n${content}`,
    expand: `Expand this passage with more detail and depth:\n\n${content}`,
    shorten: `Condense this passage while keeping the key moments:\n\n${content}`,
    twist: `Generate 3 unexpected plot twist ideas for this story so far:\n\n${content.slice(-500)}`,
  }
  return prompts[action] || content
}

function ProjectsPanel({ projects, onCreate, onOpen, onDelete }: any) {
  return (
    <Box h="100%" bg="#0a0a0f" overflow="auto">
      <Box maxW="900px" mx="auto" px={{ base: "4", md: "6" }} py={{ base: "5", md: "8" }}>
        <HStack justify="space-between" mb={{ base: "5", md: "8" }}>
          <VStack align="start" gap="1">
            <Heading fontSize={{ base: "xl", md: "2xl" }} fontWeight="800" color="white">Writing Studio</Heading>
            <Text fontSize={{ base: "2xs", md: "sm" }} color="gray.500">AI-powered novel writing workspace</Text>
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
            <Box as="span" hideBelow="sm">New Project</Box>
            <Box as="span" hideFrom="sm">New</Box>
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
            <Icon as={LuBookOpen} boxSize={{ base: "36px", md: "48px" }} color="gray.700" mb="4" />
            <Text color="gray.500" fontWeight="500">No projects yet</Text>
            <Text color="gray.600" fontSize="sm" mb="6">Create your first novel project</Text>
            <Button onClick={onCreate} size="sm" colorPalette="brand" variant="outline" borderRadius="xl">
              <Icon as={LuPlus} mr="1.5" />
              Create Project
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
                overflow="hidden"
              >
                <Box
                  position="absolute"
                  top={0}
                  left={0}
                  right={0}
                  h="3px"
                  bg="linear-gradient(90deg, #6366f1, #8b5cf6)"
                />
                <HStack justify="space-between" mb="3">
                  <Box
                    w="36px"
                    h="36px"
                    borderRadius="xl"
                    bg="rgba(99,102,241,0.15)"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Icon as={LuBookOpen} color="brand.400" boxSize="16px" />
                  </Box>
                  <IconButton
                    aria-label="Delete"
                    variant="ghost"
                    size="xs"
                    onClick={(e) => { e.stopPropagation(); onDelete(p.id) }}
                    color="gray.700"
                    _hover={{ color: "red.400", bg: "rgba(239,68,68,0.1)" }}
                    borderRadius="lg"
                  >
                    <Icon as={LuTrash2} boxSize="12px" />
                  </IconButton>
                </HStack>
                <Text fontWeight="700" fontSize="sm" color="white" mb="1">{p.title}</Text>
                <Badge size="xs" colorPalette="brand" variant="subtle" mb="2">{p.genre || "Fiction"}</Badge>
                <Text fontSize="xs" color="gray.600" noOfLines={2}>{p.summary || "No summary yet..."}</Text>
                <HStack mt="3" gap="3">
                  <Text fontSize="2xs" color="gray.700">{p.word_count} words</Text>
                  <Text fontSize="2xs" color="gray.700">{new Date(p.updated_at).toLocaleDateString()}</Text>
                </HStack>
              </Box>
            ))}
          </SimpleGrid>
        )}
      </Box>
    </Box>
  )
}

function EditorPanel({ chapters, activeChapter, onAddChapter, onSelectChapter, onContentChange, onAiAction, aiLoading }: any) {
  const aiTools = [
    { icon: LuZap, label: "Continue", action: "continue", color: "green" },
    { icon: LuRefreshCw, label: "Rewrite", action: "rewrite", color: "blue" },
    { icon: LuStar, label: "Improve", action: "improve", color: "brand" },
    { icon: LuMessageSquare, label: "Dialogue", action: "dialogue", color: "cyan" },
    { icon: LuExpand, label: "Expand", action: "expand", color: "orange" },
    { icon: LuShrink, label: "Shorten", action: "shorten", color: "pink" },
    { icon: LuList, label: "Plot Twists", action: "twist", color: "yellow" },
  ]

  return (
    <Flex flex="1" overflow="hidden">
      {/* Chapter list - desktop only */}
      <Box
        w="200px"
        borderRight="1px solid"
        borderColor="rgba(99,102,241,0.1)"
        bg="rgba(10,10,18,0.8)"
        p="3"
        overflow="auto"
        flexShrink={0}
        hideBelow="md"
      >
        <HStack justify="space-between" mb="3">
          <Text fontSize="2xs" color="gray.600" fontWeight="600" letterSpacing="0.08em" textTransform="uppercase">Chapters</Text>
          <IconButton
            aria-label="Add chapter"
            variant="ghost"
            size="2xs"
            onClick={onAddChapter}
            color="gray.600"
            _hover={{ color: "brand.400", bg: "rgba(99,102,241,0.1)" }}
            borderRadius="md"
          >
            <Icon as={LuPlus} boxSize="12px" />
          </IconButton>
        </HStack>
        {chapters.map((c: Chapter) => (
          <Box
            key={c.id}
            px="2.5"
            py="2"
            borderRadius="lg"
            cursor="pointer"
            bg={activeChapter?.id === c.id ? "rgba(99,102,241,0.15)" : "transparent"}
            borderLeft={activeChapter?.id === c.id ? "2px solid" : "2px solid transparent"}
            borderColor={activeChapter?.id === c.id ? "brand.500" : "transparent"}
            _hover={{ bg: "rgba(99,102,241,0.08)" }}
            onClick={() => onSelectChapter(c.id)}
            transition="all 0.15s"
            mb="1"
          >
            <Text fontSize="xs" color={activeChapter?.id === c.id ? "gray.200" : "gray.500"} fontWeight={activeChapter?.id === c.id ? "500" : "400"} noOfLines={1}>
              {c.title}
            </Text>
            <Text fontSize="2xs" color="gray.700">{c.word_count} words</Text>
          </Box>
        ))}
      </Box>

      {/* Editor */}
      <Box flex="1" display="flex" flexDirection="column" overflow="hidden">
        {activeChapter ? (
          <>
            {/* AI Tools bar */}
            <Box
              px={{ base: "2", md: "4" }}
              py={{ base: "1.5", md: "2" }}
              borderBottom="1px solid"
              borderColor="rgba(99,102,241,0.08)"
              bg="rgba(10,10,18,0.6)"
              flexShrink={0}
            >
              <HStack gap={{ base: "0.5", md: "1" }} overflow="auto" css={{ WebkitOverflowScrolling: "touch" }}>
                {aiTools.map((t) => (
                  <Box
                    key={t.action}
                    as="button"
                    display="flex"
                    alignItems="center"
                    gap={{ base: "1", md: "1.5" }}
                    px={{ base: "2", md: "2.5" }}
                    py={{ base: "1", md: "1.5" }}
                    borderRadius="lg"
                    fontSize={{ base: "2xs", md: "xs" }}
                    color="gray.400"
                    bg="rgba(255,255,255,0.03)"
                    border="1px solid"
                    borderColor="rgba(255,255,255,0.06)"
                    _hover={{ bg: "rgba(99,102,241,0.1)", color: "brand.300", borderColor: "rgba(99,102,241,0.25)" }}
                    _active={{ transform: "scale(0.95)" }}
                    onClick={() => onAiAction(t.action)}
                    disabled={aiLoading}
                    opacity={aiLoading ? 0.5 : 1}
                    transition="all 0.15s"
                    flexShrink={0}
                    cursor={aiLoading ? "not-allowed" : "pointer"}
                    minH={{ base: "28px", md: "auto" }}
                  >
                    <Icon as={t.icon} boxSize={{ base: "12px", md: "11px" }} />
                    {t.label}
                  </Box>
                ))}
                {aiLoading && (
                  <HStack gap="1.5" color="brand.400" fontSize="xs" flexShrink={0}>
                    <Icon as={LuStar} boxSize="12px" style={{ animation: "spin 1s linear infinite" }} />
                    <Text>AI working...</Text>
                  </HStack>
                )}
              </HStack>
            </Box>

            {/* Text editor */}
            <Box flex="1" overflow="auto" position="relative">
              <Box
                as="textarea"
                value={activeChapter.content}
                onChange={(e: any) => onContentChange(e.target.value)}
                placeholder="Begin your story here... Let the words flow."
                style={{
                  width: "100%",
                  height: "100%",
                  minHeight: "100%",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  resize: "none",
                  color: "#e2e8f0",
                  fontSize: "16px",
                  lineHeight: "1.9",
                  fontFamily: "'Georgia', 'Times New Roman', serif",
                  padding: "24px 16px",
                  maxWidth: "720px",
                  margin: "0 auto",
                  display: "block",
                  boxSizing: "border-box",
                }}
                css={{
                  "&::placeholder": { color: "#374151" },
                  "@media (min-width: 768px)": {
                    padding: "32px 64px",
                  },
                }}
              />
            </Box>
          </>
        ) : (
          <Box flex="1" display="flex" alignItems="center" justifyContent="center">
            <VStack gap="3" textAlign="center">
              <Icon as={LuFileText} boxSize="40px" color="gray.700" />
              <Text color="gray.500">No chapter selected</Text>
              <Button size="sm" onClick={onAddChapter} colorPalette="brand" variant="outline" borderRadius="xl">
                Create Chapter
              </Button>
            </VStack>
          </Box>
        )}
      </Box>
    </Flex>
  )
}

function CharactersPanel({ characters, projectId, onUpdate }: any) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [desc, setDesc] = useState("")
  const [role, setRole] = useState("protagonist")

  const addCharacter = async () => {
    if (!name.trim()) return
    const char: Character = {
      id: uuidv4(),
      project_id: projectId,
      name: name.trim(),
      description: desc,
      traits: [],
      backstory: "",
      role,
      created_at: new Date().toISOString(),
    }
    await supabase.from("characters").insert(char)
    onUpdate((prev: Character[]) => [...prev, char])
    setName(""); setDesc(""); setShowForm(false)
    toaster.create({ title: "Character added", type: "success" })
  }

  return (
    <Box flex="1" p={{ base: "4", md: "6" }} overflow="auto">
      <HStack justify="space-between" mb={{ base: "4", md: "6" }}>
        <Heading fontSize={{ base: "md", md: "lg" }} fontWeight="700" color="white">Characters</Heading>
        <Button size="sm" onClick={() => setShowForm(!showForm)} colorPalette="brand" variant="outline" borderRadius="xl">
          <Icon as={LuPlus} mr="1.5" boxSize="13px" />
          <Box as="span" hideBelow="sm">Add Character</Box>
          <Box as="span" hideFrom="sm">Add</Box>
        </Button>
      </HStack>

      {showForm && (
        <Box bg="rgba(15,15,26,0.9)" border="1px solid" borderColor="rgba(99,102,241,0.2)" borderRadius="2xl" p={{ base: "4", md: "5" }} mb={{ base: "4", md: "6" }}>
          <VStack gap="3" align="stretch">
            <Input
              placeholder="Character name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              bg="rgba(10,10,15,0.8)"
              border="1px solid"
              borderColor="rgba(99,102,241,0.2)"
              color="white"
              fontSize="sm"
              borderRadius="xl"
              _focus={{ borderColor: "brand.500", outline: "none" }}
            />
            <Box
              as="select"
              value={role}
              onChange={(e: any) => setRole(e.target.value)}
              bg="rgba(10,10,15,0.8)"
              border="1px solid"
              borderColor="rgba(99,102,241,0.2)"
              color="white"
              fontSize="sm"
              borderRadius="xl"
              p="2"
              css={{ "& option": { background: "#0f0f1a" } }}
            >
              <option value="protagonist">Protagonist</option>
              <option value="antagonist">Antagonist</option>
              <option value="supporting">Supporting</option>
              <option value="mentor">Mentor</option>
            </Box>
            <Textarea
              placeholder="Description..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              bg="rgba(10,10,15,0.8)"
              border="1px solid"
              borderColor="rgba(99,102,241,0.2)"
              color="white"
              fontSize="sm"
              borderRadius="xl"
              rows={3}
              _focus={{ borderColor: "brand.500", outline: "none" }}
            />
            <HStack>
              <Button size="sm" onClick={addCharacter} bg="brand.600" color="white" borderRadius="xl" _hover={{ bg: "brand.500" }}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} color="gray.400" borderRadius="xl">Cancel</Button>
            </HStack>
          </VStack>
        </Box>
      )}

      <SimpleGrid columns={{ base: 1, sm: 2 }} gap={{ base: "3", md: "4" }}>
        {characters.map((c: Character) => (
          <Box
            key={c.id}
            bg="rgba(15,15,26,0.8)"
            border="1px solid"
            borderColor="rgba(99,102,241,0.12)"
            borderRadius="2xl"
            p={{ base: "3", md: "4" }}
          >
            <HStack mb="2">
              <Box
                w="36px"
                h="36px"
                borderRadius="full"
                bg="linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))"
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontWeight="700"
                fontSize="sm"
                color="brand.300"
              >
                {c.name[0]?.toUpperCase()}
              </Box>
              <VStack align="start" gap="0">
                <Text fontSize="sm" fontWeight="600" color="white">{c.name}</Text>
                <Badge size="xs" colorPalette="brand" variant="subtle">{c.role}</Badge>
              </VStack>
            </HStack>
            <Text fontSize="xs" color="gray.400" noOfLines={3}>{c.description || "No description yet"}</Text>
          </Box>
        ))}
      </SimpleGrid>

      {characters.length === 0 && !showForm && (
        <Box textAlign="center" py="12" color="gray.600">
          <Icon as={LuUsers} boxSize="32px" mb="3" />
          <Text>No characters yet</Text>
        </Box>
      )}
    </Box>
  )
}

function WorldPanel({ entries, projectId, onUpdate }: any) {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [category, setCategory] = useState("lore")

  const addEntry = async () => {
    if (!title.trim()) return
    const entry: WorldEntry = {
      id: uuidv4(),
      project_id: projectId,
      category,
      title: title.trim(),
      content,
      created_at: new Date().toISOString(),
    }
    await supabase.from("worldbuilding").insert(entry)
    onUpdate((prev: WorldEntry[]) => [...prev, entry])
    setTitle(""); setContent(""); setShowForm(false)
    toaster.create({ title: "World entry added", type: "success" })
  }

  const categories = ["lore", "location", "magic", "history", "culture", "technology"]

  return (
    <Box flex="1" p={{ base: "4", md: "6" }} overflow="auto">
      <HStack justify="space-between" mb={{ base: "4", md: "6" }}>
        <Heading fontSize={{ base: "md", md: "lg" }} fontWeight="700" color="white">Worldbuilding</Heading>
        <Button size="sm" onClick={() => setShowForm(!showForm)} colorPalette="brand" variant="outline" borderRadius="xl">
          <Icon as={LuPlus} mr="1.5" boxSize="13px" />
          <Box as="span" hideBelow="sm">Add Entry</Box>
          <Box as="span" hideFrom="sm">Add</Box>
        </Button>
      </HStack>

      {showForm && (
        <Box bg="rgba(15,15,26,0.9)" border="1px solid" borderColor="rgba(99,102,241,0.2)" borderRadius="2xl" p={{ base: "4", md: "5" }} mb={{ base: "4", md: "6" }}>
          <VStack gap="3" align="stretch">
            <HStack flexDir={{ base: "column", md: "row" }} w="full">
              <Input
                placeholder="Entry title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                bg="rgba(10,10,15,0.8)"
                border="1px solid"
                borderColor="rgba(99,102,241,0.2)"
                color="white"
                fontSize="sm"
                borderRadius="xl"
                _focus={{ borderColor: "brand.500", outline: "none" }}
                w={{ base: "full", md: "auto" }}
              />
              <Box
                as="select"
                value={category}
                onChange={(e: any) => setCategory(e.target.value)}
                bg="rgba(10,10,15,0.8)"
                border="1px solid"
                borderColor="rgba(99,102,241,0.2)"
                color="white"
                fontSize="sm"
                borderRadius="xl"
                p="2"
                w={{ base: "full", md: "auto" }}
                css={{ "& option": { background: "#0f0f1a" } }}
              >
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </Box>
            </HStack>
            <Textarea
              placeholder="Describe this element of your world..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              bg="rgba(10,10,15,0.8)"
              border="1px solid"
              borderColor="rgba(99,102,241,0.2)"
              color="white"
              fontSize="sm"
              borderRadius="xl"
              rows={4}
              _focus={{ borderColor: "brand.500", outline: "none" }}
            />
            <HStack>
              <Button size="sm" onClick={addEntry} bg="brand.600" color="white" borderRadius="xl" _hover={{ bg: "brand.500" }}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} color="gray.400" borderRadius="xl">Cancel</Button>
            </HStack>
          </VStack>
        </Box>
      )}

      <VStack align="stretch" gap="3">
        {categories.map((cat) => {
          const catEntries = entries.filter((e: WorldEntry) => e.category === cat)
          if (catEntries.length === 0) return null
          return (
            <Box key={cat}>
              <Text fontSize="2xs" color="gray.600" fontWeight="600" letterSpacing="0.08em" textTransform="uppercase" mb="2">{cat}</Text>
              {catEntries.map((e: WorldEntry) => (
                <Box
                  key={e.id}
                  bg="rgba(15,15,26,0.8)"
                  border="1px solid"
                  borderColor="rgba(99,102,241,0.12)"
                  borderRadius="xl"
                  p="3"
                  mb="2"
                >
                  <Text fontSize="sm" fontWeight="600" color="white" mb="1">{e.title}</Text>
                  <Text fontSize="xs" color="gray.400" noOfLines={3}>{e.content || "No content yet"}</Text>
                </Box>
              ))}
            </Box>
          )
        })}
      </VStack>

      {entries.length === 0 && !showForm && (
        <Box textAlign="center" py="12" color="gray.600">
          <Icon as={LuGlobe} boxSize="32px" mb="3" />
          <Text>No world entries yet</Text>
        </Box>
      )}
    </Box>
  )
}
