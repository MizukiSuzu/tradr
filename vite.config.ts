import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const k of ['GROQ_API_KEY', 'TWELVEDATA_API_KEY']) if (env[k]) process.env[k] ??= env[k]

  return {
    plugins: [
      react(),
      {
        // Dev only: serve api/<name>.ts the way Vercel does in production
        name: 'dev-api',
        configureServer(server) {
          server.middlewares.use('/api', async (req, res, next) => {
            const name = (req.url ?? '').split('?')[0].replace(/^\//, '')
            if (!/^[a-z]+$/.test(name)) return next()
            let raw = ''
            for await (const chunk of req) raw += chunk
            try { (req as any).body = raw ? JSON.parse(raw) : undefined } catch { (req as any).body = undefined }
            const { default: handler } = await server.ssrLoadModule(`/api/${name}.ts`)
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
