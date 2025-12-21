import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// export default defineConfig({
//   plugins: [react()],
// })
// export default defineConfig({
//   plugins: [react()],
//   server: {
//     host: '0.0.0.0',  // 让外部也能访问
//     allowedHosts: [
//       'localhost',
//       'kasandra-nonsporting-love.ngrok-free.dev',  // 把错误提示里那串域名填进来
//     ],
//   },
// })

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: [
      'localhost',
      'kasandra-nonsporting-love.ngrok-free.dev',
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});