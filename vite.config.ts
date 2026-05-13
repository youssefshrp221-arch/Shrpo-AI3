import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { resolve } from "path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@/lib/theme": resolve(__dirname, "theme.ts"),
      "@/lib/supabase": resolve(__dirname, "supabase.ts"),
      "@/lib/nvidia": resolve(__dirname, "nvidia.ts"),
      "@/lib/modelOrchestrator": resolve(__dirname, "modelOrchestrator.ts"),
      "@/store/appStore": resolve(__dirname, "appStore.ts"),
      "@/types": resolve(__dirname, "index.ts"),
      "@/components/ui/color-mode": resolve(__dirname, "color-mode.jsx"),
      "@/components/ui/toaster": resolve(__dirname, "toaster.jsx"),
      "@/components/ui/accordion": resolve(__dirname, "accordion.jsx"),
      "@/components/ui/progress": resolve(__dirname, "progress.jsx"),
      "@/components/MessageBubble": resolve(__dirname, "MessageBubble.tsx"),
      "@/components/ChatInput": resolve(__dirname, "ChatInput.tsx"),
      "@/components/Sidebar": resolve(__dirname, "Sidebar.tsx"),
      "@/components/ModelSelector/ModelSelector": resolve(__dirname, "ModelSelector.tsx"),
      "@/pages/MainLayout": resolve(__dirname, "MainLayout.tsx"),
      "@/pages/ChatPage": resolve(__dirname, "ChatPage.tsx"),
      "@/pages/WritingStudio": resolve(__dirname, "WritingStudio.tsx"),
      "@/pages/NovelStudio": resolve(__dirname, "NovelStudio.tsx"),
      "@/pages/ToolsPage": resolve(__dirname, "ToolsPage.tsx"),
      "@/pages/SettingsPage": resolve(__dirname, "SettingsPage.tsx"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
  },
})
