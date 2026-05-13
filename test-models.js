const models = [
  "meta/llama-3.1-8b-instruct",
  "meta/llama-3.1-70b-instruct",
  "google/gemma-2-9b-it",
]

async function testModels() {
  console.log("[v0] Starting model tests with debugging...\n")

  for (const modelId of models) {
    process.stdout.write(`[v0] Testing ${modelId}... `)
    try {
      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NVIDIA_API_KEY || 'NO_KEY'}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: "user", content: "hello" }],
          temperature: 0.7,
          max_tokens: 50,
        }),
      })

      const text = await response.text()
      console.log(`Response status: ${response.status}`)
      console.log(`Response text: ${text.substring(0, 100)}`)

      if (!response.ok) {
        console.log(`❌ FAILED`)
      } else {
        const data = JSON.parse(text)
        console.log(`✅ SUCCESS`)
      }
    } catch (err) {
      console.log(`❌ ERROR: ${err.message}`)
    }

    await new Promise((r) => setTimeout(r, 500))
  }
}

testModels().catch(console.error)
