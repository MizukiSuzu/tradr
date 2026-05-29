import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const groqKey = env.VITE_GROQ_API_KEY

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': '/src' }
    },
    server: {
      proxy: {
        '/api/groq': {
          target: 'https://api.groq.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/groq/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (groqKey) proxyReq.setHeader('Authorization', `Bearer ${groqKey}`)
            })
          },
        },
      },
    },
  }
})