// Vercel serverless function: proxies agent chat to Groq so the API key stays server-side.
// The client only sends messages; model and limits are pinned here so the endpoint
// can't be used as a general-purpose Groq relay.

const MAX_MESSAGES = 12
const MAX_CHARS = 8000

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return Response.json({ error: 'GROQ_API_KEY not set' }, { status: 500 })

  const { messages } = await req.json().catch(() => ({}))
  const valid =
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.length <= MAX_MESSAGES &&
    messages.every(m =>
      ['system', 'user', 'assistant'].includes(m?.role) &&
      typeof m.content === 'string' &&
      m.content.length <= MAX_CHARS
    )
  if (!valid) return Response.json({ error: 'Invalid messages' }, { status: 400 })

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-20b',
      max_tokens: 400,
      reasoning_effort: 'low',
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  })

  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
