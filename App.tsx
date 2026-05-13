import { useEffect } from "react"
import { Box } from "@chakra-ui/react"
import { Toaster } from "@/components/ui/toaster"
import MainLayout from "@/pages/MainLayout"
import { initializeSessionId } from "@/lib/supabase"
import { useAppStore } from "@/store/appStore"

export default function App() {
  const rehydrateAdmin = useAppStore((s) => s.rehydrateAdmin)

  useEffect(() => {
    initializeSessionId()
    // Re-derive isAdmin from persisted email on every app load
    // This prevents localStorage tampering (isAdmin is never persisted directly)
    rehydrateAdmin()
  }, [])

  return (
    <Box minH="100vh" bg="#0a0a0f" color="white" position="relative">
      <MainLayout />
      <Toaster />
    </Box>
  )
}
