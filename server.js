import express from "express"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 5000

app.use(express.json({ limit: "50mb" }))

// ── Main chat proxy ───────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) return res.status(500).json({ error: "Server not configured" })
  try {
    const upstream = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, Accept: "text/event-stream" },
      body: JSON.stringify(req.body),
    })
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
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
})

const distPath = path.join(__dirname, "dist")
app.use(express.static(distPath))

// ── Admin middleware ──────────────────────────────────────────────────────────
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "joeshrp4@gmail.com"
function requireAdmin(req, res, next) {
  if (req.headers["x-user-email"] !== ADMIN_EMAIL) return res.status(403).json({ error: "Forbidden — admin only" })
  next()
}

// ── Auth safety guard ─────────────────────────────────────────────────────────
const AUTH_FILES   = ["appStore.ts", "App.tsx", "MainLayout.tsx", "server.js"]
const AUTH_PATTERNS = ["ADMIN_EMAIL", "isAdmin", "rehydrateAdmin", "isAdminEmail", "requireAdmin"]
function checkAuthSafety(filePath, content) {
  if (!AUTH_FILES.some((af) => filePath.endsWith(af))) return null
  const missing = AUTH_PATTERNS.filter((p) => !content.includes(p))
  return missing.length ? `Blocked: would remove auth guard (${missing.join(", ")})` : null
}

// ── File-system helpers ───────────────────────────────────────────────────────
const ALLOWED_EXT   = [".tsx", ".ts", ".jsx", ".js", ".css", ".json", ".html", ".md"]
const BLOCKED_PATHS = ["node_modules", ".git", ".local", "dist", ".cache", "attached_assets"]

function isBlocked(fp) {
  const n = path.normalize(fp)
  return BLOCKED_PATHS.some((b) => n.includes(b))
}

function walkFiles(dir, prefix = "", out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel  = prefix ? `${prefix}/${entry.name}` : entry.name
    const full = path.join(dir, entry.name)
    if (isBlocked(rel)) continue
    if (entry.isDirectory()) walkFiles(full, rel, out)
    else if (ALLOWED_EXT.includes(path.extname(entry.name).toLowerCase())) out.push(rel)
  }
  return out
}

// ── /api/dev/files ────────────────────────────────────────────────────────────
app.get("/api/dev/files", requireAdmin, (req, res) => {
  try { res.json({ files: walkFiles(__dirname).sort() }) }
  catch (err) { res.status(500).json({ error: err.message }) }
})

// ── /api/dev/file ─────────────────────────────────────────────────────────────
app.get("/api/dev/file", requireAdmin, (req, res) => {
  const fp = req.query.path
  if (!fp) return res.status(400).json({ error: "Missing path" })
  const target = path.join(__dirname, fp)
  if (isBlocked(fp) || !ALLOWED_EXT.includes(path.extname(target).toLowerCase()))
    return res.status(403).json({ error: "Access denied" })
  try { res.json({ content: fs.readFileSync(target, "utf-8") }) }
  catch (err) { res.status(500).json({ error: err.message }) }
})

// ── /api/dev/apply ────────────────────────────────────────────────────────────
app.post("/api/dev/apply", requireAdmin, (req, res) => {
  const { path: fp, content } = req.body
  if (!fp || typeof content !== "string") return res.status(400).json({ error: "Missing path or content" })
  const target = path.join(__dirname, fp)
  if (isBlocked(fp) || !ALLOWED_EXT.includes(path.extname(target).toLowerCase()))
    return res.status(403).json({ error: "Access denied" })
  const authErr = checkAuthSafety(fp, content)
  if (authErr) return res.status(403).json({ error: authErr })
  try { fs.writeFileSync(target, content, "utf-8"); res.json({ success: true }) }
  catch (err) { res.status(500).json({ error: err.message }) }
})

