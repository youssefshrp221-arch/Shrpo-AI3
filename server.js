import express from "express"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 5000

app.use(express.json({ limit: "50mb" }))

app.post("/api/chat", async (req, res) => {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: "Server not configured — NVIDIA API key missing" })
  }

  try {
    const upstream = await fetch(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          Accept: "text/event-stream",
        },
        body: JSON.stringify(req.body),
      }
    )

    if (!upstream.ok) {
      let errBody = { error: `NVIDIA API error: ${upstream.status}` }
      try { errBody = await upstream.json() } catch {}
      return res.status(upstream.status).json(errBody)
    }

    const contentType = upstream.headers.get("content-type") || "text/event-stream"
    res.setHeader("Content-Type", contentType)
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("X-Accel-Buffering", "no")
    res.setHeader("Connection", "keep-alive")

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

const distPath = path.join(__dirname, "dist")
app.use(express.static(distPath))

app.get("/{*path}", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"))
})

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Shrpo AI server listening on port ${PORT}`)
})
