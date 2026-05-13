import express from "express"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 5000

app.use(express.json({ limit: "50mb" }))

// ── Main chat proxy ──────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) return res.status(500).json({ error: "Server not configured — NVIDIA API key missing" })

  try {
    const upstream = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        Accept: "text/event-stream",
      },
      body: JSON.stringify(req.body),
    })

    if (!upstream.ok) {
      let errBody = { error: `NVIDIA API error: ${upstream.status}` }
      try { errBody = await upstream.json() } catch {}
      return res.status(upstream.status).json(errBody)
    }

    res.setHeader("Content-Type", upstream.headers.get("content-type") || "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("X-Accel-Buffering", "no")
    res.setHeader("Connection", "keep-alive")

    const reader = upstream.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(value)
    }
    res.end()
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
})

const distPath = path.join(__dirname, "dist")
app.use(express.static(distPath))

// ── Admin middleware ──────────────────────────────────────────────────────────
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "joeshrp4@gmail.com"

function requireAdmin(req, res, next) {
  const userEmail = req.headers["x-user-email"]
  if (userEmail !== ADMIN_EMAIL) return res.status(403).json({ error: "Forbidden — admin only" })
  next()
}

// ── Auth protection: blocks saving files that remove critical auth lines ──────
const AUTH_FILES = ["appStore.ts", "App.tsx", "MainLayout.tsx", "server.js"]
const AUTH_PATTERNS = ["ADMIN_EMAIL", "isAdmin", "rehydrateAdmin", "isAdminEmail", "requireAdmin"]

function checkAuthSafety(filePath, newContent) {
  if (!AUTH_FILES.some((af) => filePath.endsWith(af))) return null
  const missing = AUTH_PATTERNS.filter((p) => !newContent.includes(p))
  if (missing.length > 0) {
    return `Blocked: would remove auth guard (${missing.join(", ")})`
  }
  return null
}

// ── Dev Studio file APIs ──────────────────────────────────────────────────────
const ALLOWED_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".css", ".json", ".html", ".md"]
const BLOCKED_PATHS = ["node_modules", ".git", ".local", "dist", ".cache", "attached_assets"]

function isBlocked(filePath) {
  const normalized = path.normalize(filePath)
  return BLOCKED_PATHS.some((b) => normalized.includes(b))
}

app.get("/api/dev/files", requireAdmin, (req, res) => {
  try {
    const files = []
    function walk(dir, prefix = "") {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name
        const full = path.join(dir, entry.name)
        if (isBlocked(relative)) continue
        if (entry.isDirectory()) walk(full, relative)
        else if (ALLOWED_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) files.push(relative)
      }
    }
    walk(__dirname)
    res.json({ files })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get("/api/dev/file", requireAdmin, (req, res) => {
  const filePath = req.query.path
  if (!filePath || typeof filePath !== "string") return res.status(400).json({ error: "Missing path" })
  const target = path.join(__dirname, filePath)
  if (isBlocked(filePath) || !ALLOWED_EXTENSIONS.includes(path.extname(target).toLowerCase()))
    return res.status(403).json({ error: "Access denied" })
  try {
    const content = fs.readFileSync(target, "utf-8")
    res.json({ content })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post("/api/dev/apply", requireAdmin, (req, res) => {
  const { path: filePath, content } = req.body
  if (!filePath || typeof filePath !== "string" || typeof content !== "string")
    return res.status(400).json({ error: "Missing path or content" })
  const target = path.join(__dirname, filePath)
  if (isBlocked(filePath) || !ALLOWED_EXTENSIONS.includes(path.extname(target).toLowerCase()))
    return res.status(403).json({ error: "Access denied" })

  // ── Auth safety check ──
  const authErr = checkAuthSafety(filePath, content)
  if (authErr) return res.status(403).json({ error: authErr })

  try {
    fs.writeFileSync(target, content, "utf-8")
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Dev Studio: unified chat endpoint ────────────────────────────────────────
// If imageBase64 present: vision model analyzes image, then coder model generates code (streaming)
// If text only: coder model directly (streaming)
app.post("/api/dev/chat", requireAdmin, async (req, res) => {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) return res.status(500).json({ error: "Server not configured" })

  const { messages, imageBase64 } = req.body
  if (!Array.isArray(messages)) return res.status(400).json({ error: "messages array required" })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)

  try {
    let coderMessages = messages

    // ── Step 1: If image present, run vision model first (non-streaming) ──
    if (imageBase64 && typeof imageBase64 === "string") {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")
      const userText = typeof lastUserMsg?.content === "string"
        ? lastUserMsg.content
        : "Analyze this image and describe what you see, especially any model names, code, or UI elements."

      const visionRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "meta/llama-3.2-90b-vision-instruct",
          messages: [
            {
              role: "system",
              content: "You are a vision assistant. Analyze the image carefully and extract all relevant information: model names, code snippets, UI layouts, text, or any other visible content. Be precise and comprehensive.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: userText },
                { type: "image_url", image_url: { url: imageBase64 } },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 2048,
          stream: false,
        }),
      })

      if (!visionRes.ok) {
        let errBody = { error: `Vision API error: ${visionRes.status}` }
        try { errBody = await visionRes.json() } catch {}
        clearTimeout(timeout)
        return res.status(visionRes.status).json(errBody)
      }

      const visionData = await visionRes.json()
      const visionText = visionData?.choices?.[0]?.message?.content || ""

      // ── Step 2: Feed vision analysis into coder model ──
      coderMessages = [
        ...messages.slice(0, -1), // all except last user message
        {
          role: "user",
          content: `[Image Analysis Result]\n${visionText}\n\n[User Request]\n${typeof lastUserMsg?.content === "string" ? lastUserMsg.content : ""}`,
        },
      ]
    }

    // ── Stream coder model response ──
    const upstream = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: "qwen/qwen3-coder-480b-a35b-instruct",
        messages: coderMessages,
        temperature: 0.2,
        max_tokens: 8192,
        stream: true,
      }),
    })

    clearTimeout(timeout)

    if (!upstream.ok) {
      let errBody = { error: `NVIDIA API error: ${upstream.status}` }
      try { errBody = await upstream.json() } catch {}
      return res.status(upstream.status).json(errBody)
    }

    res.setHeader("Content-Type", upstream.headers.get("content-type") || "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("X-Accel-Buffering", "no")
    res.setHeader("Connection", "keep-alive")

    const reader = upstream.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(value)
    }
    res.end()
  } catch (err) {
    clearTimeout(timeout)
    if (!res.headersSent) {
      res.status(err.name === "AbortError" ? 504 : 500).json({
        error: err.name === "AbortError" ? "Request timed out after 120s" : err.message,
      })
    }
  }
})