// ── /api/dev/chat (vision OR coder, streaming) ────────────────────────────────
app.post("/api/dev/chat", requireAdmin, async (req, res) => {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) return res.status(500).json({ error: "Server not configured" })
  const { messages, imageBase64 } = req.body
  if (!Array.isArray(messages)) return res.status(400).json({ error: "messages required" })

  const hasImage = !!(imageBase64?.startsWith?.("data:image"))
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)

  try {
    const apiMessages = hasImage
      ? [
          { role: "system", content: "You are Shrpo Dev AI — a multimodal coding assistant. Analyze the image carefully, extract all relevant information, then fulfill the user request. Wrap any code in a markdown code block. Never remove auth guards." },
          ...messages.slice(0, -1).map((m) => ({ role: m.role, content: typeof m.content === "string" ? m.content : "" })),
          { role: "user", content: [{ type: "text", text: messages.at(-1)?.content || "Analyze this image" }, { type: "image_url", image_url: { url: imageBase64 } }] },
        ]
      : messages

    const model = hasImage ? "meta/llama-3.2-90b-vision-instruct" : "qwen/qwen3-coder-480b-a35b-instruct"
    const upstream = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, Accept: "text/event-stream" },
      body: JSON.stringify({ model, messages: apiMessages, temperature: hasImage ? 0.1 : 0.2, max_tokens: hasImage ? 4096 : 8192, stream: true }),
    })
    clearTimeout(timeout)
    if (!upstream.ok) {
      let e = { error: `NVIDIA API error: ${upstream.status}` }; try { e = await upstream.json() } catch {}
      return res.status(upstream.status).json(e)
    }
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "text/event-stream")
    res.setHeader("Cache-Control", "no-cache"); res.setHeader("X-Accel-Buffering", "no"); res.setHeader("Connection", "keep-alive")
    res.setHeader("X-Model-Used", model)
    const reader = upstream.body.getReader()
    while (true) { const { done, value } = await reader.read(); if (done) break; res.write(value) }
    res.end()
  } catch (err) {
    clearTimeout(timeout)
    if (!res.headersSent) res.status(err.name === "AbortError" ? 504 : 500).json({ error: err.message })
  }
})

// ════════════════════════════════════════════════════════════════════════════
// ── /api/dev/agent — Autonomous Coding Agent with Tool Calling ──────────────
// ════════════════════════════════════════════════════════════════════════════

// Tool definitions (OpenAI function-calling format)
const AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List all project files the agent is allowed to read or edit.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the complete content of a project file before editing it.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative file path, e.g. App.tsx or components/Sidebar.tsx" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write or overwrite a project file. You MUST include the COMPLETE file content — never truncate.",
      parameters: {
        type: "object",
        properties: {
          path:    { type: "string", description: "Relative file path" },
          content: { type: "string", description: "The complete new file content" },
        },
        required: ["path", "content"],
      },
    },
  },
]

// Tool executor
function execTool(name, args) {
  try {
    if (name === "list_files") {
      const files = walkFiles(__dirname).sort()
      return { success: true, content: files.join("\n"), preview: `${files.length} files` }
    }
    if (name === "read_file") {
      const fp = args.path || ""
      const target = path.join(__dirname, fp)
      if (isBlocked(fp) || !ALLOWED_EXT.includes(path.extname(target).toLowerCase()))
        return { success: false, content: "Access denied", preview: "Access denied" }
      const content = fs.readFileSync(target, "utf-8")
      return { success: true, content, preview: `${content.split("\n").length} lines` }
    }
    if (name === "write_file") {
      const fp = args.path || ""; const content = args.content || ""
      const target = path.join(__dirname, fp)
      if (isBlocked(fp) || !ALLOWED_EXT.includes(path.extname(target).toLowerCase()))
        return { success: false, content: "Access denied", preview: "Access denied" }
      const authErr = checkAuthSafety(fp, content)
      if (authErr) return { success: false, content: authErr, preview: authErr }
      fs.writeFileSync(target, content, "utf-8")
      return { success: true, content: "ok", preview: `${content.split("\n").length} lines written` }
    }
    return { success: false, content: "Unknown tool", preview: "Unknown tool" }
  } catch (err) {
    return { success: false, content: err.message, preview: err.message }
  }
}

const AGENT_SYSTEM = `You are Shrpo Dev AI — an autonomous coding agent. You have tools to list, read, and write project files directly.

Workflow for ANY code modification request:
1. Call list_files to understand project structure (if you haven't already)
2. Call read_file for every file you plan to modify
3. Call write_file with the COMPLETE updated file content
4. Summarize what you changed in plain language

Absolute rules (NEVER violate):
- Never write a file that removes: isAdmin, rehydrateAdmin, isAdminEmail, ADMIN_EMAIL, requireAdmin
- Never access: node_modules, .git, .env, dist, .cache
- Always write the COMPLETE file — never truncate or use placeholders like "// rest of code"
- Reply in the same language the user uses (Arabic → Arabic, English → English)`

