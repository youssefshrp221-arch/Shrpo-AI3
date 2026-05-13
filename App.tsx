import { useEffect } from "react"
import { Box } from "@chakra-ui/react"
import { Toaster } from "@/components/ui/toaster"
import MainLayout from "@/pages/MainLayout"
import ApiKeyScreen from "@/pages/ApiKeyScreen"
import { initializeSessionId } from "@/lib/supabase"
import { useAppStore } from "@/store/appStore"

export default function App() {
  const { apiKey } = useAppStore()

  useEffect(() => {
    initializeSessionId()
  }, [])

  return (
    <Box minH="100vh" bg="#0a0a0f" color="white" position="relative">
      {apiKey ? <MainLayout /> : <ApiKeyScreen />}
      <Toaster />
    </Box>
  )
}
