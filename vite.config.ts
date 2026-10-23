import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  process.env.GROQ_API_KEY ??= env.GROQ_API_KEY

  return {
    plugins: [
      react(),
      {
        // Dev only: serve api/chat.ts the way Vercel does in production
        name: 'dev-api-chat',
        configureServer(server) {
          server.middlewares.use('/api/chat', async (req, res) => {
            const chunks: Buffer[] = []
            for await (const chunk of req) chunks.push(chunk)
            const { POST } = await server.ssrLoadModule('/api/chat.ts')
            const response: Response = await POST(new Request('http://localhost/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: Buffer.concat(chunks),
            }))
            res.statusCode = response.status
            res.setHeader('Content-Type', 'application/json')
            res.end(await response.text())
          })
        },
      },
    ],
    resolve: {
      alias: { '@': '/src' }
    },
  }
})
