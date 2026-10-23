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
            let raw = ''
            for await (const chunk of req) raw += chunk
            try { (req as any).body = JSON.parse(raw) } catch { (req as any).body = undefined }
            const { default: handler } = await server.ssrLoadModule('/api/chat.ts')
            await handler(req, res)
          })
        },
      },
    ],
    resolve: {
      alias: { '@': '/src' }
    },
  }
})
