// Vercel serverless function: proxies agent chat to Groq so the API key stays server-side.
// The client only sends messages; model and limits are pinned here so the endpoint
// can't be used as a general-purpose Groq relay.
import type { IncomingMessage, ServerResponse } from 'node:http'

const MAX_MESSAGES = 12
const MAX_CHARS = 8000

function send(res: ServerResponse, status: number, body: string) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(body)
}

// Vercel parses JSON bodies into req.body; the Vite dev middleware does the same.
export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  if (req.method !== 'POST') return send(res, 405, JSON.stringify({ error: 'Method not allowed' }))

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return send(res, 500, JSON.stringify({ error: 'GROQ_API_KEY not set' }))

  const messages = req.body?.messages
  const valid =
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.length <= MAX_MESSAGES &&
    messages.every(m =>
      ['system', 'user', 'assistant'].includes(m?.role) &&
      typeof m.content === 'string' &&
      m.content.length <= MAX_CHARS
    )
  if (!valid) return send(res, 400, JSON.stringify({ error: 'Invalid messages' }))

  const groq = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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

  send(res, groq.status, await groq.text())
}