app.post("/api/dev/agent", requireAdmin, async (req, res) => {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) return res.status(500).json({ error: "Server not configured" })
  const { messages } = req.body
  if (!Array.isArray(messages)) return res.status(400).json({ error: "messages required" })

  // SSE setup
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("X-Accel-Buffering", "no")
  res.setHeader("Connection", "keep-alive")

  const emit = (obj) => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(obj)}\n\n`) }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180_000)

  // Build initial message list
  let loopMsgs = [{ role: "system", content: AGENT_SYSTEM }, ...messages]
  const MAX_ITER = 10

  try {
    for (let iter = 0; iter < MAX_ITER; iter++) {
      emit({ type: "thinking", iter })

      // Call NVIDIA (non-streaming so we can parse tool_calls)
      const nvRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "qwen/qwen3-coder-480b-a35b-instruct",
          messages: loopMsgs,
          tools: AGENT_TOOLS,
          tool_choice: "auto",
          stream: false,
          temperature: 0.15,
          max_tokens: 8192,
        }),
      })

      if (!nvRes.ok) {
        const e = await nvRes.json().catch(() => ({}))
        throw new Error(e.error || `NVIDIA ${nvRes.status}`)
      }

      const data  = await nvRes.json()
      const choice = data.choices?.[0]
      if (!choice) throw new Error("No response from model")

      const msg    = choice.message
      const reason = choice.finish_reason

      // ── Handle tool calls ──────────────────────────────────────────────────
      if (msg.tool_calls?.length) {
        // Add assistant message with tool calls to history
        loopMsgs.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls })

        for (const tc of msg.tool_calls) {
          let args = {}
          try { args = JSON.parse(tc.function.arguments) } catch {}

          emit({ type: "tool_call", tool: tc.function.name, args, callId: tc.id })

          const result = execTool(tc.function.name, args)

          if (tc.function.name === "write_file") {
            emit({ type: "write_result", path: args.path, success: result.success, message: result.preview })
          } else {
            emit({ type: "tool_result", tool: tc.function.name, success: result.success, preview: result.preview })
          }

          loopMsgs.push({ role: "tool", tool_call_id: tc.id, content: result.content })
        }
        // Continue loop so model can make more tool calls or give final answer
        continue
      }

      // ── Final text response ────────────────────────────────────────────────
      if (msg.content) {
        emit({ type: "content", text: msg.content })
      }
      break
    }
  } catch (err) {
    emit({ type: "error", message: err.name === "AbortError" ? "Timeout (3 min)" : err.message })
  } finally {
    clearTimeout(timeout)
    emit({ type: "done" })
    res.end()
  }
})

// ── Legacy vision endpoint ────────────────────────────────────────────────────
app.post("/api/dev/vision", requireAdmin, async (req, res) => {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) return res.status(500).json({ error: "Server not configured" })
  const { imageBase64, userPrompt } = req.body
  if (!imageBase64) return res.status(400).json({ error: "imageBase64 required" })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)
  try {
    const upstream = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST", signal: controller.signal,
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
      let e = { error: `Vision API error: ${upstream.status}` }; try { e = await upstream.json() } catch {}
      return res.status(upstream.status).json(e)
    }
    const d = await upstream.json()
    const text = d?.choices?.[0]?.message?.content || ""
    let modelIds = []
    const m = text.match(/\{[\s\S]*\}/)
    if (m) { try { const p = JSON.parse(m[0]); if (Array.isArray(p.modelIds)) modelIds = p.modelIds } catch {} }
    if (!modelIds.length) {
      const rx = /(?:meta|nvidia|mistralai|deepseek-ai|moonshotai|qwen|openai|google|microsoft)\/[a-zA-Z0-9._:-]+/g
      modelIds = [...new Set(text.match(rx) || [])]
    }
    res.json({ modelIds, rawText: text })
  } catch (err) {
    clearTimeout(timeout)
    if (!res.headersSent) res.status(500).json({ error: err.message })
  }
})

app.get(/.*/, (_req, res) => res.sendFile(path.join(distPath, "index.html")))

app.listen(PORT, "0.0.0.0", () => console.log(`Shrpo AI server listening on port ${PORT}`))
