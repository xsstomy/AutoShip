import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 读取对应环境的 .env 文件（.env.development / .env.production）
  const env = loadEnv(mode, process.cwd(), '')

  // ⭐ 启动时在「终端」里打印当前环境和后台 API 地址
  console.log('🧩 Vite 当前模式:', mode)
  console.log('🔗 前端使用的 API 地址 VITE_API_URL =', env.VITE_API_URL)

  return {
    plugins: [react()],
    base: '/', // 部署在根路径
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3100',
          changeOrigin: true,
        },
        '/webhooks': {
          target: 'http://localhost:3100',
          changeOrigin: true,
        },
      },
    },
  }
})
