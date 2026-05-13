import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { messages, model = 'meta/llama-3.1-8b-instruct', temperature = 0.7, stream = true } = await req.json()

    // Get API key from server environment - never from client
    const apiKey = process.env.NVIDIA_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Server not configured - NVIDIA API key missing' },
        { status: 500 }
      )
    }

    // Allowed models - security: only allow specified models
    const allowedModels = [
      'meta/llama-3.1-8b-instruct',
      'meta/llama-3.1-70b-instruct',
      'meta/llama-3.1-405b-instruct',
      'nvidia/llama-3.1-nemotron-70b-instruct',
      'nvidia/nemotron-4-340b-instruct',
      'mistralai/mistral-large',
      'mistralai/mistral-nemo-12b-instruct-2407',
      'mistralai/mixtral-8x22b-instruct-v0.1',
      'mistralai/mixtral-8x7b-instruct-v0.1',
    ]

    if (!allowedModels.includes(model)) {
      return NextResponse.json(
        { error: `Invalid model. Allowed: ${allowedModels.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate messages
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required and must not be empty' },
        { status: 400 }
      )
    }

    // Validate temperature
    const validTemp = Math.min(Math.max(temperature, 0), 1)

    const systemPrompt = {
      role: 'system',
      content: `أنت مساعد ذكي اسمك Shrpo AI. تقوم بمساعدة المستخدم في جميع المجالات بذكاء واحترافية.

IMPORTANT - LaTeX Math Formatting:
- ALWAYS use LaTeX notation for any mathematical content, equations, formulas, powers, roots, fractions, or symbols.
- Inline math: wrap with single dollar signs like $E=mc^2$ or $\\sqrt{x^2+y^2}$
- Block/display math: wrap with double dollar signs like $$\\frac{a}{b}$$ or $$\\sum_{i=1}^{n} x_i$$
- Powers: use ^ like $x^2$, $2^{10}$
- Roots: use \\sqrt like $\\sqrt{x}$, $\\sqrt[3]{8}$
- Fractions: use \\frac like $\\frac{numerator}{denominator}$
- Greek letters: $\\alpha$, $\\beta$, $\\pi$, $\\theta$, $\\omega$
- NEVER write math as plain text like "x^2" or "sqrt(x)" - always use LaTeX.
- This ensures beautiful, professional mathematical rendering for the user.`
    }

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [systemPrompt, ...messages],
        temperature: validTemp,
        max_tokens: 4096,
        stream: stream,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Shrpo] NVIDIA API error:', error)
      return NextResponse.json(
        { error: 'Failed to generate response from NVIDIA API' },
        { status: response.status }
      )
    }

    // Handle streaming responses
    if (stream && response.body) {
      return new NextResponse(response.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      })
    }

    // Handle non-streaming responses
    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('[Shrpo] API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
