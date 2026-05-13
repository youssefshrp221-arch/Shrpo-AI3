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
  if (userEmail !== ADMIN_EMAIL) {
    return res.status(403).json({ error: "Forbidden — admin only" })
  }
  next()
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
        if (entry.isDirectory()) {
          walk(full, relative)
        } else if (ALLOWED_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
          files.push(relative)
        }
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
  if (isBlocked(filePath) || !ALLOWED_EXTENSIONS.includes(path.extname(target).toLowerCase())) {
    return res.status(403).json({ error: "Access denied" })
  }
  try {
    const content = fs.readFileSync(target, "utf-8")
    res.json({ content })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post("/api/dev/apply", requireAdmin, (req, res) => {
  const { path: filePath, content } = req.body
  if (!filePath || typeof filePath !== "string" || typeof content !== "string") {
    return res.status(400).json({ error: "Missing path or content" })
  }
  const target = path.join(__dirname, filePath)
  if (isBlocked(filePath) || !ALLOWED_EXTENSIONS.includes(path.extname(target).toLowerCase())) {
    return res.status(403).json({ error: "Access denied" })
  }
  try {
    fs.writeFileSync(target, content, "utf-8")
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Dev Studio: code generation (streaming, coder model) ─────────────────────
app.post("/api/dev/generate", requireAdmin, async (req, res) => {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) return res.status(500).json({ error: "Server not configured — NVIDIA API key missing" })

  const { messages } = req.body
  if (!Array.isArray(messages)) return res.status(400).json({ error: "messages array required" })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)

  try {
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
        messages,
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
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
})

// ── Dev Studio: vision — extract model IDs from screenshot (non-streaming) ───
app.post("/api/dev/vision", requireAdmin, async (req, res) => {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) return res.status(500).json({ error: "Server not configured — NVIDIA API key missing" })

  const { imageBase64 } = req.body
  if (!imageBase64 || typeof imageBase64 !== "string") {
    return res.status(400).json({ error: "imageBase64 required" })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)

  try {
    const upstream = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
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
            content: `You are a vision assistant specialised in reading NVIDIA NIM model lists.
Your job: look at the screenshot and extract every model ID exactly as shown — case-sensitive, slash-separated (e.g. "meta/llama-3.2-90b-vision-instruct").
Rules:
- Never invent, guess, or normalise names.
- Copy characters exactly as they appear.
- Return ONLY a JSON object: { "modelIds": ["id1", "id2", ...] }
- No extra text or markdown outside the JSON.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract all NVIDIA model IDs visible in this screenshot. Return only the JSON." },
              { type: "image_url", image_url: { url: imageBase64 } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 2048,
        stream: false,
      }),
    })

    clearTimeout(timeout)

    if (!upstream.ok) {
      let errBody = { error: `NVIDIA Vision API error: ${upstream.status}` }
      try { errBody = await upstream.json() } catch {}
      return res.status(upstream.status).json(errBody)
    }

    const data = await upstream.json()
    const text = data?.choices?.[0]?.message?.content || ""

    // Try to parse JSON from response
    let modelIds = []
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        if (Array.isArray(parsed.modelIds)) modelIds = parsed.modelIds
      } catch {}
    }

    // Fallback: regex extraction
    if (!modelIds.length) {
      const regex = /(?:meta|nvidia|mistralai|deepseek-ai|moonshotai|openai|google|stepfun-ai|minimaxai|bytedance|stockmark|abacusai|sarvamai|z-ai|microsoft|qwen)\/[a-zA-Z0-9._:-]+/g
      const matches = text.match(regex) || []
      modelIds = [...new Set(matches)]
    }

    res.json({ modelIds, rawText: text })
  } catch (err) {
    clearTimeout(timeout)
    if (!res.headersSent) {
      res.status(err.name === "AbortError" ? 504 : 500).json({
        error: err.name === "AbortError" ? "Vision request timed out (120s). Try a smaller image." : err.message,
      })
    }
  }
})

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"))
})

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Shrpo AI server listening on port ${PORT}`)
})
