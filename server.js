import express from "express"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 5000

// Parse JSON bodies up to 50MB (supports base64-encoded images)
app.use(express.json({ limit: "50mb" }))

// ─── NVIDIA API proxy ────────────────────────────────────────────────────────
// Receives POST /api/chat from the browser, forwards to NVIDIA NIM API.
// This avoids CORS issues since the browser talks only to this server.
app.post("/api/chat", async (req, res) => {
  const authHeader = req.headers["authorization"]
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" })
  }

  try {
    const upstream = await fetch(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,         // forward the user's Bearer token
          Accept: "text/event-stream",        // needed for streaming
        },
        body: JSON.stringify(req.body),
      }
    )

    if (!upstream.ok) {
      let errBody = { error: `NVIDIA API error: ${upstream.status}` }
      try { errBody = await upstream.json() } catch {}
      return res.status(upstream.status).json(errBody)
    }

    // Forward SSE/streaming response headers
    const contentType = upstream.headers.get("content-type") || "text/event-stream"
    res.setHeader("Content-Type", contentType)
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("X-Accel-Buffering", "no")   // prevent Nginx from buffering SSE
    res.setHeader("Connection", "keep-alive")

    // Stream the response body chunk-by-chunk
    const reader = upstream.body.getReader()
    const flush = async () => {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(value)
      }
      res.end()
    }
    await flush()
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message })
    }
  }
})

// ─── Static files (production build) ─────────────────────────────────────────
const distPath = path.join(__dirname, "dist")
app.use(express.static(distPath))

// SPA fallback — all other routes serve index.html (Express 5 wildcard syntax)
app.get("/{*path}", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"))
})

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Shrpo AI server listening on port ${PORT}`)
})
