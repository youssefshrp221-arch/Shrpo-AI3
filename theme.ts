import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react"

const config = defineConfig({
  cssVarsPrefix: "shrpo",
  globalCss: {
    "*": {
      boxSizing: "border-box",
    },
    "html, body": {
      margin: 0,
      padding: 0,
      fontFamily: "'Inter', system-ui, sans-serif",
      bg: "#0a0a0f",
      color: "#e2e8f0",
      overflowX: "hidden",
    },
    "::-webkit-scrollbar": {
      width: "6px",
      height: "6px",
    },
    "::-webkit-scrollbar-track": {
      background: "transparent",
    },
    "::-webkit-scrollbar-thumb": {
      background: "rgba(99, 102, 241, 0.4)",
      borderRadius: "3px",
    },
    "::-webkit-scrollbar-thumb:hover": {
      background: "rgba(99, 102, 241, 0.7)",
    },
  },
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: "#eef2ff" },
          100: { value: "#e0e7ff" },
          200: { value: "#c7d2fe" },
          300: { value: "#a5b4fc" },
          400: { value: "#818cf8" },
          500: { value: "#6366f1" },
          600: { value: "#4f46e5" },
          700: { value: "#4338ca" },
          800: { value: "#3730a3" },
          900: { value: "#312e81" },
          950: { value: "#1e1b4b" },
        },
        surface: {
          base: { value: "#0a0a0f" },
          raised: { value: "#0f0f1a" },
          overlay: { value: "#13131f" },
          panel: { value: "#16162a" },
          glass: { value: "rgba(22, 22, 42, 0.7)" },
        },
        neon: {
          cyan: { value: "#06b6d4" },
          blue: { value: "#3b82f6" },
          violet: { value: "#8b5cf6" },
          pink: { value: "#ec4899" },
          green: { value: "#10b981" },
        },
      },
      fonts: {
        heading: { value: "'Inter', system-ui, sans-serif" },
        body: { value: "'Inter', system-ui, sans-serif" },
        mono: { value: "'JetBrains Mono', 'Fira Code', monospace" },
      },
    },
    semanticTokens: {
      colors: {
        brand: {
          solid: { value: "{colors.brand.500}" },
          contrast: { value: "{colors.brand.100}" },
          fg: { value: "{colors.brand.400}" },
          muted: { value: "{colors.brand.900}" },
          subtle: { value: "{colors.brand.800}" },
          emphasized: { value: "{colors.brand.300}" },
          focusRing: { value: "{colors.brand.500}" },
        },
        "bg": {
          DEFAULT: { value: { base: "#f8fafc", _dark: "#0a0a0f" } },
          subtle: { value: { base: "#f1f5f9", _dark: "#0f0f1a" } },
          muted: { value: { base: "#e2e8f0", _dark: "#13131f" } },
          emphasized: { value: { base: "#cbd5e1", _dark: "#16162a" } },
          panel: { value: { base: "#ffffff", _dark: "rgba(22, 22, 42, 0.85)" } },
        },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)
