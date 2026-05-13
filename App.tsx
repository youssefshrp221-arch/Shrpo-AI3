import { useEffect } from "react"
import { Box } from "@chakra-ui/react"
import { Toaster } from "@/components/ui/toaster"
import MainLayout from "@/pages/MainLayout"
import { initializeSessionId } from "@/lib/supabase"

export default function App() {
  useEffect(() => {
    initializeSessionId()
  }, [])

  return (
    <Box minH="100vh" bg="#0a0a0f" color="white" position="relative">
      <MainLayout />
      <Toaster />
    </Box>
  )
}