// ── Legacy endpoints (kept for compatibility) ─────────────────────────────────
app.post("/api/dev/generate", requireAdmin, async (req, res) => {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) return res.status(500).json({ error: "Server not configured" })
  const { messages } = req.body
  if (!Array.isArray(messages)) return res.status(400).json({ error: "messages array required" })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)

  try {
    const upstream = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, Accept: "text/event-stream" },
      body: JSON.stringify({ model: "qwen/qwen3-coder-480b-a35b-instruct", messages, temperature: 0.2, max_tokens: 8192, stream: true }),
    })
    clearTimeout(timeout)
    if (!upstream.ok) {
      let e = { error: `NVIDIA API error: ${upstream.status}` }
      try { e = await upstream.json() } catch {}
      return res.status(upstream.status).json(e)
    }
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("X-Accel-Buffering", "no")
    res.setHeader("Connection", "keep-alive")
    const reader = upstream.body.getReader()
    while (true) { const { done, value } = await reader.read(); if (done) break; res.write(value) }
    res.end()
  } catch (err) {
    clearTimeout(timeout)
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
})

app.post("/api/dev/vision", requireAdmin, async (req, res) => {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) return res.status(500).json({ error: "Server not configured" })
  const { imageBase64, userPrompt } = req.body
  if (!imageBase64) return res.status(400).json({ error: "imageBase64 required" })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)

  try {
    const upstream = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "meta/llama-3.2-90b-vision-instruct",
        messages: [
          { role: "system", content: "Extract NVIDIA model IDs exactly as written. Return only JSON: { \"modelIds\": [...] }" },
          { role: "user", content: [{ type: "text", text: userPrompt || "Extract all model IDs." }, { type: "image_url", image_url: { url: imageBase64 } }] },
        ],
        temperature: 0.1, max_tokens: 2048, stream: false,
      }),
    })
    clearTimeout(timeout)
    if (!upstream.ok) {
      let e = { error: `Vision API error: ${upstream.status}` }
      try { e = await upstream.json() } catch {}
      return res.status(upstream.status).json(e)
    }
    const data = await upstream.json()
    const text = data?.choices?.[0]?.message?.content || ""
    let modelIds = []
    const m = text.match(/\{[\s\S]*\}/)
    if (m) { try { const p = JSON.parse(m[0]); if (Array.isArray(p.modelIds)) modelIds = p.modelIds } catch {} }
    if (!modelIds.length) {
      const rx = /(?:meta|nvidia|mistralai|deepseek-ai|moonshotai|openai|google|stepfun-ai|minimaxai|bytedance|stockmark|abacusai|sarvamai|z-ai|microsoft|qwen)\/[a-zA-Z0-9._:-]+/g
      modelIds = [...new Set(text.match(rx) || [])]
    }
    res.json({ modelIds, rawText: text })
  } catch (err) {
    clearTimeout(timeout)
    if (!res.headersSent) res.status(err.name === "AbortError" ? 504 : 500).json({ error: err.message })
  }
})

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"))
})

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Shrpo AI server listening on port ${PORT}`)
})
